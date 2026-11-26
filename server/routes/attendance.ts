import express, { type Response } from 'express';
import { db, getTodayISO } from '../database.ts';
import { requireAuth, type AuthedRequest } from '../middleware/auth.ts';

const router = express.Router();
router.use(requireAuth);

const VALID_STATUSES = new Set(['Present', 'Absent', 'Late', 'On Leave']);

router.get('/sheet', (req: AuthedRequest, res: Response) => {
  try {
    const date = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : getTodayISO();
    const departmentId = typeof req.query.department_id === 'string' ? req.query.department_id.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const conditions = ["e.status != 'Inactive'"];
    const params: unknown[] = [date, date];

    if (departmentId) {
      conditions.push('e.department_id = ?');
      params.push(Number(departmentId));
    }

    if (search) {
      const term = `%${search}%`;
      conditions.push('(e.full_name LIKE ? OR e.employee_code LIKE ? OR e.designation LIKE ?)');
      params.push(term, term, term);
    }

    if (status === 'Unmarked') {
      conditions.push('a.id IS NULL');
    } else if (status) {
      conditions.push('a.status = ?');
      params.push(status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const records = db
      .prepare(
        `SELECT
          e.id AS employee_id,
          e.employee_code,
          e.full_name,
          e.designation,
          e.department_id,
          COALESCE(d.name, 'Unassigned') AS department_name,
          a.id AS attendance_id,
          ? AS attendance_date,
          a.status,
          a.check_in,
          a.check_out,
          a.remarks,
          a.updated_at
        FROM employees e
        LEFT JOIN departments d ON d.id = e.department_id
        LEFT JOIN attendance a ON a.employee_id = e.id AND a.attendance_date = ?
        ${whereClause}
        ORDER BY e.employee_code ASC`
      )
      .all(...params);

    const settings = db
      .prepare('SELECT office_start_time, office_end_time, late_grace_minutes FROM settings WHERE id = 1')
      .get();

    res.json({
      success: true,
      data: {
        date,
        settings: settings || { office_start_time: '09:00', office_end_time: '17:30', late_grace_minutes: 15 },
        records
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.post('/', (req: AuthedRequest, res: Response) => {
  try {
    const employeeId = Number(req.body?.employee_id);
    const attendanceDate = String(req.body?.attendance_date || '').trim();
    const status = String(req.body?.status || '').trim();
    const checkIn = String(req.body?.check_in || '').trim();
    const checkOut = String(req.body?.check_out || '').trim();
    const remarks = String(req.body?.remarks || '').trim();

    if (!Number.isInteger(employeeId) || !attendanceDate || !status) {
      res.status(400).json({ success: false, message: 'Employee, attendance date, and status are required.' });
      return;
    }

    if (!VALID_STATUSES.has(status)) {
      res.status(400).json({ success: false, message: 'Invalid attendance status.' });
      return;
    }

    const emp = db.prepare('SELECT id FROM employees WHERE id = ?').get(employeeId);
    if (!emp) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    const duplicate = db
      .prepare('SELECT id FROM attendance WHERE employee_id = ? AND attendance_date = ?')
      .get(employeeId, attendanceDate);

    if (duplicate) {
      res.status(409).json({
        success: false,
        message: 'Attendance is already marked for this employee on the selected date. Use Edit to modify.'
      });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO attendance (employee_id, attendance_date, status, check_in, check_out, remarks)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(employeeId, attendanceDate, status, checkIn, checkOut, remarks);

    const created = db.prepare('SELECT * FROM attendance WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, message: 'Attendance marked successfully.', data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.post('/bulk', (req: AuthedRequest, res: Response) => {
  try {
    const attendanceDate = String(req.body?.attendance_date || '').trim();
    const status = String(req.body?.status || '').trim();
    const employeeIds = Array.isArray(req.body?.employee_ids) ? req.body.employee_ids.map(Number) : [];
    const checkIn = String(req.body?.check_in || '').trim();
    const checkOut = String(req.body?.check_out || '').trim();
    const remarks = String(req.body?.remarks || '').trim();

    if (!attendanceDate || !status || employeeIds.length === 0) {
      res.status(400).json({ success: false, message: 'Date, status, and at least one employee are required.' });
      return;
    }

    if (!VALID_STATUSES.has(status)) {
      res.status(400).json({ success: false, message: 'Invalid attendance status.' });
      return;
    }

    let insertedCount = 0;
    let skippedCount = 0;

    const checkDup = db.prepare('SELECT id FROM attendance WHERE employee_id = ? AND attendance_date = ?');
    const insertStmt = db.prepare(
      `INSERT INTO attendance (employee_id, attendance_date, status, check_in, check_out, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const runBulk = db.transaction(() => {
      for (const empId of employeeIds) {
        if (!Number.isInteger(empId)) continue;
        if (checkDup.get(empId, attendanceDate)) {
          skippedCount++;
          continue;
        }
        insertStmt.run(empId, attendanceDate, status, checkIn, checkOut, remarks);
        insertedCount++;
      }
    });
    runBulk();

    res.json({
      success: true,
      message: `Marked ${insertedCount} employee(s) as ${status}.${skippedCount ? ` ${skippedCount} already marked.` : ''}`,
      data: { insertedCount, skippedCount }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.put('/:id', (req: AuthedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM attendance WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Attendance record not found.' });
      return;
    }

    const status = String(req.body?.status || '').trim();
    const checkIn = String(req.body?.check_in || '').trim();
    const checkOut = String(req.body?.check_out || '').trim();
    const remarks = String(req.body?.remarks || '').trim();

    if (!VALID_STATUSES.has(status)) {
      res.status(400).json({ success: false, message: 'Valid attendance status is required.' });
      return;
    }

    db.prepare(
      `UPDATE attendance
       SET status = ?, check_in = ?, check_out = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(status, checkIn, checkOut, remarks, id);

    const updated = db.prepare('SELECT * FROM attendance WHERE id = ?').get(id);
    res.json({ success: true, message: 'Attendance updated successfully.', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.delete('/:id', (req: AuthedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT id FROM attendance WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Attendance record not found.' });
      return;
    }
    db.prepare('DELETE FROM attendance WHERE id = ?').run(id);
    res.json({ success: true, message: 'Attendance entry removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.get('/history', (req: AuthedRequest, res: Response) => {
  try {
    const employeeId = typeof req.query.employee_id === 'string' ? req.query.employee_id.trim() : '';
    const startDate = typeof req.query.start_date === 'string' ? req.query.start_date.trim() : '';
    const endDate = typeof req.query.end_date === 'string' ? req.query.end_date.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (employeeId) {
      conditions.push('a.employee_id = ?');
      params.push(Number(employeeId));
    }
    if (startDate) {
      conditions.push('a.attendance_date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('a.attendance_date <= ?');
      params.push(endDate);
    }
    if (status) {
      conditions.push('a.status = ?');
      params.push(status);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const records = db
      .prepare(
        `SELECT
          a.*,
          e.employee_code,
          e.full_name,
          e.designation,
          COALESCE(d.name, 'Unassigned') AS department_name
        FROM attendance a
        INNER JOIN employees e ON e.id = a.employee_id
        LEFT JOIN departments d ON d.id = e.department_id
        ${whereClause}
        ORDER BY a.attendance_date DESC, e.full_name ASC`
      )
      .all(...params) as Array<{ status: string }>;

    let presentDays = 0;
    let absentDays = 0;
    let lateDays = 0;
    let onLeaveDays = 0;

    for (const r of records) {
      if (r.status === 'Present') presentDays++;
      else if (r.status === 'Absent') absentDays++;
      else if (r.status === 'Late') lateDays++;
      else if (r.status === 'On Leave') onLeaveDays++;
    }

    const totalRecords = records.length;
    const attendancePercentage =
      totalRecords > 0 ? Number((((presentDays + lateDays) / totalRecords) * 100).toFixed(1)) : 0;

    res.json({
      success: true,
      data: {
        summary: {
          totalRecords,
          presentDays,
          absentDays,
          lateDays,
          onLeaveDays,
          attendancePercentage
        },
        records
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

export default router;
