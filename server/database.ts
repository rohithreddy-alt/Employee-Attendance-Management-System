import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const rawDbPath = process.env.DB_PATH || './database/attendance.db';
const dbPath = path.resolve(process.cwd(), rawDbPath);
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayISO(): string {
  return formatDateISO(new Date());
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Administrator',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      manager_name TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      designation TEXT NOT NULL,
      joining_date TEXT NOT NULL,
      gender TEXT NOT NULL CHECK(gender IN ('Male', 'Female', 'Other')),
      status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive', 'On Leave')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      attendance_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Present', 'Absent', 'Late', 'On Leave')),
      check_in TEXT DEFAULT '',
      check_out TEXT DEFAULT '',
      remarks TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employee_id, attendance_date)
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      company_name TEXT NOT NULL DEFAULT 'AttendPro Technologies',
      company_email TEXT DEFAULT 'hr@attendpro.com',
      company_phone TEXT DEFAULT '+1 (555) 234-8910',
      company_address TEXT DEFAULT '450 Innovation Drive, Suite 400, San Francisco, CA',
      office_start_time TEXT NOT NULL DEFAULT '09:00',
      office_end_time TEXT NOT NULL DEFAULT '17:30',
      late_grace_minutes INTEGER NOT NULL DEFAULT 15,
      working_days TEXT NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
    CREATE INDEX IF NOT EXISTS idx_attendance_emp ON attendance(employee_id);
    CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(expires_at);
  `);

  seedInitialData();
}

function seedInitialData(): void {
  const existingSettings = db.prepare('SELECT id FROM settings WHERE id = 1').get();
  if (!existingSettings) {
    db.prepare(
      `INSERT INTO settings (id, company_name, company_email, company_phone, company_address, office_start_time, office_end_time, late_grace_minutes, working_days)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'AttendPro Technologies',
      'hr@attendpro.com',
      '+1 (555) 234-8910',
      '450 Innovation Drive, Suite 400, San Francisco, CA',
      '09:00',
      '17:30',
      15,
      'Mon,Tue,Wed,Thu,Fri'
    );
  }

  const deptCount = db.prepare('SELECT COUNT(*) AS count FROM departments').get() as { count: number };
  if (deptCount.count === 0) {
    const insertDept = db.prepare(
      'INSERT INTO departments (name, code, description, manager_name) VALUES (?, ?, ?, ?)'
    );
    const departments = [
      ['Engineering', 'ENG', 'Software engineering, QA, and cloud platform infrastructure', 'Sarah Jenkins'],
      ['Human Resources', 'HR', 'Talent acquisition, onboarding, and employee relations', 'David Chen'],
      ['Sales & Marketing', 'SLS', 'Revenue operations, enterprise sales, and brand growth', 'Rachel Adams'],
      ['Finance', 'FIN', 'Accounting, payroll, budgeting, and compliance', 'Michael Brooks'],
      ['Product & Design', 'PRD', 'Product strategy, UX research, and interface design', 'Elena Rostova'],
      ['Operations', 'OPS', 'Business operations, IT support, and workplace facilities', 'Marcus Vance']
    ];
    for (const dept of departments) {
      insertDept.run(...dept);
    }
  }

  const empCount = db.prepare('SELECT COUNT(*) AS count FROM employees').get() as { count: number };
  if (empCount.count === 0) {
    const depts = db.prepare('SELECT id, code FROM departments').all() as Array<{ id: number; code: string }>;
    const deptMap: Record<string, number> = {};
    for (const d of depts) {
      deptMap[d.code] = d.id;
    }

    const insertEmp = db.prepare(
      `INSERT INTO employees (employee_code, full_name, email, phone, department_id, designation, joining_date, gender, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const sampleEmployees = [
      ['EMP-1001', 'Sarah Jenkins', 'sarah.jenkins@attendpro.com', '+1 555-101-2001', deptMap.ENG, 'Engineering Manager', '2022-03-14', 'Female', 'Active'],
      ['EMP-1002', 'Liam OConnor', 'liam.oconnor@attendpro.com', '+1 555-101-2002', deptMap.ENG, 'Senior Backend Engineer', '2022-07-01', 'Male', 'Active'],
      ['EMP-1003', 'Priya Patel', 'priya.patel@attendpro.com', '+1 555-101-2003', deptMap.ENG, 'Frontend Engineer', '2023-01-16', 'Female', 'Active'],
      ['EMP-1004', 'David Chen', 'david.chen@attendpro.com', '+1 555-101-2004', deptMap.HR, 'HR Director', '2021-11-08', 'Male', 'Active'],
      ['EMP-1005', 'Rachel Adams', 'rachel.adams@attendpro.com', '+1 555-101-2005', deptMap.SLS, 'Account Executive', '2023-04-03', 'Female', 'Active'],
      ['EMP-1006', 'Noah Martinez', 'noah.martinez@attendpro.com', '+1 555-101-2006', deptMap.SLS, 'Growth Strategist', '2023-06-19', 'Male', 'Active'],
      ['EMP-1007', 'Michael Brooks', 'michael.brooks@attendpro.com', '+1 555-101-2007', deptMap.FIN, 'Financial Controller', '2022-01-10', 'Male', 'Active'],
      ['EMP-1008', 'Elena Rostova', 'elena.rostova@attendpro.com', '+1 555-101-2008', deptMap.PRD, 'Lead UX Designer', '2022-09-12', 'Female', 'Active'],
      ['EMP-1009', 'Marcus Vance', 'marcus.vance@attendpro.com', '+1 555-101-2009', deptMap.OPS, 'Operations Specialist', '2023-08-21', 'Male', 'Active'],
      ['EMP-1010', 'Sophia Kim', 'sophia.kim@attendpro.com', '+1 555-101-2010', deptMap.PRD, 'Product Manager', '2024-01-08', 'Female', 'Active'],
      ['EMP-1011', 'Ethan Wright', 'ethan.wright@attendpro.com', '+1 555-101-2011', deptMap.ENG, 'DevOps Engineer', '2024-03-11', 'Male', 'Active'],
      ['EMP-1012', 'Maya Lin', 'maya.lin@attendpro.com', '+1 555-101-2012', deptMap.FIN, 'Payroll Analyst', '2024-05-20', 'Female', 'On Leave']
    ];

    for (const emp of sampleEmployees) {
      insertEmp.run(...emp);
    }

    const employees = db.prepare('SELECT id FROM employees ORDER BY id ASC').all() as Array<{ id: number }>;
    const insertAtt = db.prepare(
      `INSERT OR IGNORE INTO attendance (employee_id, attendance_date, status, check_in, check_out, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const patterns: Array<[string, string, string, string]> = [
      ['Present', '08:52', '17:32', 'On time'],
      ['Present', '08:57', '17:35', ''],
      ['Present', '09:04', '17:40', ''],
      ['Late', '09:26', '17:48', 'Morning transit delay'],
      ['Present', '08:48', '17:30', ''],
      ['Absent', '', '', 'Personal day'],
      ['Present', '09:02', '17:31', ''],
      ['Present', '08:55', '17:36', ''],
      ['Late', '09:21', '17:45', 'Traffic delay'],
      ['Present', '08:59', '17:34', ''],
      ['Present', '09:01', '17:38', ''],
      ['On Leave', '', '', 'Approved PTO']
    ];

    const today = new Date();
    const seedTransaction = db.transaction(() => {
      for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
        const d = new Date(today);
        d.setDate(today.getDate() - dayOffset);
        const dow = d.getDay();
        if (dow === 0 || dow === 6) continue;
        const dateStr = formatDateISO(d);

        for (let i = 0; i < employees.length; i++) {
          // Leave 2 employees unmarked today so the user can test live marking immediately
          if (dayOffset === 0 && i >= employees.length - 2) continue;
          const patternIdx = (i + dayOffset) % patterns.length;
          const [status, checkIn, checkOut, remarks] = patterns[patternIdx];
          insertAtt.run(employees[i].id, dateStr, status, checkIn, checkOut, remarks);
        }
      }
    });
    seedTransaction();
  }
}
