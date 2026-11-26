# AttendPro — Employee Attendance Management System

A full-stack **Employee Attendance Management System** built with **React, TypeScript, Tailwind CSS, Node.js, Express, SQLite (`better-sqlite3`), Chart.js, and Font Awesome**.

## Key Features
- **Authentication & Sessions**: First-run administrator setup (`POST /api/auth/setup`), bcrypt password hashing, SQLite-backed session tokens (`HttpOnly; Secure; SameSite=None; Partitioned` cookies + in-memory `Bearer` headers), password visibility toggle, and 30-day "Remember me" support.
- **Executive Dashboard**: Live KPIs (Total Employees, Present Today, Absent Today, Late Employees, Attendance Rate), 14-day attendance trend bar chart (`Chart.js`), today's distribution doughnut chart, department breakdown, and recent activity logs.
- **Employee Directory**: Full CRUD, auto-generated unique Employee IDs (`EMP-XXXX`), profile inspection modal with individual attendance stats, live search, and department/status filtering.
- **Daily Attendance Sheet**: Mark Present, Late, Absent, or On Leave with one click, bulk mark unmarked employees as Present, edit check-in/out timings and remarks, and enforce duplicate prevention (`UNIQUE(employee_id, attendance_date)`).
- **Attendance History**: Filter by employee, date range, and status with calculated Present, Absent, Late, and Attendance Percentage summaries.
- **Reports & Export**: Daily, Weekly, Monthly, Employee-Wise, and Department-Wise reports with CSV export (with formula-injection protection) and print-ready layout.
- **Department Management**: Add, edit, and delete departments and inspect department-wise staff rosters.
- **System Settings**: Configure company details, office check-in/out timings, late arrival grace period, working days, admin profile, and password rotation.

## Local Installation & Running

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Optionally set `ADMIN_PASSCODE` in `.env`, or leave it blank to initialize your administrator password via the first-run setup screen.
3. **Run in development** (Express + Vite on port `3000`):
   ```bash
   npm run dev
   ```
4. **Build and run in production**:
   ```bash
   npm run build
   npm start
   ```

## GitHub Upload Instructions
```bash
git init
git add .
git commit -m "Initial commit: Employee Attendance Management System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/employee-attendance-system.git
git push -u origin main
```
