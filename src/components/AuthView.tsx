import { useState, type FormEvent } from 'react';
import { apiRequest, setAuthToken } from '../lib/api.ts';
import type { AdminUser, CompanySettings } from '../types.ts';

interface AuthViewProps {
  needsSetup: boolean;
  companyName: string;
  onSuccess: (admin: AdminUser, company: CompanySettings | null) => void;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function AuthView({ needsSetup, companyName, onSuccess, onNotify }: AuthViewProps) {
  const [fullName, setFullName] = useState('Alex Morgan');
  const [email, setEmail] = useState('admin@attendpro.com');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (needsSetup) {
        const res = await apiRequest<{
          success: boolean;
          message: string;
          data: { token: string; admin: AdminUser; company: CompanySettings | null };
        }>('/api/auth/setup', {
          method: 'POST',
          body: JSON.stringify({
            full_name: fullName.trim(),
            email: email.trim(),
            password,
            confirm_password: confirmPassword
          })
        });
        setAuthToken(res.data.token);
        onNotify('Workspace administrator account created.', 'success');
        onSuccess(res.data.admin, res.data.company);
      } else {
        const res = await apiRequest<{
          success: boolean;
          message: string;
          data: { token: string; admin: AdminUser; company: CompanySettings | null };
        }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim(),
            password,
            rememberMe
          })
        });
        setAuthToken(res.data.token);
        onNotify('Signed in to AttendPro.', 'success');
        onSuccess(res.data.admin, res.data.company);
      }
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row">
      {/* Left Brand / Overview Panel */}
      <div className="hidden lg:flex lg:w-[46%] flex-col justify-between bg-gradient-to-br from-slate-900 via-blue-950 to-blue-900 p-12 text-white border-r border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <i className="fa-solid fa-calendar-check text-lg" aria-hidden="true" />
          </div>
          <span className="text-xl font-bold tracking-tight">{companyName || 'AttendPro'}</span>
        </div>

        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white [text-wrap:balance]">
            Workforce Attendance, Scheduling &amp; Reporting Console
          </h1>
          <p className="text-sm leading-relaxed text-slate-300">
            Track daily check-ins, manage employee directories across departments, inspect historical attendance rates, and export audit-ready CSV or print reports from a single unified workspace.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <div>
              <div className="text-2xl font-bold font-mono-num text-white">100%</div>
              <div className="text-xs text-slate-300 mt-1">SQLite-backed persistence</div>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono-num text-white">Real-Time</div>
              <div className="text-xs text-slate-300 mt-1">Dynamic KPI &amp; chart analytics</div>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          {companyName || 'AttendPro Technologies'} · Attendance &amp; HR Operations
        </div>
      </div>

      {/* Right Authentication Form Panel */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <i className="fa-solid fa-calendar-check" aria-hidden="true" />
            </div>
            <span className="text-lg font-bold text-slate-900">{companyName || 'AttendPro'}</span>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {needsSetup ? 'Initialize Admin Account' : 'Sign in to Dashboard'}
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              {needsSetup
                ? 'Create your administrator password once to activate the attendance workspace.'
                : 'Enter your administrator credentials to manage employees and attendance.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {needsSetup && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Administrator Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  placeholder="Alex Morgan"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Admin Email
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                placeholder="admin@attendpro.com"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {needsSetup ? 'Create Password (min. 6 characters)' : 'Password'}
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={needsSetup ? 6 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white pl-3.5 pr-10 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  placeholder={needsSetup ? 'Choose a strong password' : 'Enter your password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              </div>
            </div>

            {needsSetup && (
              <div>
                <label htmlFor="auth-confirm" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm Password
                </label>
                <input
                  id="auth-confirm"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  placeholder="Re-enter password"
                />
              </div>
            )}

            {!needsSetup && (
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <span>Remember me for 30 days</span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors cursor-pointer"
            >
              <i className={`fa-solid ${submitting ? 'fa-spinner fa-spin' : 'fa-right-to-bracket'}`} aria-hidden="true" />
              <span>{submitting ? 'Authenticating...' : needsSetup ? 'Create Admin & Enter Dashboard' : 'Sign In'}</span>
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500 leading-relaxed">
            {needsSetup ? (
              <span>
                First-run setup: sample departments, 12 employees, and 14 days of attendance records are ready inside SQLite. Choose a password above to unlock the dashboard.
              </span>
            ) : (
              <span>
                Protected session: credentials are hashed and verified on the server. Use Settings to update your profile or password after signing in.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
