import { useCallback, useEffect, useState, type FormEvent } from 'react';
import ConfirmModal from '../components/ConfirmModal.tsx';
import StatusBadge from '../components/StatusBadge.tsx';
import { apiRequest, getTodayISO } from '../lib/api.ts';
import type { AttendanceRecord, Department, Employee, EmployeeStatus, Gender } from '../types.ts';

interface EmployeesPageProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface EmployeeProfileData {
  employee: Employee;
  stats: {
    total_records: number;
    present_days: number;
    late_days: number;
    absent_days: number;
    leave_days: number;
  };
  recentAttendance: AttendanceRecord[];
}

export default function EmployeesPage({ onNotify }: EmployeesPageProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Add/Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [empCode, setEmpCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designation, setDesignation] = useState('');
  const [joiningDate, setJoiningDate] = useState(getTodayISO());
  const [gender, setGender] = useState<Gender>('Male');
  const [status, setStatus] = useState<EmployeeStatus>('Active');

  // Profile modal
  const [profileData, setProfileData] = useState<EmployeeProfileData | null>(null);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: Department[] }>('/api/departments');
      setDepartments(res.data || []);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  }, [onNotify]);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (deptFilter) params.append('department_id', deptFilter);
      if (statusFilter) params.append('status', statusFilter);

      const res = await apiRequest<{ success: boolean; data: Employee[] }>(
        `/api/employees?${params.toString()}`
      );
      setEmployees(res.data || []);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [search, deptFilter, statusFilter, onNotify]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployees();
    }, 180);
    return () => clearTimeout(timer);
  }, [fetchEmployees]);

  async function openAddModal() {
    setEditingId(null);
    setFullName('');
    setEmail('');
    setPhone('');
    setDepartmentId(departments[0] ? String(departments[0].id) : '');
    setDesignation('');
    setJoiningDate(getTodayISO());
    setGender('Male');
    setStatus('Active');
    setEmpCode('');
    setModalOpen(true);

    try {
      const res = await apiRequest<{ success: boolean; data: { employee_code: string } }>(
        '/api/employees/next-code'
      );
      setEmpCode(res.data.employee_code);
    } catch {
      // ignore if fails; user can still type code
    }
  }

  function openEditModal(emp: Employee) {
    setEditingId(emp.id);
    setEmpCode(emp.employee_code);
    setFullName(emp.full_name);
    setEmail(emp.email);
    setPhone(emp.phone);
    setDepartmentId(emp.department_id ? String(emp.department_id) : '');
    setDesignation(emp.designation);
    setJoiningDate(emp.joining_date);
    setGender(emp.gender);
    setStatus(emp.status);
    setModalOpen(true);
  }

  async function handleSaveEmployee(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        employee_code: empCode.trim(),
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        department_id: departmentId ? Number(departmentId) : null,
        designation: designation.trim(),
        joining_date: joiningDate,
        gender,
        status
      };

      if (editingId) {
        await apiRequest(`/api/employees/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        onNotify('Employee details updated.', 'success');
      } else {
        await apiRequest('/api/employees', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        onNotify('Employee added to directory.', 'success');
      }
      setModalOpen(false);
      await fetchEmployees();
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenProfile(id: number) {
    try {
      const res = await apiRequest<{ success: boolean; data: EmployeeProfileData }>(`/api/employees/${id}`);
      setProfileData(res.data);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/employees/${deleteTarget.id}`, { method: 'DELETE' });
      onNotify(`${deleteTarget.full_name} deleted.`, 'success');
      setDeleteTarget(null);
      await fetchEmployees();
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-xs">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, ID, email, role..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
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
            <option value="Active">Active</option>
            <option value="On Leave">On Leave</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          <i className="fa-solid fa-user-plus" aria-hidden="true" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Directory Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">Employee Records</h2>
          <span className="text-xs text-slate-500 tabular-nums">{employees.length} employee(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Employee ID</th>
                <th className="px-4 py-3 font-semibold">Full Name</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Designation</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Joining Date</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
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
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="text-slate-400 mb-2">
                      <i className="fa-solid fa-users-slash text-2xl" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">No employees match your criteria</p>
                    <p className="text-xs text-slate-500 mt-1">Adjust your search filters or add a new team member.</p>
                    <button
                      type="button"
                      onClick={openAddModal}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <i className="fa-solid fa-plus" /> Add First Employee
                    </button>
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono-num tabular-nums text-xs font-semibold text-slate-800 whitespace-nowrap">
                      {emp.employee_code}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{emp.full_name}</div>
                      <div className="text-xs text-slate-500">{emp.email}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">{emp.department_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{emp.designation}</td>
                    <td className="px-4 py-3 font-mono-num tabular-nums text-xs text-slate-600 whitespace-nowrap">
                      {emp.phone}
                    </td>
                    <td className="px-4 py-3 font-mono-num tabular-nums text-xs text-slate-600 whitespace-nowrap">
                      {emp.joining_date}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={emp.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenProfile(emp.id)}
                          title="View Profile"
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                        >
                          <i className="fa-regular fa-eye text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(emp)}
                          title="Edit Employee"
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-blue-600 cursor-pointer"
                        >
                          <i className="fa-regular fa-pen-to-square text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(emp)}
                          title="Delete Employee"
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white cursor-pointer transition-colors"
                        >
                          <i className="fa-regular fa-trash-can text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Employee Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? `Edit Employee (${empCode})` : 'Add New Employee'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
                aria-label="Close modal"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="overflow-y-auto flex-1">
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Employee ID *</label>
                  <input
                    type="text"
                    required
                    value={empCode}
                    onChange={(e) => setEmpCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-blue-600 focus:outline-none"
                    placeholder="EMP-1013"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    placeholder="Jordan Taylor"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    placeholder="jordan@attendpro.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    placeholder="+1 555-101-2020"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Designation *</label>
                  <input
                    type="text"
                    required
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    placeholder="Software Engineer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Joining Date *</label>
                  <input
                    type="date"
                    required
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gender *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Employee Status *</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as EmployeeStatus)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Profile Modal */}
      {profileData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-bold text-slate-900">Employee Profile</h3>
              <button
                type="button"
                onClick={() => setProfileData(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
                aria-label="Close profile"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <h4 className="text-lg font-bold text-slate-900">{profileData.employee.full_name}</h4>
                  <p className="text-sm text-slate-500">
                    {profileData.employee.designation} · {profileData.employee.department_name}
                  </p>
                </div>
                <StatusBadge status={profileData.employee.status} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">Employee ID:</span>{' '}
                  <span className="font-mono-num font-semibold text-slate-900">
                    {profileData.employee.employee_code}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Gender:</span>{' '}
                  <span className="font-medium text-slate-900">{profileData.employee.gender}</span>
                </div>
                <div>
                  <span className="text-slate-500">Email:</span>{' '}
                  <span className="font-medium text-slate-900">{profileData.employee.email}</span>
                </div>
                <div>
                  <span className="text-slate-500">Phone:</span>{' '}
                  <span className="font-mono-num font-medium text-slate-900">{profileData.employee.phone}</span>
                </div>
                <div>
                  <span className="text-slate-500">Joining Date:</span>{' '}
                  <span className="font-mono-num font-medium text-slate-900">
                    {profileData.employee.joining_date}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Attendance Rate:</span>{' '}
                  <span className="font-mono-num font-semibold text-blue-700">
                    {profileData.stats.total_records > 0
                      ? (
                          ((profileData.stats.present_days + profileData.stats.late_days) /
                            profileData.stats.total_records) *
                          100
                        ).toFixed(1)
                      : '0.0'}
                    %
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 py-2.5">
                  <div className="text-lg font-bold font-mono-num text-emerald-700">
                    {profileData.stats.present_days}
                  </div>
                  <div className="text-xs text-emerald-700">Present</div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 py-2.5">
                  <div className="text-lg font-bold font-mono-num text-amber-700">
                    {profileData.stats.late_days}
                  </div>
                  <div className="text-xs text-amber-700">Late</div>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 py-2.5">
                  <div className="text-lg font-bold font-mono-num text-rose-700">
                    {profileData.stats.absent_days}
                  </div>
                  <div className="text-xs text-rose-700">Absent</div>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50 py-2.5">
                  <div className="text-lg font-bold font-mono-num text-sky-700">
                    {profileData.stats.leave_days}
                  </div>
                  <div className="text-xs text-sky-700">On Leave</div>
                </div>
              </div>

              <div>
                <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  Recent Attendance Logs
                </h5>
                {profileData.recentAttendance.length === 0 ? (
                  <p className="text-sm text-slate-500">No attendance logs recorded yet.</p>
                ) : (
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Date</th>
                          <th className="px-3 py-2 font-semibold">Status</th>
                          <th className="px-3 py-2 font-semibold">Check-In</th>
                          <th className="px-3 py-2 font-semibold">Check-Out</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {profileData.recentAttendance.map((log) => (
                          <tr key={log.id}>
                            <td className="px-3 py-2 font-mono-num tabular-nums">{log.attendance_date}</td>
                            <td className="px-3 py-2">
                              <StatusBadge status={log.status} />
                            </td>
                            <td className="px-3 py-2 font-mono-num tabular-nums">{log.check_in || '—'}</td>
                            <td className="px-3 py-2 font-mono-num tabular-nums">{log.check_out || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setProfileData(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Employee"
        message={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.full_name} (${deleteTarget.employee_code})? This will permanently remove their attendance records.`
            : ''
        }
        confirmLabel="Delete Employee"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
