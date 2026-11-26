import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '../lib/api.ts';
import type { AdminUser, CompanySettings } from '../types.ts';

interface SettingsPageProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
  onAdminUpdated: (admin: AdminUser) => void;
  onCompanyUpdated: (company: CompanySettings) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function SettingsPage({ onNotify, onAdminUpdated, onCompanyUpdated }: SettingsPageProps) {
  const [loading, setLoading] = useState(true);

  // Company & attendance config
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [officeStart, setOfficeStart] = useState('09:00');
  const [officeEnd, setOfficeEnd] = useState('17:30');
  const [graceMinutes, setGraceMinutes] = useState(15);
  const [workingDays, setWorkingDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [savingCompany, setSavingCompany] = useState(false);

  // Admin profile
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    apiRequest<{
      success: boolean;
      data: { settings: CompanySettings; admin: AdminUser };
    }>('/api/settings')
      .then((res) => {
        const { settings, admin } = res.data;
        if (settings) {
          setCompanyName(settings.company_name || '');
          setCompanyEmail(settings.company_email || '');
          setCompanyPhone(settings.company_phone || '');
          setCompanyAddress(settings.company_address || '');
          setOfficeStart(settings.office_start_time || '09:00');
          setOfficeEnd(settings.office_end_time || '17:30');
          setGraceMinutes(settings.late_grace_minutes ?? 15);
          setWorkingDays((settings.working_days || 'Mon,Tue,Wed,Thu,Fri').split(',').filter(Boolean));
        }
        if (admin) {
          setAdminName(admin.full_name || '');
          setAdminEmail(admin.email || '');
        }
      })
      .catch((err) => onNotify((err as Error).message, 'error'))
      .finally(() => setLoading(false));
  }, [onNotify]);

  function toggleDay(day: string) {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function handleSaveCompany(e: FormEvent) {
    e.preventDefault();
    setSavingCompany(true);
    try {
      const res = await apiRequest<{ success: boolean; data: CompanySettings }>('/api/settings/company', {
        method: 'PUT',
        body: JSON.stringify({
          company_name: companyName.trim(),
          company_email: companyEmail.trim(),
          company_phone: companyPhone.trim(),
          company_address: companyAddress.trim(),
          office_start_time: officeStart,
          office_end_time: officeEnd,
          late_grace_minutes: Number(graceMinutes) || 0,
          working_days: workingDays.join(',')
        })
      });
      onCompanyUpdated(res.data);
      onNotify('Company and attendance configuration saved.', 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setSavingCompany(false);
    }
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await apiRequest<{ success: boolean; data: AdminUser }>('/api/settings/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: adminName.trim(),
          email: adminEmail.trim()
        })
      });
      onAdminUpdated(res.data);
      onNotify('Administrator profile updated.', 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSavePassword(e: FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    try {
      await apiRequest('/api/settings/password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onNotify('Password updated successfully.', 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-96 rounded-xl border border-slate-200 bg-white animate-pulse" />
        <div className="h-96 rounded-xl border border-slate-200 bg-white animate-pulse" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Company & Attendance Configuration */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-900">Company &amp; Attendance Configuration</h2>
          <p className="text-xs text-slate-500">Office check-in/out schedule, grace period, and company info</p>
        </div>

        <form onSubmit={handleSaveCompany} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name *</label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company HR Email</label>
              <input
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company Phone</label>
              <input
                type="text"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Office Address</label>
            <input
              type="text"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Check-In Time *</label>
              <input
                type="time"
                required
                value={officeStart}
                onChange={(e) => setOfficeStart(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Check-Out Time *</label>
              <input
                type="time"
                required
                value={officeEnd}
                onChange={(e) => setOfficeEnd(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Late Grace (min)</label>
              <input
                type="number"
                min={0}
                max={180}
                value={graceMinutes}
                onChange={(e) => setGraceMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Working Days</label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const active = workingDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingCompany}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
            >
              <i className="fa-solid fa-floppy-disk" />
              <span>{savingCompany ? 'Saving...' : 'Save Company Settings'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Admin Profile & Password */}
      <div className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900">Administrator Profile</h2>
            <p className="text-xs text-slate-500">Update your display name and sign-in email</p>
          </div>
          <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Email *</label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
            >
              <i className="fa-solid fa-check" />
              <span>{savingProfile ? 'Updating...' : 'Update Profile'}</span>
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900">Change Password</h2>
            <p className="text-xs text-slate-500">Securely rotate your administrator password</p>
          </div>
          <form onSubmit={handleSavePassword} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Current Password *</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Password (min. 6 characters) *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password *</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={savingPassword}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60 cursor-pointer"
            >
              <i className="fa-solid fa-shield-halved" />
              <span>{savingPassword ? 'Updating...' : 'Update Password'}</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
