interface ProgressBarProps {
  fraction: number;
  label: string;
}

export default function ProgressBar({ fraction, label }: ProgressBarProps) {
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between gap-3 text-xs text-slate-600">
        <span className="truncate">{label}</span>
        <span className="font-mono tabular-nums">{percent} %</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Progression du traitement"
        className="h-2 overflow-hidden rounded-full bg-slate-200"
      >
        <div className="h-full rounded-full bg-teal-700 transition-[width] duration-200" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
