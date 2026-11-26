import { useCallback, useEffect, useState, type FormEvent } from 'react';
import ConfirmModal from '../components/ConfirmModal.tsx';
import StatusBadge from '../components/StatusBadge.tsx';
import { apiRequest } from '../lib/api.ts';
import type { Department, Employee } from '../types.ts';

interface DepartmentsPageProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function DepartmentsPage({ onNotify }: DepartmentsPageProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [managerName, setManagerName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [rosterModal, setRosterModal] = useState<{ department: Department; employees: Employee[] } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; data: Department[] }>('/api/departments');
      setDepartments(res.data || []);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  function openAddModal() {
    setEditingId(null);
    setName('');
    setCode('');
    setManagerName('');
    setDescription('');
    setModalOpen(true);
  }

  function openEditModal(dept: Department) {
    setEditingId(dept.id);
    setName(dept.name);
    setCode(dept.code);
    setManagerName(dept.manager_name || '');
    setDescription(dept.description || '');
    setModalOpen(true);
  }

  async function handleSaveDepartment(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        manager_name: managerName.trim(),
        description: description.trim()
      };
      if (editingId) {
        await apiRequest(`/api/departments/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
        onNotify('Department updated.', 'success');
      } else {
        await apiRequest('/api/departments', { method: 'POST', body: JSON.stringify(payload) });
        onNotify('Department created.', 'success');
      }
      setModalOpen(false);
      await loadDepartments();
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function openDepartmentRoster(deptId: number) {
    try {
      const res = await apiRequest<{
        success: boolean;
        data: { department: Department; employees: Employee[] };
      }>(`/api/departments/${deptId}`);
      setRosterModal(res.data);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/departments/${deleteTarget.id}`, { method: 'DELETE' });
      onNotify(`${deleteTarget.name} deleted.`, 'success');
      setDeleteTarget(null);
      await loadDepartments();
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Organization Departments</h2>
          <p className="text-xs text-slate-500">Manage teams, department leads, and view employee rosters</p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <i className="fa-solid fa-plus" aria-hidden="true" />
          <span>Add Department</span>
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 rounded-xl border border-slate-200 bg-white animate-pulse" />
          ))}
        </div>
      ) : departments.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-slate-700">No departments created yet</p>
          <button
            type="button"
            onClick={openAddModal}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
          >
            <i className="fa-solid fa-plus" /> Create First Department
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4 transition-transform duration-150 hover:-translate-y-0.5"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span className="font-mono-num font-semibold text-blue-700">{dept.code}</span>
                  <span className="tabular-nums font-medium">{dept.employee_count} staff</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{dept.name}</h3>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  {dept.description || 'No description provided.'}
                </p>
                <div className="mt-3 text-xs text-slate-600">
                  Lead: <span className="font-semibold text-slate-800">{dept.manager_name || 'Unassigned'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3.5">
                <button
                  type="button"
                  onClick={() => openDepartmentRoster(dept.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <i className="fa-solid fa-users-viewfinder" /> View Staff
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(dept)}
                    title="Edit Department"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-blue-600 cursor-pointer"
                  >
                    <i className="fa-regular fa-pen-to-square text-xs" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(dept)}
                    title="Delete Department"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white cursor-pointer"
                  >
                    <i className="fa-regular fa-trash-can text-xs" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Department Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? 'Edit Department' : 'Add Department'}
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

            <form onSubmit={handleSaveDepartment}>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Engineering"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department Code *</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="ENG"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num uppercase focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department Lead</label>
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder="Manager full name"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
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
                  {saving ? 'Saving...' : 'Save Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Department Employees Roster Modal */}
      {rosterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-bold text-slate-900">
                {rosterModal.department.name} · Staff Roster ({rosterModal.employees.length})
              </h3>
              <button
                type="button"
                onClick={() => setRosterModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              {rosterModal.employees.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No employees are currently assigned to this department.
                </p>
              ) : (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Employee ID</th>
                        <th className="px-4 py-2.5 font-semibold">Full Name</th>
                        <th className="px-4 py-2.5 font-semibold">Designation</th>
                        <th className="px-4 py-2.5 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rosterModal.employees.map((emp) => (
                        <tr key={emp.id}>
                          <td className="px-4 py-2.5 font-mono-num text-xs font-semibold">{emp.employee_code}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-900">{emp.full_name}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-600">{emp.designation}</td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={emp.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setRosterModal(null)}
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
        title="Delete Department"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? Employees assigned to this department will become Unassigned.`
            : ''
        }
        confirmLabel="Delete Department"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
