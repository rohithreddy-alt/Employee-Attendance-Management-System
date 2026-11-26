import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip
} from 'chart.js';
import { useEffect, useRef, useState } from 'react';
import StatusBadge from '../components/StatusBadge.tsx';
import { apiRequest, getTodayISO } from '../lib/api.ts';
import type { DashboardStats, PageKey } from '../types.ts';

Chart.register(
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

interface DashboardPageProps {
  onNavigate: (page: PageKey) => void;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function DashboardPage({ onNavigate, onNotify }: DashboardPageProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const trendCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const doughnutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const trendChartRef = useRef<Chart | null>(null);
  const doughnutChartRef = useRef<Chart | null>(null);

  useEffect(() => {
    let active = true;
    async function loadStats() {
      setLoading(true);
      try {
        const res = await apiRequest<{ success: boolean; data: DashboardStats }>(
          `/api/dashboard/stats?date=${encodeURIComponent(getTodayISO())}`
        );
        if (active) setStats(res.data);
      } catch (err) {
        if (active) onNotify((err as Error).message, 'error');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadStats();
    return () => {
      active = false;
    };
  }, [onNotify]);

  useEffect(() => {
    if (!stats || !trendCanvasRef.current || !doughnutCanvasRef.current) return;

    if (trendChartRef.current) trendChartRef.current.destroy();
    if (doughnutChartRef.current) doughnutChartRef.current.destroy();

    trendChartRef.current = new Chart(trendCanvasRef.current, {
      type: 'bar',
      data: {
        labels: stats.monthlyTrend.map((d) => d.date.slice(5)),
        datasets: [
          {
            label: 'Present',
            data: stats.monthlyTrend.map((d) => d.present),
            backgroundColor: '#2563EB',
            borderRadius: 4
          },
          {
            label: 'Late',
            data: stats.monthlyTrend.map((d) => d.late),
            backgroundColor: '#D97706',
            borderRadius: 4
          },
          {
            label: 'Absent',
            data: stats.monthlyTrend.map((d) => d.absent),
            backgroundColor: '#DC2626',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });

    const s = stats.summary;
    doughnutChartRef.current = new Chart(doughnutCanvasRef.current, {
      type: 'doughnut',
      data: {
        labels: ['Present', 'Late', 'Absent', 'On Leave', 'Unmarked'],
        datasets: [
          {
            data: [s.presentToday, s.lateToday, s.absentToday, s.onLeaveToday, s.unmarkedToday],
            backgroundColor: ['#16A34A', '#D97706', '#DC2626', '#0284C7', '#CBD5E1'],
            borderWidth: 2,
            borderColor: '#FFFFFF'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } }
        }
      }
    });

    return () => {
      trendChartRef.current?.destroy();
      doughnutChartRef.current?.destroy();
    };
  }, [stats]);

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white p-5 animate-pulse">
              <div className="h-3 w-24 bg-slate-200 rounded mb-4" />
              <div className="h-7 w-16 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
        <div className="h-80 rounded-xl border border-slate-200 bg-white animate-pulse" />
      </div>
    );
  }

  const { summary, departmentBreakdown, recentActivity } = stats;

  const kpis = [
    {
      label: 'Total Employees',
      value: summary.totalEmployees,
      sub: `${summary.activeEmployees} Active staff`,
      icon: 'fa-solid fa-users',
      iconTone: 'bg-blue-50 text-blue-600'
    },
    {
      label: 'Present Today',
      value: summary.presentToday,
      sub: 'On-time check-ins',
      icon: 'fa-solid fa-user-check',
      iconTone: 'bg-emerald-50 text-emerald-600'
    },
    {
      label: 'Absent Today',
      value: summary.absentToday,
      sub: `${summary.onLeaveToday} On leave`,
      icon: 'fa-solid fa-user-xmark',
      iconTone: 'bg-rose-50 text-rose-600'
    },
    {
      label: 'Late Employees',
      value: summary.lateToday,
      sub: 'After grace window',
      icon: 'fa-regular fa-clock',
      iconTone: 'bg-amber-50 text-amber-600'
    },
    {
      label: 'Attendance Rate',
      value: `${summary.attendancePercentage}%`,
      sub: `${summary.unmarkedToday} Unmarked today`,
      icon: 'fa-solid fa-chart-line',
      iconTone: 'bg-sky-50 text-sky-600'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('attendance')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-calendar-check" aria-hidden="true" />
            <span>Mark Today&apos;s Attendance</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('employees')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-user-plus" aria-hidden="true" />
            <span>Manage Employees</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-file-export" aria-hidden="true" />
            <span>Attendance Reports</span>
          </button>
        </div>
        <div className="text-xs text-slate-500 tabular-nums">
          Showing metrics for <span className="font-semibold text-slate-700">{stats.date}</span>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-slate-200 bg-white p-5 flex items-start justify-between gap-3 transition-transform duration-150 hover:-translate-y-0.5"
          >
            <div>
              <div className="text-xs font-medium text-slate-500">{kpi.label}</div>
              <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-num tabular-nums">
                {kpi.value}
              </div>
              <div className="mt-1.5 text-xs text-slate-500 tabular-nums">{kpi.sub}</div>
            </div>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${kpi.iconTone}`}>
              <i className={kpi.icon} aria-hidden="true" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">14-Day Attendance Trend</h2>
              <p className="text-xs text-slate-500">Daily breakdown of Present, Late, and Absent counts</p>
            </div>
          </div>
          <div className="p-5 h-72">
            <canvas ref={trendCanvasRef} />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Present vs Absent Breakdown</h2>
            <p className="text-xs text-slate-500">Live distribution for {stats.date}</p>
          </div>
          <div className="p-5 h-72">
            <canvas ref={doughnutCanvasRef} />
          </div>
        </section>
      </div>

      {/* Department Summary & Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Today by Department</h2>
            <button
              type="button"
              onClick={() => onNavigate('departments')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap cursor-pointer"
            >
              View All
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Department</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Staff</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Present</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Late</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Absent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departmentBreakdown.map((dept) => (
                  <tr key={dept.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{dept.department_name}</td>
                    <td className="px-3 py-2.5 text-right font-mono-num tabular-nums text-slate-600">
                      {dept.total_employees}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-num tabular-nums text-emerald-700 font-semibold">
                      {dept.present_count}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-num tabular-nums text-amber-700 font-semibold">
                      {dept.late_count}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-num tabular-nums text-rose-700 font-semibold">
                      {dept.absent_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="xl:col-span-2 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent Attendance Activity</h2>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap cursor-pointer"
            >
              Full History
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Check-In</th>
                  <th className="px-4 py-3 font-semibold">Check-Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentActivity.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                      No attendance logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentActivity.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono-num tabular-nums text-xs text-slate-700 font-medium whitespace-nowrap">
                        {item.attendance_date}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{item.full_name}</div>
                        <div className="text-xs text-slate-500 font-mono-num">{item.employee_code}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{item.department_name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 font-mono-num tabular-nums text-xs text-slate-700">
                        {item.check_in || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono-num tabular-nums text-xs text-slate-700">
                        {item.check_out || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
