import express, { type Response } from 'express';
import { db } from '../database.ts';
import { requireAuth, type AuthedRequest } from '../middleware/auth.ts';

const router = express.Router();
router.use(requireAuth);

const VALID_GENDERS = new Set(['Male', 'Female', 'Other']);
const VALID_STATUSES = new Set(['Active', 'Inactive', 'On Leave']);

function generateNextEmployeeCode(): string {
  const rows = db.prepare("SELECT employee_code FROM employees WHERE employee_code LIKE 'EMP-%'").all() as Array<{
    employee_code: string;
  }>;
  let maxNum = 1000;
  for (const row of rows) {
    const match = row.employee_code.match(/^EMP-(\d+)$/);
    if (match) {
      const num = Number.parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `EMP-${maxNum + 1}`;
}

router.get('/next-code', (_req: AuthedRequest, res: Response) => {
  res.json({ success: true, data: { employee_code: generateNextEmployeeCode() } });
});

router.get('/', (req: AuthedRequest, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const departmentId = typeof req.query.department_id === 'string' ? req.query.department_id.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      const term = `%${search}%`;
      conditions.push(
        '(e.full_name LIKE ? OR e.employee_code LIKE ? OR e.email LIKE ? OR e.designation LIKE ? OR e.phone LIKE ?)'
      );
      params.push(term, term, term, term, term);
    }

    if (departmentId) {
      conditions.push('e.department_id = ?');
      params.push(Number(departmentId));
    }

    if (status) {
      conditions.push('e.status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const employees = db
      .prepare(
        `SELECT e.*, COALESCE(d.name, 'Unassigned') AS department_name
         FROM employees e
         LEFT JOIN departments d ON d.id = e.department_id
         ${whereClause}
         ORDER BY e.id DESC`
      )
      .all(...params);

    res.json({ success: true, data: employees });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.get('/:id', (req: AuthedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ success: false, message: 'Invalid employee ID.' });
      return;
    }

    const employee = db
      .prepare(
        `SELECT e.*, COALESCE(d.name, 'Unassigned') AS department_name
         FROM employees e
         LEFT JOIN departments d ON d.id = e.department_id
         WHERE e.id = ?`
      )
      .get(id);

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    const stats = db
      .prepare(
        `SELECT
          COUNT(*) AS total_records,
          COALESCE(SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END), 0) AS present_days,
          COALESCE(SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END), 0) AS late_days,
          COALESCE(SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END), 0) AS absent_days,
          COALESCE(SUM(CASE WHEN status = 'On Leave' THEN 1 ELSE 0 END), 0) AS leave_days
        FROM attendance
        WHERE employee_id = ?`
      )
      .get(id);

    const recentAttendance = db
      .prepare('SELECT * FROM attendance WHERE employee_id = ? ORDER BY attendance_date DESC LIMIT 12')
      .all(id);

    res.json({
      success: true,
      data: { employee, stats, recentAttendance }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.post('/', (req: AuthedRequest, res: Response) => {
  try {
    const rawCode = String(req.body?.employee_code || '').trim().toUpperCase();
    const fullName = String(req.body?.full_name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const departmentId = req.body?.department_id ? Number(req.body.department_id) : null;
    const designation = String(req.body?.designation || '').trim();
    const joiningDate = String(req.body?.joining_date || '').trim();
    const gender = String(req.body?.gender || '').trim();
    const status = String(req.body?.status || 'Active').trim();

    if (!fullName || !email || !phone || !designation || !joiningDate || !gender) {
      res.status(400).json({
        success: false,
        message: 'Full name, email, phone, designation, joining date, and gender are required.'
      });
      return;
    }

    if (!VALID_GENDERS.has(gender) || !VALID_STATUSES.has(status)) {
      res.status(400).json({ success: false, message: 'Invalid gender or status value.' });
      return;
    }

    const employeeCode = rawCode || generateNextEmployeeCode();

    if (db.prepare('SELECT id FROM employees WHERE employee_code = ?').get(employeeCode)) {
      res.status(409).json({ success: false, message: 'Employee ID already exists.' });
      return;
    }

    if (db.prepare('SELECT id FROM employees WHERE LOWER(email) = LOWER(?)').get(email)) {
      res.status(409).json({ success: false, message: 'Email is already registered to another employee.' });
      return;
    }

    if (departmentId !== null) {
      const dept = db.prepare('SELECT id FROM departments WHERE id = ?').get(departmentId);
      if (!dept) {
        res.status(400).json({ success: false, message: 'Selected department does not exist.' });
        return;
      }
    }

    const result = db
      .prepare(
        `INSERT INTO employees (employee_code, full_name, email, phone, department_id, designation, joining_date, gender, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(employeeCode, fullName, email, phone, departmentId, designation, joiningDate, gender, status);

    const created = db
      .prepare(
        `SELECT e.*, COALESCE(d.name, 'Unassigned') AS department_name
         FROM employees e
         LEFT JOIN departments d ON d.id = e.department_id
         WHERE e.id = ?`
      )
      .get(result.lastInsertRowid);

    res.status(201).json({ success: true, message: 'Employee added successfully.', data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.put('/:id', (req: AuthedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as
      | { employee_code: string; status: string }
      | undefined;

    if (!existing) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    const employeeCode = String(req.body?.employee_code || existing.employee_code).trim().toUpperCase();
    const fullName = String(req.body?.full_name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const departmentId = req.body?.department_id ? Number(req.body.department_id) : null;
    const designation = String(req.body?.designation || '').trim();
    const joiningDate = String(req.body?.joining_date || '').trim();
    const gender = String(req.body?.gender || '').trim();
    const status = String(req.body?.status || existing.status).trim();

    if (!fullName || !email || !phone || !designation || !joiningDate || !gender) {
      res.status(400).json({ success: false, message: 'All required employee fields must be provided.' });
      return;
    }

    if (!VALID_GENDERS.has(gender) || !VALID_STATUSES.has(status)) {
      res.status(400).json({ success: false, message: 'Invalid gender or status value.' });
      return;
    }

    if (db.prepare('SELECT id FROM employees WHERE employee_code = ? AND id != ?').get(employeeCode, id)) {
      res.status(409).json({ success: false, message: 'Employee ID is already in use by another employee.' });
      return;
    }

    if (db.prepare('SELECT id FROM employees WHERE LOWER(email) = LOWER(?) AND id != ?').get(email, id)) {
      res.status(409).json({ success: false, message: 'Email is already in use by another employee.' });
      return;
    }

    db.prepare(
      `UPDATE employees
       SET employee_code = ?, full_name = ?, email = ?, phone = ?, department_id = ?,
           designation = ?, joining_date = ?, gender = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(employeeCode, fullName, email, phone, departmentId, designation, joiningDate, gender, status, id);

    const updated = db
      .prepare(
        `SELECT e.*, COALESCE(d.name, 'Unassigned') AS department_name
         FROM employees e
         LEFT JOIN departments d ON d.id = e.department_id
         WHERE e.id = ?`
      )
      .get(id);

    res.json({ success: true, message: 'Employee updated successfully.', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.delete('/:id', (req: AuthedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT id FROM employees WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }
    db.prepare('DELETE FROM employees WHERE id = ?').run(id);
    res.json({ success: true, message: 'Employee deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

export default router;
