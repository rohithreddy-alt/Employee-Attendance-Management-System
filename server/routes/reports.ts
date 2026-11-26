import express, { type Response } from 'express';
import { db, getTodayISO } from '../database.ts';
import { requireAuth, type AuthedRequest } from '../middleware/auth.ts';

const router = express.Router();
router.use(requireAuth);

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildReportData(query: Record<string, unknown>) {
  const type = typeof query.type === 'string' ? query.type : 'daily';
  const endDate = typeof query.end_date === 'string' && query.end_date ? query.end_date : getTodayISO();
  let startDate = typeof query.start_date === 'string' && query.start_date ? query.start_date : '';
  const employeeId = typeof query.employee_id === 'string' ? query.employee_id.trim() : '';
  const departmentId = typeof query.department_id === 'string' ? query.department_id.trim() : '';

  if (!startDate) {
    if (type === 'daily') startDate = endDate;
    else if (type === 'weekly') startDate = daysAgoISO(6);
    else startDate = daysAgoISO(29);
  }

  if (type === 'employee') {
    const conds: string[] = [];
    const params: unknown[] = [startDate, endDate];
    if (employeeId) {
      conds.push('e.id = ?');
      params.push(Number(employeeId));
    }
    if (departmentId) {
      conds.push('e.department_id = ?');
      params.push(Number(departmentId));
    }
    const whereClause = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT
          e.employee_code,
          e.full_name,
          COALESCE(d.name, 'Unassigned') AS department_name,
          e.designation,
          COUNT(a.id) AS total_days,
          COALESCE(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END), 0) AS present_days,
          COALESCE(SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END), 0) AS late_days,
          COALESCE(SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END), 0) AS absent_days,
          COALESCE(SUM(CASE WHEN a.status = 'On Leave' THEN 1 ELSE 0 END), 0) AS leave_days
        FROM employees e
        LEFT JOIN departments d ON d.id = e.department_id
        LEFT JOIN attendance a ON a.employee_id = e.id AND a.attendance_date BETWEEN ? AND ?
        ${whereClause}
        GROUP BY e.id
        ORDER BY e.employee_code ASC`
      )
      .all(...params) as Array<Record<string, unknown> & { total_days: number; present_days: number; late_days: number }>;

    const formatted = rows.map((r) => ({
      ...r,
      attendance_percentage:
        r.total_days > 0 ? Number((((r.present_days + r.late_days) / r.total_days) * 100).toFixed(1)) : 0
    }));

    return { type, startDate, endDate, rows: formatted };
  }

  if (type === 'department') {
    const conds: string[] = [];
    const params: unknown[] = [startDate, endDate];
    if (departmentId) {
      conds.push('d.id = ?');
      params.push(Number(departmentId));
    }
    const whereClause = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT
          d.code AS department_code,
          d.name AS department_name,
          COUNT(DISTINCT e.id) AS total_employees,
          COUNT(a.id) AS total_records,
          COALESCE(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END), 0) AS present_days,
          COALESCE(SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END), 0) AS late_days,
          COALESCE(SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END), 0) AS absent_days,
          COALESCE(SUM(CASE WHEN a.status = 'On Leave' THEN 1 ELSE 0 END), 0) AS leave_days
        FROM departments d
        LEFT JOIN employees e ON e.department_id = d.id
        LEFT JOIN attendance a ON a.employee_id = e.id AND a.attendance_date BETWEEN ? AND ?
        ${whereClause}
        GROUP BY d.id
        ORDER BY d.name ASC`
      )
      .all(...params) as Array<
      Record<string, unknown> & { total_records: number; present_days: number; late_days: number }
    >;

    const formatted = rows.map((r) => ({
      ...r,
      attendance_percentage:
        r.total_records > 0 ? Number((((r.present_days + r.late_days) / r.total_records) * 100).toFixed(1)) : 0
    }));

    return { type, startDate, endDate, rows: formatted };
  }

  const conds = ['a.attendance_date BETWEEN ? AND ?'];
  const params: unknown[] = [startDate, endDate];
  if (employeeId) {
    conds.push('e.id = ?');
    params.push(Number(employeeId));
  }
  if (departmentId) {
    conds.push('e.department_id = ?');
    params.push(Number(departmentId));
  }

  const rows = db
    .prepare(
      `SELECT
        a.attendance_date,
        e.employee_code,
        e.full_name,
        COALESCE(d.name, 'Unassigned') AS department_name,
        e.designation,
        a.status,
        a.check_in,
        a.check_out,
        a.remarks
      FROM attendance a
      INNER JOIN employees e ON e.id = a.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE ${conds.join(' AND ')}
      ORDER BY a.attendance_date DESC, e.employee_code ASC`
    )
    .all(...params);

  return { type, startDate, endDate, rows };
}

function csvEscape(value: unknown): string {
  let str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

router.get('/', (req: AuthedRequest, res: Response) => {
  try {
    const report = buildReportData(req.query as Record<string, unknown>);
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.get('/export', (req: AuthedRequest, res: Response) => {
  try {
    const report = buildReportData(req.query as Record<string, unknown>);
    let headers: string[] = [];
    let csvRows: unknown[][] = [];

    if (report.type === 'employee') {
      headers = [
        'Employee ID',
        'Employee Name',
        'Department',
        'Designation',
        'Total Days',
        'Present',
        'Late',
        'Absent',
        'On Leave',
        'Attendance %'
      ];
      csvRows = (report.rows as Array<Record<string, unknown>>).map((r) => [
        r.employee_code,
        r.full_name,
        r.department_name,
        r.designation,
        r.total_days,
        r.present_days,
        r.late_days,
        r.absent_days,
        r.leave_days,
        `${r.attendance_percentage}%`
      ]);
    } else if (report.type === 'department') {
      headers = [
        'Department Code',
        'Department',
        'Employees',
        'Total Logs',
        'Present',
        'Late',
        'Absent',
        'On Leave',
        'Attendance %'
      ];
      csvRows = (report.rows as Array<Record<string, unknown>>).map((r) => [
        r.department_code,
        r.department_name,
        r.total_employees,
        r.total_records,
        r.present_days,
        r.late_days,
        r.absent_days,
        r.leave_days,
        `${r.attendance_percentage}%`
      ]);
    } else {
      headers = [
        'Date',
        'Employee ID',
        'Employee Name',
        'Department',
        'Designation',
        'Status',
        'Check-In',
        'Check-Out',
        'Remarks'
      ];
      csvRows = (report.rows as Array<Record<string, unknown>>).map((r) => [
        r.attendance_date,
        r.employee_code,
        r.full_name,
        r.department_name,
        r.designation,
        r.status,
        r.check_in || '-',
        r.check_out || '-',
        r.remarks || ''
      ]);
    }

    const csvContent = [
      headers.map(csvEscape).join(','),
      ...csvRows.map((row) => row.map(csvEscape).join(','))
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="attendance-${report.type}-report-${report.startDate}-to-${report.endDate}.csv"`
    );
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

export default router;
