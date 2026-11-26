export type PageKey =
  | 'dashboard'
  | 'employees'
  | 'attendance'
  | 'history'
  | 'reports'
  | 'departments'
  | 'settings';

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'On Leave';
export type EmployeeStatus = 'Active' | 'Inactive' | 'On Leave';
export type Gender = 'Male' | 'Female' | 'Other';

export interface AdminUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
  created_at?: string;
}

export interface CompanySettings {
  id?: number;
  company_name: string;
  company_email: string;
  company_phone: string;
  company_address: string;
  office_start_time: string;
  office_end_time: string;
  late_grace_minutes: number;
  working_days: string;
}

export interface Department {
  id: number;
  name: string;
  code: string;
  description: string;
  manager_name: string;
  employee_count: number;
  created_at?: string;
}

export interface Employee {
  id: number;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string;
  department_id: number | null;
  department_name: string;
  designation: string;
  joining_date: string;
  gender: Gender;
  status: EmployeeStatus;
  created_at?: string;
}

export interface AttendanceSheetRow {
  employee_id: number;
  employee_code: string;
  full_name: string;
  designation: string;
  department_id: number | null;
  department_name: string;
  attendance_id: number | null;
  attendance_date: string;
  status: AttendanceStatus | null;
  check_in: string;
  check_out: string;
  remarks: string;
}

export interface AttendanceRecord {
  id: number;
  employee_id: number;
  employee_code: string;
  full_name: string;
  designation: string;
  department_name: string;
  attendance_date: string;
  status: AttendanceStatus;
  check_in: string;
  check_out: string;
  remarks: string;
}

export interface DashboardStats {
  date: string;
  summary: {
    totalEmployees: number;
    activeEmployees: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
    onLeaveToday: number;
    unmarkedToday: number;
    attendancePercentage: number;
  };
  monthlyTrend: Array<{
    date: string;
    present: number;
    absent: number;
    late: number;
    on_leave: number;
  }>;
  departmentBreakdown: Array<{
    id: number;
    department_name: string;
    department_code: string;
    total_employees: number;
    present_count: number;
    late_count: number;
    absent_count: number;
    leave_count: number;
  }>;
  recentActivity: AttendanceRecord[];
}

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}
