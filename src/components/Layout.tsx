import { useState, type ReactNode } from 'react';
import type { AdminUser, PageKey } from '../types.ts';

interface LayoutProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  admin: AdminUser;
  companyName: string;
  onLogout: () => void;
  children: ReactNode;
}

const NAV_ITEMS: Array<{ key: PageKey; label: string; icon: string }> = [
  { key: 'dashboard', label: 'Dashboard', icon: 'fa-solid fa-gauge-high' },
  { key: 'employees', label: 'Employees', icon: 'fa-solid fa-users' },
  { key: 'attendance', label: 'Attendance', icon: 'fa-solid fa-calendar-check' },
  { key: 'history', label: 'History', icon: 'fa-solid fa-clock-rotate-left' },
  { key: 'reports', label: 'Reports', icon: 'fa-solid fa-chart-column' },
  { key: 'departments', label: 'Departments', icon: 'fa-solid fa-building' },
  { key: 'settings', label: 'Settings', icon: 'fa-solid fa-gear' }
];

const PAGE_TITLES: Record<PageKey, { title: string; breadcrumb: string }> = {
  dashboard: { title: 'Executive Dashboard', breadcrumb: 'Workspace / Overview' },
  employees: { title: 'Employee Directory', breadcrumb: 'Workspace / Employees' },
  attendance: { title: 'Daily Attendance', breadcrumb: 'Workspace / Attendance Sheet' },
  history: { title: 'Attendance History', breadcrumb: 'Workspace / History Logs' },
  reports: { title: 'Reports & Export', breadcrumb: 'Workspace / Reports' },
  departments: { title: 'Departments', breadcrumb: 'Workspace / Departments' },
  settings: { title: 'System Settings', breadcrumb: 'Workspace / Settings' }
};

export default function Layout({
  activePage,
  onNavigate,
  admin,
  companyName,
  onLogout,
  children
}: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = admin.full_name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const meta = PAGE_TITLES[activePage];

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden no-print"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-200 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
            <i className="fa-solid fa-calendar-check text-base" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white tracking-tight">
              {companyName || 'AttendPro'}
            </div>
            <div className="text-xs text-slate-400 truncate">Attendance Suite</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === activePage;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onNavigate(item.key);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <i className={`${item.icon} w-4 text-center`} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-300 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="no-print sticky top-0 z-20 h-16 border-b border-slate-200 bg-white px-4 sm:px-7 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              aria-label="Open navigation menu"
            >
              <i className="fa-solid fa-bars" />
            </button>
            <div className="min-w-0">
              <div className="text-xs text-slate-500 truncate">{meta.breadcrumb}</div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">{meta.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-5 shrink-0">
            <span className="hidden md:inline text-xs font-medium text-slate-500 tabular-nums whitespace-nowrap">
              {todayFormatted}
            </span>
            <div className="flex items-center gap-2.5 border-l border-slate-200 pl-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                {initials || 'AD'}
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="text-xs font-semibold text-slate-900 whitespace-nowrap">{admin.full_name}</div>
                <div className="text-[11px] text-slate-500 whitespace-nowrap">{admin.role}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-7 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
