interface StatusBadgeProps {
  status: string | null | undefined;
}

const STYLE_MAP: Record<string, { classes: string; icon: string; label: string }> = {
  Present: {
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: 'fa-solid fa-check',
    label: 'Present'
  },
  Late: {
    classes: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: 'fa-regular fa-clock',
    label: 'Late'
  },
  Absent: {
    classes: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: 'fa-solid fa-xmark',
    label: 'Absent'
  },
  'On Leave': {
    classes: 'bg-sky-50 text-sky-700 border-sky-200',
    icon: 'fa-regular fa-calendar-minus',
    label: 'On Leave'
  },
  Active: {
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: 'fa-solid fa-circle-check',
    label: 'Active'
  },
  Inactive: {
    classes: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: 'fa-solid fa-circle-minus',
    label: 'Inactive'
  }
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500 whitespace-nowrap">
        <i className="fa-regular fa-clock text-[11px]" aria-hidden="true" />
        Unmarked
      </span>
    );
  }

  const config = STYLE_MAP[status] || {
    classes: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: 'fa-solid fa-circle-info',
    label: status
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${config.classes}`}
    >
      <i className={`${config.icon} text-[11px]`} aria-hidden="true" />
      {config.label}
    </span>
  );
}
