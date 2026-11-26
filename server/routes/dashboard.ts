import express, { type Response } from 'express';
import { db, getTodayISO } from '../database.ts';
import { requireAuth, type AuthedRequest } from '../middleware/auth.ts';

const router = express.Router();
router.use(requireAuth);

router.get('/stats', (req: AuthedRequest, res: Response) => {
  try {
    const today = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : getTodayISO();

    const totalEmpRow = db.prepare('SELECT COUNT(*) AS total FROM employees').get() as { total: number };
    const activeEmpRow = db
      .prepare("SELECT COUNT(*) AS active FROM employees WHERE status = 'Active'")
      .get() as { active: number };

    const totalEmployees = totalEmpRow.total || 0;
    const activeEmployees = activeEmpRow.active || 0;

    const todayCounts = db
      .prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END), 0) AS presentToday,
          COALESCE(SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END), 0) AS absentToday,
          COALESCE(SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END), 0) AS lateToday,
          COALESCE(SUM(CASE WHEN status = 'On Leave' THEN 1 ELSE 0 END), 0) AS onLeaveToday,
          COUNT(*) AS markedToday
        FROM attendance
        WHERE attendance_date = ?`
      )
      .get(today) as {
      presentToday: number;
      absentToday: number;
      lateToday: number;
      onLeaveToday: number;
      markedToday: number;
    };

    const presentToday = todayCounts.presentToday || 0;
    const absentToday = todayCounts.absentToday || 0;
    const lateToday = todayCounts.lateToday || 0;
    const onLeaveToday = todayCounts.onLeaveToday || 0;
    const markedToday = todayCounts.markedToday || 0;
    const unmarkedToday = Math.max(0, activeEmployees - markedToday);

    const denominator = activeEmployees > 0 ? activeEmployees : totalEmployees;
    const attendancePercentage =
      denominator > 0 ? Number((((presentToday + lateToday) / denominator) * 100).toFixed(1)) : 0;

    const startDateObj = new Date(`${today}T00:00:00`);
    startDateObj.setDate(startDateObj.getDate() - 13);
    const startDate = `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}-${String(startDateObj.getDate()).padStart(2, '0')}`;

    const monthlyTrend = db
      .prepare(
        `SELECT
          attendance_date AS date,
          SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
          SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) AS absent,
          SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) AS late,
          SUM(CASE WHEN status = 'On Leave' THEN 1 ELSE 0 END) AS on_leave
        FROM attendance
        WHERE attendance_date BETWEEN ? AND ?
        GROUP BY attendance_date
        ORDER BY attendance_date ASC`
      )
      .all(startDate, today);

    const departmentBreakdown = db
      .prepare(
        `SELECT
          d.id,
          d.name AS department_name,
          d.code AS department_code,
          COUNT(DISTINCT e.id) AS total_employees,
          COALESCE(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END), 0) AS present_count,
          COALESCE(SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END), 0) AS late_count,
          COALESCE(SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END), 0) AS absent_count,
          COALESCE(SUM(CASE WHEN a.status = 'On Leave' THEN 1 ELSE 0 END), 0) AS leave_count
        FROM departments d
        LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'Active'
        LEFT JOIN attendance a ON a.employee_id = e.id AND a.attendance_date = ?
        GROUP BY d.id
        ORDER BY d.name ASC`
      )
      .all(today);

    const recentActivity = db
      .prepare(
        `SELECT
          a.id,
          a.attendance_date,
          a.status,
          a.check_in,
          a.check_out,
          a.remarks,
          a.updated_at,
          e.employee_code,
          e.full_name,
          e.designation,
          COALESCE(d.name, 'Unassigned') AS department_name
        FROM attendance a
        INNER JOIN employees e ON e.id = a.employee_id
        LEFT JOIN departments d ON d.id = e.department_id
        ORDER BY a.attendance_date DESC, a.updated_at DESC, a.id DESC
        LIMIT 8`
      )
      .all();

    res.json({
      success: true,
      data: {
        date: today,
        summary: {
          totalEmployees,
          activeEmployees,
          presentToday,
          absentToday,
          lateToday,
          onLeaveToday,
          unmarkedToday,
          attendancePercentage
        },
        monthlyTrend,
        departmentBreakdown,
        recentActivity
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

export default router;
