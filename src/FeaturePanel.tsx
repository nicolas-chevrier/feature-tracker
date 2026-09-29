import {
  PRIORITIES,
  STATUSES,
  applyWorkPatch,
  featureProgress,
  featureStatus,
  type BrickWork,
  type Feature,
  type PriorityId,
  type ProjectData,
  type StatusId,
} from "./model";
import { Modal, ProgressBar, StatusBadge } from "./ui";

interface Props {
  data: ProjectData;
  feature: Feature;
  onChange: (feature: Feature) => void;
  onDelete: (featureId: string) => void;
  onDuplicate: (featureId: string) => void;
  onClose: () => void;
}

export default function FeaturePanel({ data, feature, onChange, onDelete, onDuplicate, onClose }: Props) {
  const set = (patch: Partial<Feature>) => onChange({ ...feature, ...patch });
  const setWork = (brickId: string, patch: Partial<BrickWork>) =>
    onChange({ ...feature, work: { ...feature.work, [brickId]: applyWorkPatch(feature.work[brickId], patch) } });
  const milestones = [...new Set(data.features.map((f) => f.milestone).filter(Boolean))] as string[];

  return (
    <Modal
      side
      title="Feature"
      onClose={onClose}
      footer={
        <>
          <button
            className="ft-btn ft-btn-danger"
            onClick={() => confirm(`Supprimer « ${feature.name} » ?`) && onDelete(feature.id)}
          >
            Supprimer
          </button>
          <button className="ft-btn" onClick={() => onDuplicate(feature.id)}>
            Dupliquer
          </button>
          <span className="ft-spacer" />
          <button className="ft-btn ft-btn-primary" onClick={onClose}>
            Fermer
          </button>
        </>
      }
    >
      <div className="ft-form">
        <label className="ft-field">
          <span>Nom</span>
          <input value={feature.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
        </label>
        <label className="ft-field">
          <span>Description</span>
          <textarea
            rows={3}
            value={feature.description ?? ""}
            onChange={(e) => set({ description: e.target.value || undefined })}
          />
        </label>
        <div className="ft-row">
          <label className="ft-field">
            <span>Priorité</span>
            <select value={feature.priority} onChange={(e) => set({ priority: e.target.value as PriorityId })}>
              {PRIORITIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ft-field">
            <span>Jalon / version</span>
            <input
              list="ft-milestones"
              value={feature.milestone ?? ""}
              placeholder="ex. MVP"
              onChange={(e) => set({ milestone: e.target.value || undefined })}
            />
            <datalist id="ft-milestones">
              {milestones.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
        </div>

        <div className="ft-summary">
          <StatusBadge status={featureStatus(data, feature)} />
          <ProgressBar value={featureProgress(data, feature)} />
        </div>

        {data.bricks.map((b) => {
          const w = feature.work[b.id];
          const na = w.status === "na";
          return (
            <fieldset key={b.id} className="ft-brick-fieldset" style={{ borderLeftColor: b.color }}>
              <legend>
                <span className="ft-brick-dot" style={{ background: b.color }} />
                {b.name}
              </legend>
              <div className="ft-row">
                <label className="ft-field">
                  <span>Statut</span>
                  <select
                    value={w.status}
                    onChange={(e) => setWork(b.id, { status: e.target.value as StatusId })}
                  >
                    {STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ft-field">
                  <span>Avancement : {w.progress}%</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    disabled={na}
                    value={w.progress}
                    style={{ ["--fill" as string]: b.color, ["--pct" as string]: `${w.progress}%` }}
                    onChange={(e) => setWork(b.id, { progress: Number(e.target.value) })}
                  />
                </label>
              </div>
              {!na && (
                <>
                  <div className="ft-row">
                    <label className="ft-field">
                      <span>Début</span>
                      <input
                        type="date"
                        value={w.start ?? ""}
                        max={w.end}
                        onChange={(e) => setWork(b.id, { start: e.target.value || undefined })}
                      />
                    </label>
                    <label className="ft-field">
                      <span>Fin</span>
                      <input
                        type="date"
                        value={w.end ?? ""}
                        min={w.start}
                        onChange={(e) => setWork(b.id, { end: e.target.value || undefined })}
                      />
                    </label>
                    <label className="ft-field">
                      <span>Responsable</span>
                      <input
                        value={w.owner ?? ""}
                        onChange={(e) => setWork(b.id, { owner: e.target.value || undefined })}
                      />
                    </label>
                  </div>
                  <label className="ft-field">
                    <span>Notes</span>
                    <textarea
                      rows={2}
                      value={w.notes ?? ""}
                      onChange={(e) => setWork(b.id, { notes: e.target.value || undefined })}
                    />
                  </label>
                </>
              )}
            </fieldset>
          );
        })}
      </div>
    </Modal>
  );
}
