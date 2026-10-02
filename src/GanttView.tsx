import { useEffect, useMemo, useRef, useState } from "react";
import { Gantt, type IApi, type IScaleConfig, type ITask } from "@svar-ui/react-gantt";
import {
  addDays,
  featureProgress,
  formatDate,
  parseDate,
  statusOf,
  type BrickWork,
  type ProjectData,
} from "./model";

export interface WorkChange {
  featureId: string;
  brickId: string;
  patch: Partial<BrickWork>;
}

interface Props {
  data: ProjectData;
  /** Incrémenté quand les données changent hors du Gantt : force la reconstruction des tâches. */
  revision: number;
  onChange: (changes: WorkChange[]) => void;
  onOpenFeature: (featureId: string) => void;
}

const SEP = "::";
const childId = (featureId: string, brickId: string) => `${featureId}${SEP}${brickId}`;
const DAY = 86_400_000;
const SCALE_KEY = "feature-tracker:scale";

function loadScaleMode(): ScaleMode {
  try {
    const v = localStorage.getItem(SCALE_KEY);
    if (v === "day" || v === "week" || v === "month") return v;
  } catch {
    /* stockage indisponible */
  }
  return "week";
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / DAY + 1) / 7);
}

export type ScaleMode = "day" | "week" | "month";

const monthScale = {
  unit: "month",
  step: 1,
  format: (d: Date) => d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
};
const shortDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

// lengthUnit reste « day » partout : les barres et le glisser-déposer gardent la précision
// au jour, seules les colonnes changent (cellWidth = largeur de la plus petite colonne).
export const SCALE_MODES: Record<
  ScaleMode,
  { label: string; lengthUnit: string; cellWidth: number; scales: IScaleConfig[] }
> = {
  day: {
    label: "Jour",
    lengthUnit: "day",
    cellWidth: 28,
    scales: [
      monthScale,
      { unit: "week", step: 1, format: (d: Date) => `S${isoWeek(d)}` },
      { unit: "day", step: 1, format: (d: Date) => String(d.getDate()) },
    ],
  },
  week: {
    label: "Semaine",
    lengthUnit: "day",
    cellWidth: 84,
    scales: [monthScale, { unit: "week", step: 1, format: (d: Date) => `S${isoWeek(d)} · ${shortDate(d)}` }],
  },
  month: {
    label: "Mois",
    lengthUnit: "day",
    cellWidth: 140,
    scales: [
      { unit: "year", step: 1, format: (d: Date) => String(d.getFullYear()) },
      { unit: "month", step: 1, format: (d: Date) => d.toLocaleDateString("fr-FR", { month: "long" }) },
    ],
  },
};

const columns = [
  { id: "text", header: "Feature / brique", flexgrow: 1 },
  {
    id: "progress",
    header: "%",
    width: 52,
    align: "center" as const,
    template: (v: number) => `${Math.round(v ?? 0)}%`,
  },
];

// Le Gantt SVAR stocke une date de fin exclusive ; le JSON garde une fin incluse.
function buildTasks(data: ProjectData): ITask[] {
  const tasks: ITask[] = [];
  data.features.forEach((f) => {
    const children: ITask[] = [];
    data.bricks.forEach((b, i) => {
      const w = f.work[b.id];
      if (!w || w.status === "na") return;
      const start = parseDate(w.start);
      const end = parseDate(w.end);
      const scheduled = !!start && !!end;
      children.push({
        id: childId(f.id, b.id),
        parent: f.id,
        text: `${b.name} · ${statusOf(w.status).label}`,
        type: `brick-${i}`,
        progress: w.progress,
        ...(scheduled
          ? { start, end: addDays(end!, 1) }
          : { unscheduled: true, start: new Date(), end: addDays(new Date(), 1) }),
      });
    });
    const dated = children.filter((c) => !c.unscheduled);
    const start = dated.length ? new Date(Math.min(...dated.map((c) => +c.start!))) : undefined;
    const end = dated.length ? new Date(Math.max(...dated.map((c) => +c.end!))) : undefined;
    tasks.push({
      id: f.id,
      text: f.name,
      type: "summary",
      open: true,
      progress: featureProgress(data, f),
      ...(start && end
        ? { start, end }
        : { unscheduled: true, start: new Date(), end: addDays(new Date(), 1) }),
    });
    tasks.push(...children);
  });
  return tasks;
}

function brickCss(data: ProjectData): string {
  return data.bricks
    .map(
      // SVAR ajoute le type personnalisé tel quel comme classe de la barre (ex. "wx-task brick-0").
      (b, i) => `
.ft-gantt .wx-bar.wx-task.brick-${i} {
  background-color: color-mix(in srgb, ${b.color} 30%, var(--ft-bar-base));
  border: 1px solid ${b.color};
  color: var(--ft-bar-text);
}
.ft-gantt .wx-bar.brick-${i} .wx-progress-percent { background-color: ${b.color}; opacity: .8; }
.ft-legend-${i} { background: ${b.color}; }`,
    )
    .join("\n");
}

export default function GanttView({ data, revision, onChange, onOpenFeature }: Props) {
  const apiRef = useRef<IApi | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const handlers = useRef({ onChange, onOpenFeature });
  handlers.current = { onChange, onOpenFeature };
  const [scaleMode, setScaleMode] = useState<ScaleMode>(loadScaleMode);
  const scale = SCALE_MODES[scaleMode];
  useEffect(() => {
    try {
      localStorage.setItem(SCALE_KEY, scaleMode);
    } catch {
      /* stockage indisponible */
    }
  }, [scaleMode]);

  // Reconstruit les tâches seulement quand le changement ne vient pas du Gantt lui-même.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tasks = useMemo(() => buildTasks(data), [revision]);
  const taskTypes = useMemo(
    () => [
      { id: "task", label: "Tâche" },
      { id: "summary", label: "Feature" },
      ...data.bricks.map((b, i) => ({ id: `brick-${i}`, label: b.name })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision],
  );
  const todayKey = formatDate(new Date());
  const markers = useMemo(() => [{ start: parseDate(todayKey)!, css: "ft-today-marker" }], [todayKey]);
  const highlightTime = (date: Date, unit: string) => {
    if (unit !== "day" || scaleMode !== "day") return "";
    if (formatDate(date) === todayKey) return "ft-today";
    return date.getDay() === 0 || date.getDay() === 6 ? "ft-weekend" : "";
  };

  const init = (api: IApi) => {
    apiRef.current = api;
    setTimeout(() => api.exec("scroll-chart", { date: addDays(new Date(), -7) }), 0);
    // Structure (features/briques) pilotée par l'application, pas par le Gantt.
    for (const action of ["add-task", "delete-task", "move-task", "copy-task", "indent-task", "add-link"])
      api.intercept(action, () => false);
    api.intercept("drag-task", (ev) => api.getTask(ev.id)?.type !== "summary");
    api.intercept("show-editor", (ev) => {
      if (ev.id) handlers.current.onOpenFeature(String(ev.id).split(SEP)[0]);
      return false;
    });
    api.on("update-task", (ev) => {
      if (ev.inProgress || ev.eventSource === "ft-sync") return;
      syncFromGantt(api);
    });
  };

  function syncFromGantt(api: IApi) {
    const current = dataRef.current;
    const changes: WorkChange[] = [];
    for (const f of current.features) {
      for (const b of current.bricks) {
        const w = f.work[b.id];
        if (!w || w.status === "na") continue;
        const t = api.getTask(childId(f.id, b.id) as never);
        if (!t) continue;
        const patch: Partial<BrickWork> = {};
        const progress = Math.round(t.progress ?? 0);
        if (progress !== w.progress) patch.progress = progress;
        if (!t.unscheduled && t.start && t.end) {
          const start = formatDate(t.start);
          const end = formatDate(addDays(t.end, -1));
          if (start !== w.start) patch.start = start;
          if (end !== w.end) patch.end = end < start ? start : end;
        }
        if (Object.keys(patch).length) changes.push({ featureId: f.id, brickId: b.id, patch });
      }
    }
    if (changes.length) handlers.current.onChange(changes);
  }

  // Après une modification issue du Gantt, recalcule les lignes « feature » (dates et %).
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    for (const t of buildTasks(data)) {
      if (t.type !== "summary") continue;
      const cur = api.getTask(t.id as never);
      if (!cur) continue;
      const same =
        cur.progress === t.progress &&
        +(cur.start ?? 0) === +(t.start ?? 0) &&
        +(cur.end ?? 0) === +(t.end ?? 0);
      if (!same && !t.unscheduled)
        api.exec("update-task", {
          id: t.id!,
          task: { start: t.start, end: t.end, progress: t.progress },
          eventSource: "ft-sync",
          skipUndo: true,
        });
    }
  }, [data]);

  return (
    <div className="ft-gantt-wrap">
      <style>{brickCss(data)}</style>
      <div className="ft-gantt-legend">
        {data.bricks.map((b, i) => (
          <span key={b.id} className="ft-legend-item">
            <span className={`ft-legend-dot ft-legend-${i}`} />
            {b.name}
          </span>
        ))}
        <div className="ft-segmented" role="radiogroup" aria-label="Échelle du planning">
          {(Object.keys(SCALE_MODES) as ScaleMode[]).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={scaleMode === m}
              className={scaleMode === m ? "is-active" : ""}
              onClick={() => setScaleMode(m)}
            >
              {SCALE_MODES[m].label}
            </button>
          ))}
        </div>
        <span className="ft-legend-hint">
          Glisser une barre pour déplacer les dates, étirer ses bords pour la durée, sa poignée pour
          l'avancement. Double-clic pour éditer la feature.
        </span>
      </div>
      <div className="ft-gantt">
        <Gantt
          key={`${revision}-${scaleMode}`}
          init={init}
          tasks={tasks}
          taskTypes={taskTypes}
          columns={columns}
          scales={scale.scales}
          highlightTime={highlightTime}
          markers={markers}
          lengthUnit={scale.lengthUnit}
          cellWidth={scale.cellWidth}
          cellHeight={34}
          scaleHeight={28}
          gridWidth={300}
          unscheduledTasks
        />
      </div>
    </div>
  );
}
