import { useCallback, useEffect, useState } from 'react';
import StatusBadge from '../components/StatusBadge.tsx';
import { apiRequest, daysAgoISO, downloadReportCsv, getTodayISO } from '../lib/api.ts';
import type { Department, Employee } from '../types.ts';

interface ReportsPageProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

type ReportType = 'daily' | 'weekly' | 'monthly' | 'employee' | 'department';

interface ReportData {
  type: ReportType;
  startDate: string;
  endDate: string;
  rows: Array<Record<string, unknown>>;
}

export default function ReportsPage({ onNotify }: ReportsPageProps) {
  const [reportType, setReportType] = useState<ReportType>('monthly');
  const [startDate, setStartDate] = useState(daysAgoISO(29));
  const [endDate, setEndDate] = useState(getTodayISO());
  const [deptFilter, setDeptFilter] = useState('');
  const [empFilter, setEmpFilter] = useState('');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiRequest<{ success: boolean; data: Department[] }>('/api/departments'),
      apiRequest<{ success: boolean; data: Employee[] }>('/api/employees')
    ])
      .then(([dRes, eRes]) => {
        setDepartments(dRes.data || []);
        setEmployees(eRes.data || []);
      })
      .catch((err) => onNotify((err as Error).message, 'error'));
  }, [onNotify]);

  function buildQueryParams(
    typeOverride?: ReportType,
    startOverride?: string,
    endOverride?: string
  ): URLSearchParams {
    const params = new URLSearchParams({
      type: typeOverride || reportType,
      start_date: startOverride || startDate,
      end_date: endOverride || endDate
    });
    if (deptFilter) params.append('department_id', deptFilter);
    if (empFilter) params.append('employee_id', empFilter);
    return params;
  }

  const loadReport = useCallback(
    async (typeOverride?: ReportType, startOverride?: string, endOverride?: string) => {
      setLoading(true);
      try {
        const params = buildQueryParams(typeOverride, startOverride, endOverride);
        const res = await apiRequest<{ success: boolean; data: ReportData }>(
          `/api/reports?${params.toString()}`
        );
        setReport(res.data);
      } catch (err) {
        onNotify((err as Error).message, 'error');
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reportType, startDate, endDate, deptFilter, empFilter, onNotify]
  );

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  function handleTypeChange(nextType: ReportType) {
    const today = getTodayISO();
    let nextStart = daysAgoISO(29);
    if (nextType === 'daily') nextStart = today;
    else if (nextType === 'weekly') nextStart = daysAgoISO(6);

    setReportType(nextType);
    setStartDate(nextStart);
    setEndDate(today);
    loadReport(nextType, nextStart, today);
  }

  async function handleExportCSV() {
    setExporting(true);
    try {
      const params = buildQueryParams();
      await downloadReportCsv(params.toString());
      onNotify('CSV report downloaded.', 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setExporting(false);
    }
  }

  const titles: Record<ReportType, string> = {
    daily: 'Daily Attendance Report',
    weekly: 'Weekly Attendance Report',
    monthly: 'Monthly Attendance Report',
    employee: 'Employee-Wise Attendance Summary',
    department: 'Department-Wise Attendance Summary'
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <select
            value={reportType}
            onChange={(e) => handleTypeChange(e.target.value as ReportType)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            <option value="daily">Daily Attendance Report</option>
            <option value="weekly">Weekly Attendance Report</option>
            <option value="monthly">Monthly Attendance Report</option>
            <option value="employee">Employee-Wise Report</option>
            <option value="department">Department-Wise Report</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Start date"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono-num text-slate-700 focus:border-blue-600 focus:outline-none"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="End date"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono-num text-slate-700 focus:border-blue-600 focus:outline-none"
          />

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {reportType !== 'department' && (
            <select
              value={empFilter}
              onChange={(e) => setEmpFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none"
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employee_code} — {emp.full_name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 whitespace-nowrap cursor-pointer"
          >
            <i className="fa-solid fa-file-csv" aria-hidden="true" />
            <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
          >
            <i className="fa-solid fa-print" aria-hidden="true" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Report Table Card */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{titles[report?.type || reportType]}</h2>
            <p className="text-xs text-slate-500 font-mono-num tabular-nums">
              Period: {report?.startDate || startDate} to {report?.endDate || endDate}
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono-num tabular-nums">
            {report?.rows.length || 0} row(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-6 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : !report || report.rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">
              No attendance data found for the selected report parameters.
            </div>
          ) : report.type === 'employee' ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Employee ID</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-4 py-3 font-semibold">Designation</th>
                  <th className="px-3 py-3 font-semibold text-right">Days</th>
                  <th className="px-3 py-3 font-semibold text-right">Present</th>
                  <th className="px-3 py-3 font-semibold text-right">Late</th>
                  <th className="px-3 py-3 font-semibold text-right">Absent</th>
                  <th className="px-3 py-3 font-semibold text-right">Leave</th>
                  <th className="px-4 py-3 font-semibold text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono-num text-xs font-semibold text-slate-800">
                      {String(r.employee_code)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{String(r.full_name)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{String(r.department_name)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{String(r.designation)}</td>
                    <td className="px-3 py-3 text-right font-mono-num tabular-nums text-xs">{String(r.total_days)}</td>
                    <td className="px-3 py-3 text-right font-mono-num tabular-nums text-xs font-semibold text-emerald-700">
                      {String(r.present_days)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono-num tabular-nums text-xs font-semibold text-amber-700">
                      {String(r.late_days)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono-num tabular-nums text-xs font-semibold text-rose-700">
                      {String(r.absent_days)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono-num tabular-nums text-xs font-semibold text-sky-700">
                      {String(r.leave_days)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num tabular-nums text-xs font-bold text-slate-900">
                      {String(r.attendance_percentage)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : report.type === 'department' ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-3 py-3 font-semibold text-right">Employees</th>
                  <th className="px-3 py-3 font-semibold text-right">Logs</th>
                  <th className="px-3 py-3 font-semibold text-right">Present</th>
                  <th className="px-3 py-3 font-semibold text-right">Late</th>
                  <th className="px-3 py-3 font-semibold text-right">Absent</th>
                  <th className="px-3 py-3 font-semibold text-right">Leave</th>
                  <th className="px-4 py-3 font-semibold text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono-num text-xs font-semibold text-blue-700">
                      {String(r.department_code)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{String(r.department_name)}</td>
                    <td className="px-3 py-3 text-right font-mono-num tabular-nums text-xs">
                      {String(r.total_employees)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono-num tabular-nums text-xs">
                      {String(r.total_records)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono-num tabular-nums text-xs font-semibold text-emerald-700">
                      {String(r.present_days)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono-num tabular-nums text-xs font-semibold text-amber-700">
                      {String(r.late_days)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono-num tabular-nums text-xs font-semibold text-rose-700">
                      {String(r.absent_days)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono-num tabular-nums text-xs font-semibold text-sky-700">
                      {String(r.leave_days)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num tabular-nums text-xs font-bold text-slate-900">
                      {String(r.attendance_percentage)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Employee ID</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Check-In</th>
                  <th className="px-4 py-3 font-semibold">Check-Out</th>
                  <th className="px-4 py-3 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono-num tabular-nums text-xs font-semibold text-slate-800 whitespace-nowrap">
                      {String(r.attendance_date)}
                    </td>
                    <td className="px-4 py-3 font-mono-num tabular-nums text-xs text-slate-600">
                      {String(r.employee_code)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{String(r.full_name)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{String(r.department_name)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={String(r.status)} />
                    </td>
                    <td className="px-4 py-3 font-mono-num tabular-nums text-xs text-slate-700">
                      {String(r.check_in || '—')}
                    </td>
                    <td className="px-4 py-3 font-mono-num tabular-nums text-xs text-slate-700">
                      {String(r.check_out || '—')}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{String(r.remarks || '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
