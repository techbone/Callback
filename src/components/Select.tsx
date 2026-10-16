import { ChevronDown } from "lucide-react";

type Option = { value: string; label: string };

export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="relative flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 min-w-36 cursor-pointer appearance-none rounded-md border border-line bg-surface pl-3 pr-8 text-sm text-ink outline-none transition-colors hover:border-muted focus-visible:border-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute bottom-[11px] right-2.5 text-muted" />
    </label>
  );
}
