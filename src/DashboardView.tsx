import {
  STATUSES,
  brickProgress,
  countByStatus,
  displayDate,
  featureProgress,
  featureStatus,
  parseDate,
  type ProjectData,
} from "./model";
import { ProgressBar, StatusBadge } from "./ui";

interface Props {
  data: ProjectData;
  onOpenFeature: (featureId: string) => void;
}

export default function DashboardView({ data, onOpenFeature }: Props) {
  const total = data.features.length;
  const globalProgress = total
    ? Math.round(data.features.reduce((s, f) => s + featureProgress(data, f), 0) / total)
    : 0;
  const featureStatuses = countByStatus(
    data.features.map((f) => ({ status: featureStatus(data, f), progress: 0 })),
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const alerts = data.features.flatMap((f) =>
    data.bricks.flatMap((b) => {
      const w = f.work[b.id];
      if (w.status === "blocked") return [{ f, b, w, kind: "Bloqué" }];
      const end = parseDate(w.end);
      if (end && end < today && w.status !== "done" && w.status !== "na")
        return [{ f, b, w, kind: "En retard" }];
      return [];
    }),
  );

  return (
    <div className="ft-dashboard">
      <section className="ft-kpis">
        <div className="ft-card ft-kpi">
          <span className="ft-kpi-label">Avancement global</span>
          <span className="ft-kpi-value">{globalProgress}%</span>
          <ProgressBar value={globalProgress} />
        </div>
        <div className="ft-card ft-kpi">
          <span className="ft-kpi-label">Features</span>
          <span className="ft-kpi-value">{total}</span>
          <span className="ft-kpi-sub">
            {featureStatuses.done} terminée{featureStatuses.done > 1 ? "s" : ""} ·{" "}
            {featureStatuses.in_progress + featureStatuses.review} en cours
          </span>
        </div>
        <div className="ft-card ft-kpi">
          <span className="ft-kpi-label">Points d'attention</span>
          <span className={`ft-kpi-value ${alerts.length ? "ft-kpi-alert" : ""}`}>{alerts.length}</span>
          <span className="ft-kpi-sub">
            {featureStatuses.blocked} feature{featureStatuses.blocked > 1 ? "s" : ""} bloquée
            {featureStatuses.blocked > 1 ? "s" : ""}
          </span>
        </div>
      </section>

      <section className="ft-bricks">
        {data.bricks.map((b) => {
          const works = data.features.map((f) => f.work[b.id]);
          const counts = countByStatus(works);
          const relevant = works.length - counts.na;
          const value = brickProgress(data, b.id);
          return (
            <div key={b.id} className="ft-card ft-brick-card" style={{ borderTopColor: b.color }}>
              <div className="ft-brick-head">
                <h3>
                  <span className="ft-brick-dot" style={{ background: b.color }} />
                  {b.name}
                </h3>
                {b.description && <span className="ft-muted">{b.description}</span>}
              </div>
              <div className="ft-brick-value">{value}%</div>
              <ProgressBar value={value} color={b.color} />
              <div className="ft-stack" aria-label="Répartition par statut">
                {STATUSES.filter((s) => s.id !== "na" && counts[s.id] > 0).map((s) => (
                  <div
                    key={s.id}
                    className="ft-stack-seg"
                    title={`${s.label} : ${counts[s.id]}`}
                    style={{ flexGrow: counts[s.id], background: s.color }}
                  />
                ))}
                {relevant === 0 && <div className="ft-stack-seg ft-stack-empty" />}
              </div>
              <ul className="ft-status-list">
                {STATUSES.filter((s) => counts[s.id] > 0).map((s) => (
                  <li key={s.id}>
                    <span className="ft-dot" style={{ background: s.color }} />
                    {s.label}
                    <strong>{counts[s.id]}</strong>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="ft-card">
        <h3 className="ft-section-title">Points d'attention</h3>
        {alerts.length === 0 ? (
          <p className="ft-muted">Rien de bloqué ni en retard.</p>
        ) : (
          <ul className="ft-alerts">
            {alerts.map(({ f, b, w, kind }) => (
              <li key={`${f.id}-${b.id}`}>
                <span className={`ft-alert-kind ${kind === "Bloqué" ? "is-blocked" : "is-late"}`}>{kind}</span>
                <button className="ft-link" onClick={() => onOpenFeature(f.id)}>
                  {f.name}
                </button>
                <span className="ft-brick-chip" style={{ ["--brick" as string]: b.color }}>
                  {b.name}
                </span>
                <span className="ft-muted">
                  échéance {displayDate(w.end)}
                  {w.owner ? ` · ${w.owner}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ft-card">
        <h3 className="ft-section-title">Features</h3>
        <ul className="ft-feature-list">
          {data.features.map((f) => (
            <li key={f.id}>
              <button className="ft-link" onClick={() => onOpenFeature(f.id)}>
                {f.name}
              </button>
              <StatusBadge status={featureStatus(data, f)} />
              <ProgressBar value={featureProgress(data, f)} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
