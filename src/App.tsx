import { useCallback, useEffect, useRef, useState } from "react";
import { Willow, WillowDark } from "@svar-ui/react-gantt";
import { Locale } from "@svar-ui/react-core";
import { fr } from "@svar-ui/core-locales";
import DashboardView from "./DashboardView";
import FeaturePanel from "./FeaturePanel";
import GanttView, { type WorkChange } from "./GanttView";
import MatrixView from "./MatrixView";
import SettingsDialog from "./SettingsDialog";
import {
  applyWorkPatch,
  createFeature,
  createProject,
  exportFileName,
  parseProjectJson,
  serializeProject,
  uid,
  type BrickWork,
  type Feature,
  type ProjectData,
} from "./model";
import { sampleProject } from "./sample";

type View = "dashboard" | "matrix" | "gantt";
type Theme = "light" | "dark";

const DRAFT_KEY = "feature-tracker:draft";
const VIEW_KEY = "feature-tracker:view";
const THEME_KEY = "feature-tracker:theme";

const ganttWords = {
  ...fr,
  gantt: {
    "Task name": "Nom",
    "Start date": "Début",
    "End date": "Fin",
    Duration: "Durée",
    Progress: "Avancement",
    Week: "Semaine",
    Q: "Trimestre",
  },
};

const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* stockage indisponible (navigation privée…) : on ignore */
    }
  },
};

function loadDraft(): ProjectData | null {
  const raw = storage.get(DRAFT_KEY);
  if (!raw) return null;
  try {
    return parseProjectJson(raw);
  } catch {
    return null;
  }
}

export default function App() {
  const [data, setData] = useState<ProjectData>(() => loadDraft() ?? sampleProject());
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState<View>(() => (storage.get(VIEW_KEY) as View) || "matrix");
  const [theme, setTheme] = useState<Theme>(
    () =>
      (storage.get(THEME_KEY) as Theme) ||
      (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  );
  const [openFeatureId, setOpenFeatureId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => storage.set(DRAFT_KEY, JSON.stringify(data)), [data]);
  useEffect(() => storage.set(VIEW_KEY, view), [view]);
  useEffect(() => {
    storage.set(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.title = `${data.project.name} · Feature Tracker`;
  }, [data.project.name]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /** Modification des données. `fromGantt` évite de reconstruire le Gantt qui en est la source. */
  const update = useCallback((fn: (d: ProjectData) => ProjectData, fromGantt = false) => {
    setData(fn);
    setDirty(true);
    if (!fromGantt) setRevision((r) => r + 1);
  }, []);

  const replaceData = useCallback((next: ProjectData, message: string) => {
    setData(next);
    setRevision((r) => r + 1);
    setDirty(false);
    setOpenFeatureId(null);
    setToast({ text: message });
  }, []);

  // ?src=<url> : charge un JSON distant (ex. fichier brut d'un dépôt GitHub).
  useEffect(() => {
    const src = new URLSearchParams(window.location.search).get("src");
    if (!src) return;
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => replaceData(parseProjectJson(text), `Projet chargé depuis ${src}`))
      .catch((e) => setToast({ text: `Chargement de ${src} impossible : ${e.message}`, error: true }));
  }, [replaceData]);

  const confirmDiscard = () =>
    !dirty || confirm("Des modifications n'ont pas été exportées. Continuer quand même ?");

  const importFile = async (file: File) => {
    if (!confirmDiscard()) return;
    try {
      replaceData(parseProjectJson(await file.text()), `« ${file.name} » importé`);
    } catch (e) {
      setToast({ text: (e as Error).message, error: true });
    }
  };

  const exportJson = () => {
    const blob = new Blob([serializeProject(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName(data);
    a.click();
    URL.revokeObjectURL(url);
    setDirty(false);
    setToast({ text: `Exporté : ${a.download}` });
  };

  const setWork = (featureId: string, brickId: string, patch: Partial<BrickWork>, fromGantt = false) =>
    update(
      (d) => ({
        ...d,
        features: d.features.map((f) =>
          f.id === featureId
            ? { ...f, work: { ...f.work, [brickId]: applyWorkPatch(f.work[brickId], patch) } }
            : f,
        ),
      }),
      fromGantt,
    );

  const applyGanttChanges = (changes: WorkChange[]) =>
    update(
      (d) => ({
        ...d,
        features: d.features.map((f) => {
          const mine = changes.filter((c) => c.featureId === f.id);
          if (!mine.length) return f;
          const work = { ...f.work };
          for (const c of mine) work[c.brickId] = applyWorkPatch(work[c.brickId], c.patch);
          return { ...f, work };
        }),
      }),
      true,
    );

  const addFeature = () => {
    const f = createFeature(data);
    update((d) => ({ ...d, features: [...d.features, f] }));
    setOpenFeatureId(f.id);
  };
  const saveFeature = (feature: Feature) =>
    update((d) => ({ ...d, features: d.features.map((f) => (f.id === feature.id ? feature : f)) }));
  const deleteFeature = (id: string) => {
    update((d) => ({ ...d, features: d.features.filter((f) => f.id !== id) }));
    setOpenFeatureId(null);
  };
  const duplicateFeature = (id: string) => {
    const src = data.features.find((f) => f.id === id);
    if (!src) return;
    const copy: Feature = { ...structuredClone(src), id: uid("f"), name: `${src.name} (copie)` };
    update((d) => {
      const i = d.features.findIndex((f) => f.id === id);
      const features = [...d.features];
      features.splice(i + 1, 0, copy);
      return { ...d, features };
    });
    setOpenFeatureId(copy.id);
  };
  const moveFeature = (id: string, delta: -1 | 1) =>
    update((d) => {
      const i = d.features.findIndex((f) => f.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= d.features.length) return d;
      const features = [...d.features];
      [features[i], features[j]] = [features[j], features[i]];
      return { ...d, features };
    });

  const openFeature = data.features.find((f) => f.id === openFeatureId);
  const Theme = theme === "dark" ? WillowDark : Willow;

  return (
    <Locale words={ganttWords}>
      <Theme>
        <div
          className="ft-app"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
              setDragging(true);
            }
          }}
          onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) void importFile(file);
          }}
        >
          <header className="ft-header">
            <div className="ft-title">
              <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
                <rect x="3" y="6" width="14" height="5" rx="2" fill={data.bricks[0]?.color ?? "#4f7cff"} />
                <rect x="9" y="14" width="18" height="5" rx="2" fill={data.bricks[1]?.color ?? "#22a06b"} />
                <rect x="5" y="22" width="12" height="5" rx="2" fill={data.bricks[2]?.color ?? "#e8912d"} />
              </svg>
              <div>
                <h1>{data.project.name}</h1>
                {data.project.description && <p>{data.project.description}</p>}
              </div>
              {dirty && (
                <span className="ft-dirty" title="Des modifications n'ont pas encore été exportées en JSON">
                  non exporté
                </span>
              )}
            </div>

            <nav className="ft-tabs" role="tablist">
              {(
                [
                  ["dashboard", "Synthèse"],
                  ["matrix", "Avancement"],
                  ["gantt", "Planning"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={view === id}
                  className={view === id ? "is-active" : ""}
                  onClick={() => setView(id)}
                >
                  {label}
                </button>
              ))}
            </nav>

            <div className="ft-actions">
              <button className="ft-btn" onClick={() => fileInput.current?.click()} title="Importer un fichier JSON">
                Importer
              </button>
              <button className="ft-btn ft-btn-primary" onClick={exportJson} title="Télécharger le projet en JSON">
                Exporter
              </button>
              <details className="ft-menu">
                <summary className="ft-btn" aria-label="Plus d'actions">
                  ⋯
                </summary>
                <div className="ft-menu-list" onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).removeAttribute("open")}>
                  <button onClick={() => setSettingsOpen(true)}>Paramètres du projet…</button>
                  <button
                    onClick={() => confirmDiscard() && replaceData(createProject(), "Nouveau projet vide")}
                  >
                    Nouveau projet vide
                  </button>
                  <button
                    onClick={() => confirmDiscard() && replaceData(sampleProject(), "Projet d'exemple chargé")}
                  >
                    Charger l'exemple
                  </button>
                  <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                    Thème {theme === "dark" ? "clair" : "sombre"}
                  </button>
                </div>
              </details>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void importFile(file);
                }}
              />
            </div>
          </header>

          <main className="ft-main">
            {view === "dashboard" && <DashboardView data={data} onOpenFeature={setOpenFeatureId} />}
            {view === "matrix" && (
              <MatrixView
                data={data}
                onWorkChange={(f, b, p) => setWork(f, b, p)}
                onOpenFeature={setOpenFeatureId}
                onAddFeature={addFeature}
                onMoveFeature={moveFeature}
              />
            )}
            {view === "gantt" && (
              <GanttView
                data={data}
                revision={revision}
                onChange={applyGanttChanges}
                onOpenFeature={setOpenFeatureId}
              />
            )}
          </main>

          {openFeature && (
            <FeaturePanel
              data={data}
              feature={openFeature}
              onChange={saveFeature}
              onDelete={deleteFeature}
              onDuplicate={duplicateFeature}
              onClose={() => setOpenFeatureId(null)}
            />
          )}
          {settingsOpen && (
            <SettingsDialog
              data={data}
              onClose={() => setSettingsOpen(false)}
              onSave={(next) => {
                update(() => next);
                setSettingsOpen(false);
              }}
            />
          )}
          {dragging && <div className="ft-dropzone">Déposer le fichier JSON pour l'importer</div>}
          {toast && (
            <div className={`ft-toast ${toast.error ? "is-error" : ""}`} role="status">
              {toast.text}
            </div>
          )}
        </div>
      </Theme>
    </Locale>
  );
}
