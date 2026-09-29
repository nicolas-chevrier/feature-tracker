import { useEffect, type ReactNode } from "react";
import { statusOf, type StatusId } from "./model";

export function StatusBadge({ status }: { status: StatusId }) {
  const s = statusOf(status);
  return (
    <span className="ft-badge" style={{ ["--status" as string]: s.color }}>
      {s.label}
    </span>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="ft-progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="ft-progress-track">
        <div className="ft-progress-fill" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="ft-pct">{value}%</span>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  side = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  side?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ft-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={side ? "ft-drawer" : "ft-dialog"} role="dialog" aria-modal="true" aria-label={title}>
        <header className="ft-dialog-head">
          <h2>{title}</h2>
          <button className="ft-icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>
        <div className="ft-dialog-body">{children}</div>
        {footer && <footer className="ft-dialog-foot">{footer}</footer>}
      </div>
    </div>
  );
}
