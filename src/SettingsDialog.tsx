import { useState } from "react";
import { DEFAULT_BRICK_COLORS, emptyWork, uid, type Brick, type ProjectData } from "./model";
import { Modal } from "./ui";

interface Props {
  data: ProjectData;
  onSave: (data: ProjectData) => void;
  onClose: () => void;
}

export default function SettingsDialog({ data, onSave, onClose }: Props) {
  const [project, setProject] = useState(data.project);
  const [bricks, setBricks] = useState<Brick[]>(data.bricks);

  const updateBrick = (i: number, patch: Partial<Brick>) =>
    setBricks(bricks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const removeBrick = (i: number) => {
    const b = bricks[i];
    const used = data.features.some((f) => f.work[b.id] && f.work[b.id].status !== "todo");
    if (used && !confirm(`Supprimer la brique « ${b.name} » et l'avancement associé ?`)) return;
    setBricks(bricks.filter((_, j) => j !== i));
  };
  const addBrick = () =>
    setBricks([
      ...bricks,
      { id: uid("b"), name: `Brique ${bricks.length + 1}`, color: DEFAULT_BRICK_COLORS[bricks.length % 3] },
    ]);

  const save = () => {
    const features = data.features.map((f) => ({
      ...f,
      work: Object.fromEntries(bricks.map((b) => [b.id, f.work[b.id] ?? emptyWork()])),
    }));
    onSave({
      ...data,
      project: { ...project, name: project.name.trim() || "Projet sans nom" },
      bricks: bricks.map((b) => ({ ...b, name: b.name.trim() || b.id })),
      features,
    });
  };

  return (
    <Modal
      title="Paramètres du projet"
      onClose={onClose}
      footer={
        <>
          <span className="ft-spacer" />
          <button className="ft-btn" onClick={onClose}>
            Annuler
          </button>
          <button className="ft-btn ft-btn-primary" onClick={save} disabled={bricks.length === 0}>
            Enregistrer
          </button>
        </>
      }
    >
      <div className="ft-form">
        <label className="ft-field">
          <span>Nom du projet</span>
          <input value={project.name} onChange={(e) => setProject({ ...project, name: e.target.value })} />
        </label>
        <label className="ft-field">
          <span>Description</span>
          <textarea
            rows={2}
            value={project.description ?? ""}
            onChange={(e) => setProject({ ...project, description: e.target.value || undefined })}
          />
        </label>

        <h3 className="ft-section-title">Briques applicatives</h3>
        {bricks.map((b, i) => (
          <div key={b.id} className="ft-brick-edit">
            <input
              type="color"
              value={b.color}
              onChange={(e) => updateBrick(i, { color: e.target.value })}
              aria-label={`Couleur de ${b.name}`}
            />
            <input
              value={b.name}
              onChange={(e) => updateBrick(i, { name: e.target.value })}
              aria-label="Nom de la brique"
              placeholder="Nom"
            />
            <input
              value={b.description ?? ""}
              onChange={(e) => updateBrick(i, { description: e.target.value || undefined })}
              aria-label="Description de la brique"
              placeholder="Description (optionnel)"
            />
            <button
              className="ft-icon-btn"
              onClick={() => removeBrick(i)}
              disabled={bricks.length <= 1}
              aria-label={`Supprimer ${b.name}`}
              title="Supprimer"
            >
              🗑
            </button>
          </div>
        ))}
        <button className="ft-btn" onClick={addBrick}>
          + Ajouter une brique
        </button>
      </div>
    </Modal>
  );
}
