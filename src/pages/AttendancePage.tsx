import { useCallback, useEffect, useState, type FormEvent } from 'react';
import ConfirmModal from '../components/ConfirmModal.tsx';
import StatusBadge from '../components/StatusBadge.tsx';
import { apiRequest, getTodayISO } from '../lib/api.ts';
import type { AttendanceSheetRow, AttendanceStatus, Department } from '../types.ts';

interface AttendancePageProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function AttendancePage({ onNotify }: AttendancePageProps) {
  const [date, setDate] = useState(getTodayISO());
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [records, setRecords] = useState<AttendanceSheetRow[]>([]);
  const [officeSettings, setOfficeSettings] = useState({
    office_start_time: '09:00',
    office_end_time: '17:30'
  });
  const [loading, setLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Modal state
  const [modalRow, setModalRow] = useState<AttendanceSheetRow | null>(null);
  const [modalStatus, setModalStatus] = useState<AttendanceStatus>('Present');
  const [modalCheckIn, setModalCheckIn] = useState('09:00');
  const [modalCheckOut, setModalCheckOut] = useState('17:30');
  const [modalRemarks, setModalRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete entry confirmation
  const [deleteTarget, setDeleteTarget] = useState<AttendanceSheetRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    apiRequest<{ success: boolean; data: Department[] }>('/api/departments')
      .then((res) => setDepartments(res.data || []))
      .catch((err) => onNotify((err as Error).message, 'error'));
  }, [onNotify]);

  const loadDailySheet = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (search.trim()) params.append('search', search.trim());
      if (deptFilter) params.append('department_id', deptFilter);
      if (statusFilter) params.append('status', statusFilter);

      const res = await apiRequest<{
        success: boolean;
        data: {
          date: string;
          settings: { office_start_time: string; office_end_time: string };
          records: AttendanceSheetRow[];
        };
      }>(`/api/attendance/sheet?${params.toString()}`);

      setRecords(res.data.records || []);
      if (res.data.settings) setOfficeSettings(res.data.settings);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [date, search, deptFilter, statusFilter, onNotify]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDailySheet();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadDailySheet]);

  async function quickMark(row: AttendanceSheetRow, nextStatus: AttendanceStatus) {
    const isWorking = nextStatus === 'Present' || nextStatus === 'Late';
    const nowTime = new Date().toTimeString().slice(0, 5);
    try {
      await apiRequest('/api/attendance', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: row.employee_id,
          attendance_date: date,
          status: nextStatus,
          check_in: isWorking ? (nextStatus === 'Present' ? officeSettings.office_start_time : nowTime) : '',
          check_out: isWorking ? officeSettings.office_end_time : '',
          remarks: ''
        })
      });
      onNotify(`${row.full_name} marked as ${nextStatus}.`, 'success');
      await loadDailySheet();
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  }

  async function handleBulkMarkPresent() {
    const unmarkedIds = records.filter((r) => !r.attendance_id).map((r) => r.employee_id);
    if (unmarkedIds.length === 0) {
      onNotify('All listed employees already have attendance marked for this date.', 'info');
      return;
    }

    setBulkLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/api/attendance/bulk', {
        method: 'POST',
        body: JSON.stringify({
          attendance_date: date,
          status: 'Present',
          employee_ids: unmarkedIds,
          check_in: officeSettings.office_start_time || '09:00',
          check_out: officeSettings.office_end_time || '17:30',
          remarks: 'Bulk marked present'
        })
      });
      onNotify(res.message, 'success');
      await loadDailySheet();
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setBulkLoading(false);
    }
  }

  function openModal(row: AttendanceSheetRow) {
    setModalRow(row);
    const initialStatus: AttendanceStatus = row.status || 'Present';
    setModalStatus(initialStatus);
    if (row.attendance_id) {
      setModalCheckIn(row.check_in || '');
      setModalCheckOut(row.check_out || '');
    } else {
      setModalCheckIn(officeSettings.office_start_time || '09:00');
      setModalCheckOut(officeSettings.office_end_time || '17:30');
    }
    setModalRemarks(row.remarks || '');
  }

  function handleStatusChangeInModal(nextStatus: AttendanceStatus) {
    setModalStatus(nextStatus);
    if (nextStatus === 'Absent' || nextStatus === 'On Leave') {
      setModalCheckIn('');
      setModalCheckOut('');
    } else if (!modalCheckIn) {
      setModalCheckIn(officeSettings.office_start_time || '09:00');
      setModalCheckOut(officeSettings.office_end_time || '17:30');
    }
  }

  async function handleModalSubmit(e: FormEvent) {
    e.preventDefault();
    if (!modalRow) return;
    setSaving(true);

    try {
      if (modalRow.attendance_id) {
        await apiRequest(`/api/attendance/${modalRow.attendance_id}`, {
          method: 'PUT',
          body: JSON.stringify({
            status: modalStatus,
            check_in: modalCheckIn,
            check_out: modalCheckOut,
            remarks: modalRemarks.trim()
          })
        });
        onNotify(`Updated attendance for ${modalRow.full_name}.`, 'success');
      } else {
        await apiRequest('/api/attendance', {
          method: 'POST',
          body: JSON.stringify({
            employee_id: modalRow.employee_id,
            attendance_date: date,
            status: modalStatus,
            check_in: modalCheckIn,
            check_out: modalCheckOut,
            remarks: modalRemarks.trim()
          })
        });
        onNotify(`Recorded attendance for ${modalRow.full_name}.`, 'success');
      }
      setModalRow(null);
      await loadDailySheet();
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget?.attendance_id) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/attendance/${deleteTarget.attendance_id}`, { method: 'DELETE' });
      onNotify('Attendance entry removed.', 'success');
      setDeleteTarget(null);
      await loadDailySheet();
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  const markedCount = records.filter((r) => Boolean(r.attendance_id)).length;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono-num text-slate-800 focus:border-blue-600 focus:outline-none"
          />

          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

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

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Absent">Absent</option>
            <option value="On Leave">On Leave</option>
            <option value="Unmarked">Unmarked</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleBulkMarkPresent}
          disabled={bulkLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          <i className="fa-solid fa-check-double" aria-hidden="true" />
          <span>{bulkLoading ? 'Marking...' : 'Mark Unmarked Present'}</span>
        </button>
      </div>

      {/* Daily Sheet Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">
            Daily Attendance Sheet · <span className="font-mono-num">{date}</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono-num tabular-nums">
            {markedCount} / {records.length} marked
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Employee</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Check-In</th>
                <th className="px-4 py-3 font-semibold">Check-Out</th>
                <th className="px-4 py-3 font-semibold">Remarks</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-3.5">
                      <div className="h-5 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                    No active employees match the current filters.
                  </td>
                </tr>
              ) : (
                records.map((row) => (
                  <tr key={row.employee_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{row.full_name}</div>
                      <div className="text-xs text-slate-500">
                        <span className="font-mono-num">{row.employee_code}</span> · {row.designation}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">{row.department_name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 font-mono-num tabular-nums text-xs text-slate-700">
                      {row.check_in || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono-num tabular-nums text-xs text-slate-700">
                      {row.check_out || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px] truncate">
                      {row.remarks || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {row.attendance_id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openModal(row)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap cursor-pointer"
                            >
                              <i className="fa-regular fa-pen-to-square" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(row)}
                              title="Remove entry"
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white cursor-pointer"
                            >
                              <i className="fa-regular fa-trash-can text-xs" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => quickMark(row, 'Present')}
                              className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              onClick={() => quickMark(row, 'Late')}
                              className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-600 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                            >
                              Late
                            </button>
                            <button
                              type="button"
                              onClick={() => quickMark(row, 'Absent')}
                              className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-600 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                            >
                              Absent
                            </button>
                            <button
                              type="button"
                              onClick={() => quickMark(row, 'On Leave')}
                              className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-600 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                            >
                              Leave
                            </button>
                            <button
                              type="button"
                              onClick={() => openModal(row)}
                              title="Custom timings & remarks"
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              <i className="fa-solid fa-sliders text-xs" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mark / Edit Attendance Modal */}
      {modalRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-bold text-slate-900">
                {modalRow.attendance_id ? 'Edit Attendance Record' : 'Mark Attendance'}
              </h3>
              <button
                type="button"
                onClick={() => setModalRow(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
                aria-label="Close modal"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleModalSubmit}>
              <div className="p-5 space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                  <div className="text-sm font-semibold text-slate-900">
                    {modalRow.full_name} ({modalRow.employee_code})
                  </div>
                  <div className="text-xs text-slate-500 font-mono-num">Date: {date}</div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Attendance Status *</label>
                  <select
                    value={modalStatus}
                    onChange={(e) => handleStatusChangeInModal(e.target.value as AttendanceStatus)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    <option value="Present">Present</option>
                    <option value="Late">Late</option>
                    <option value="Absent">Absent</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Check-In Time</label>
                    <input
                      type="time"
                      value={modalCheckIn}
                      onChange={(e) => setModalCheckIn(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Check-Out Time</label>
                    <input
                      type="time"
                      value={modalCheckOut}
                      onChange={(e) => setModalCheckOut(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks</label>
                  <textarea
                    rows={2}
                    value={modalRemarks}
                    onChange={(e) => setModalRemarks(e.target.value)}
                    placeholder="Optional note or reason..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setModalRow(null)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Remove Attendance Entry"
        message={
          deleteTarget
            ? `Remove attendance record for ${deleteTarget.full_name} on ${date}?`
            : ''
        }
        confirmLabel="Remove Entry"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
