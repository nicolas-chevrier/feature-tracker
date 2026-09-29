import { useMemo, useState } from "react";
import {
  PRIORITIES,
  STATUSES,
  displayDate,
  featureProgress,
  featureStatus,
  priorityLabel,
  statusOf,
  type BrickWork,
  type ProjectData,
  type StatusId,
} from "./model";
import { ProgressBar, StatusBadge } from "./ui";

interface Props {
  data: ProjectData;
  onWorkChange: (featureId: string, brickId: string, patch: Partial<BrickWork>) => void;
  onOpenFeature: (featureId: string) => void;
  onAddFeature: () => void;
  onMoveFeature: (featureId: string, delta: -1 | 1) => void;
}

export default function MatrixView({
  data,
  onWorkChange,
  onOpenFeature,
  onAddFeature,
  onMoveFeature,
}: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusId | "">("");
  const [milestone, setMilestone] = useState("");
  const [priority, setPriority] = useState("");

  const milestones = useMemo(
    () => [...new Set(data.features.map((f) => f.milestone).filter(Boolean))] as string[],
    [data.features],
  );

  const q = search.trim().toLowerCase();
  const rows = data.features.filter((f) => {
    if (q && !`${f.name} ${f.description ?? ""}`.toLowerCase().includes(q)) return false;
    if (milestone && f.milestone !== milestone) return false;
    if (priority && f.priority !== priority) return false;
    if (status && !data.bricks.some((b) => f.work[b.id]?.status === status)) return false;
    return true;
  });
  const filtered = rows.length !== data.features.length;

  return (
    <div className="ft-matrix">
      <div className="ft-filters">
        <input
          type="search"
          placeholder="Rechercher une feature…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Rechercher"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusId | "")} aria-label="Filtrer par statut">
          <option value="">Tous statuts</option>
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Filtrer par priorité">
          <option value="">Toutes priorités</option>
          {PRIORITIES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {milestones.length > 0 && (
          <select value={milestone} onChange={(e) => setMilestone(e.target.value)} aria-label="Filtrer par jalon">
            <option value="">Tous jalons</option>
            {milestones.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
        <span className="ft-count">
          {rows.length} / {data.features.length} features
        </span>
        <button className="ft-btn ft-btn-primary" onClick={onAddFeature}>
          + Feature
        </button>
      </div>

      <div className="ft-table-scroll">
        <table className="ft-table">
          <thead>
            <tr>
              <th className="ft-col-feature">Feature</th>
              {data.bricks.map((b) => (
                <th key={b.id} style={{ borderTopColor: b.color }} className="ft-col-brick">
                  <span className="ft-brick-dot" style={{ background: b.color }} />
                  {b.name}
                </th>
              ))}
              <th className="ft-col-total">Global</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const progress = featureProgress(data, f);
              const idx = data.features.indexOf(f);
              return (
                <tr key={f.id}>
                  <td className="ft-col-feature">
                    <div className="ft-feature-cell">
                      {!filtered && (
                        <span className="ft-move">
                          <button
                            title="Monter"
                            aria-label="Monter"
                            disabled={idx === 0}
                            onClick={() => onMoveFeature(f.id, -1)}
                          >
                            ▲
                          </button>
                          <button
                            title="Descendre"
                            aria-label="Descendre"
                            disabled={idx === data.features.length - 1}
                            onClick={() => onMoveFeature(f.id, 1)}
                          >
                            ▼
                          </button>
                        </span>
                      )}
                      <div>
                        <button className="ft-link" onClick={() => onOpenFeature(f.id)}>
                          {f.name}
                        </button>
                        <div className="ft-meta">
                          <span className={`ft-prio ft-prio-${f.priority}`}>{priorityLabel(f.priority)}</span>
                          {f.milestone && <span className="ft-tag">{f.milestone}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  {data.bricks.map((b) => {
                    const w = f.work[b.id];
                    const na = w.status === "na";
                    return (
                      <td key={b.id} className={`ft-cell ${na ? "ft-cell-na" : ""}`}>
                        <select
                          className="ft-status-select"
                          style={{ ["--status" as string]: statusOf(w.status).color }}
                          value={w.status}
                          onChange={(e) => onWorkChange(f.id, b.id, { status: e.target.value as StatusId })}
                          aria-label={`Statut ${b.name} — ${f.name}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        {!na && (
                          <>
                            <div className="ft-progress-edit">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={5}
                                value={w.progress}
                                style={{ ["--fill" as string]: b.color, ["--pct" as string]: `${w.progress}%` }}
                                onChange={(e) => onWorkChange(f.id, b.id, { progress: Number(e.target.value) })}
                                aria-label={`Avancement ${b.name} — ${f.name}`}
                              />
                              <span className="ft-pct">{w.progress}%</span>
                            </div>
                            <div className="ft-dates">
                              {w.start || w.end ? `${displayDate(w.start)} → ${displayDate(w.end)}` : "Non planifié"}
                              {w.owner && <span className="ft-owner"> · {w.owner}</span>}
                            </div>
                          </>
                        )}
                      </td>
                    );
                  })}
                  <td className="ft-col-total">
                    <StatusBadge status={featureStatus(data, f)} />
                    <ProgressBar value={progress} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={data.bricks.length + 2} className="ft-empty">
                  {data.features.length === 0
                    ? "Aucune feature. Ajoutez-en une ou importez un fichier JSON."
                    : "Aucune feature ne correspond aux filtres."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
