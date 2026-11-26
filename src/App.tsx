import { useCallback, useEffect, useState } from 'react';
import AuthView from './components/AuthView.tsx';
import Layout from './components/Layout.tsx';
import ToastContainer from './components/ToastContainer.tsx';
import { apiRequest, setAuthToken, setOnUnauthorized } from './lib/api.ts';
import AttendancePage from './pages/AttendancePage.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import DepartmentsPage from './pages/DepartmentsPage.tsx';
import EmployeesPage from './pages/EmployeesPage.tsx';
import HistoryPage from './pages/HistoryPage.tsx';
import ReportsPage from './pages/ReportsPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import type { AdminUser, CompanySettings, PageKey, ToastItem } from './types.ts';

export default function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [companyName, setCompanyName] = useState('AttendPro Technologies');
  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      setAuthToken(null);
      setAdmin(null);
    });

    apiRequest<{
      success: boolean;
      data: {
        authenticated: boolean;
        needsSetup: boolean;
        admin: AdminUser | null;
        company: CompanySettings | null;
      };
    }>('/api/auth/status')
      .then((res) => {
        setNeedsSetup(res.data.needsSetup);
        setAdmin(res.data.admin);
        if (res.data.company?.company_name) {
          setCompanyName(res.data.company.company_name);
        }
      })
      .catch((err) => {
        notify((err as Error).message, 'error');
      })
      .finally(() => {
        setCheckingAuth(false);
      });
  }, [notify]);

  async function handleLogout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // clear local session regardless
    }
    setAuthToken(null);
    setAdmin(null);
    setActivePage('dashboard');
    notify('Signed out successfully.', 'info');
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        <div className="flex items-center gap-3 text-sm font-medium">
          <i className="fa-solid fa-spinner fa-spin text-blue-600" />
          <span>Loading AttendPro Workspace...</span>
        </div>
      </div>
    );
  }

  if (!admin) {
    return (
      <>
        <AuthView
          needsSetup={needsSetup}
          companyName={companyName}
          onNotify={notify}
          onSuccess={(authedAdmin, company) => {
            setNeedsSetup(false);
            setAdmin(authedAdmin);
            if (company?.company_name) setCompanyName(company.company_name);
          }}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <>
      <Layout
        activePage={activePage}
        onNavigate={setActivePage}
        admin={admin}
        companyName={companyName}
        onLogout={handleLogout}
      >
        {activePage === 'dashboard' && <DashboardPage onNavigate={setActivePage} onNotify={notify} />}
        {activePage === 'employees' && <EmployeesPage onNotify={notify} />}
        {activePage === 'attendance' && <AttendancePage onNotify={notify} />}
        {activePage === 'history' && <HistoryPage onNotify={notify} />}
        {activePage === 'reports' && <ReportsPage onNotify={notify} />}
        {activePage === 'departments' && <DepartmentsPage onNotify={notify} />}
        {activePage === 'settings' && (
          <SettingsPage
            onNotify={notify}
            onAdminUpdated={(updated) => setAdmin(updated)}
            onCompanyUpdated={(updated) => setCompanyName(updated.company_name)}
          />
        )}
      </Layout>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
