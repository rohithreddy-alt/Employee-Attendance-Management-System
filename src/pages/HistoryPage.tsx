import { useCallback, useEffect, useState } from 'react';
import StatusBadge from '../components/StatusBadge.tsx';
import { apiRequest, daysAgoISO, getTodayISO } from '../lib/api.ts';
import type { AttendanceRecord, Employee } from '../types.ts';

interface HistoryPageProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface HistoryResponse {
  summary: {
    totalRecords: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    onLeaveDays: number;
    attendancePercentage: number;
  };
  records: AttendanceRecord[];
}

export default function HistoryPage({ onNotify }: HistoryPageProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [startDate, setStartDate] = useState(daysAgoISO(30));
  const [endDate, setEndDate] = useState(getTodayISO());
  const [status, setStatus] = useState('');

  const [data, setData] = useState<HistoryResponse>({
    summary: {
      totalRecords: 0,
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
      onLeaveDays: 0,
      attendancePercentage: 0
    },
    records: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ success: boolean; data: Employee[] }>('/api/employees')
      .then((res) => setEmployees(res.data || []))
      .catch((err) => onNotify((err as Error).message, 'error'));
  }, [onNotify]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (employeeId) params.append('employee_id', employeeId);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (status) params.append('status', status);

      const res = await apiRequest<{ success: boolean; data: HistoryResponse }>(
        `/api/attendance/history?${params.toString()}`
      );
      setData(res.data);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [employeeId, startDate, endDate, status, onNotify]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  function handleReset() {
    setEmployeeId('');
    setStartDate(daysAgoISO(30));
    setEndDate(getTodayISO());
    setStatus('');
  }

  const { summary, records } = data;

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none min-w-[220px]"
          >
            <option value="">All Employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employee_code} — {e.full_name}
              </option>
            ))}
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
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Absent">Absent</option>
            <option value="On Leave">On Leave</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          Reset Filters
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">Total Present Days</div>
            <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-num tabular-nums">
              {summary.presentDays}
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <i className="fa-solid fa-check" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">Total Absent Days</div>
            <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-num tabular-nums">
              {summary.absentDays}
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
            <i className="fa-solid fa-xmark" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">Total Late Days</div>
            <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-num tabular-nums">
              {summary.lateDays}
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <i className="fa-regular fa-clock" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">Attendance Percentage</div>
            <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-num tabular-nums">
              {summary.attendancePercentage}%
            </div>
            <div className="mt-1 text-xs text-slate-500 tabular-nums">{summary.totalRecords} Total records</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <i className="fa-solid fa-percent" />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">Attendance History Logs</h2>
          <span className="text-xs text-slate-500 tabular-nums">
            {summary.onLeaveDays} On Leave · {records.length} rows
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Employee ID</th>
                <th className="px-4 py-3 font-semibold">Employee Name</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Check-In</th>
                <th className="px-4 py-3 font-semibold">Check-Out</th>
                <th className="px-4 py-3 font-semibold">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-4 py-3.5">
                      <div className="h-5 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                    No attendance logs found for the selected filters.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono-num tabular-nums text-xs font-semibold text-slate-800 whitespace-nowrap">
                      {r.attendance_date}
                    </td>
                    <td className="px-4 py-3 font-mono-num tabular-nums text-xs text-slate-600 whitespace-nowrap">
                      {r.employee_code}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.full_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.department_name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 font-mono-num tabular-nums text-xs text-slate-700">
                      {r.check_in || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono-num tabular-nums text-xs text-slate-700">
                      {r.check_out || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.remarks || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
