// Modèle de données du fichier JSON importé / exporté.
// Dates stockées au format "YYYY-MM-DD", fin incluse.

export const FORMAT_VERSION = 1;

export type StatusId = "todo" | "in_progress" | "review" | "blocked" | "done" | "na";
export type PriorityId = "low" | "medium" | "high" | "critical";

export interface Brick {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface BrickWork {
  status: StatusId;
  progress: number; // 0..100
  start?: string;
  end?: string;
  owner?: string;
  notes?: string;
}

export interface Feature {
  id: string;
  name: string;
  description?: string;
  priority: PriorityId;
  milestone?: string;
  work: Record<string, BrickWork>;
}

export interface ProjectData {
  version: number;
  project: { name: string; description?: string; updatedAt?: string };
  bricks: Brick[];
  features: Feature[];
}

export const STATUSES: { id: StatusId; label: string; color: string }[] = [
  { id: "todo", label: "À faire", color: "#8a94a6" },
  { id: "in_progress", label: "En cours", color: "#3b82f6" },
  { id: "review", label: "En recette", color: "#a855f7" },
  { id: "blocked", label: "Bloqué", color: "#e5484d" },
  { id: "done", label: "Terminé", color: "#22a06b" },
  { id: "na", label: "Non concerné", color: "#c9ced8" },
];

export const PRIORITIES: { id: PriorityId; label: string }[] = [
  { id: "low", label: "Basse" },
  { id: "medium", label: "Moyenne" },
  { id: "high", label: "Haute" },
  { id: "critical", label: "Critique" },
];

export const DEFAULT_BRICK_COLORS = ["#4f7cff", "#22a06b", "#e8912d"];

export const statusOf = (id: StatusId) => STATUSES.find((s) => s.id === id) ?? STATUSES[0];
export const priorityLabel = (id: PriorityId) =>
  PRIORITIES.find((p) => p.id === id)?.label ?? id;

export function uid(prefix = "f"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

export function emptyWork(): BrickWork {
  return { status: "todo", progress: 0 };
}

export function createProject(name = "Nouveau projet"): ProjectData {
  return {
    version: FORMAT_VERSION,
    project: { name },
    bricks: [
      { id: "front", name: "Front", color: DEFAULT_BRICK_COLORS[0] },
      { id: "back", name: "Back", color: DEFAULT_BRICK_COLORS[1] },
      { id: "data", name: "Data", color: DEFAULT_BRICK_COLORS[2] },
    ],
    features: [],
  };
}

export function createFeature(data: ProjectData, name = "Nouvelle feature"): Feature {
  const work: Record<string, BrickWork> = {};
  for (const b of data.bricks) work[b.id] = emptyWork();
  return { id: uid("f"), name, priority: "medium", work };
}

// ---------- Calculs d'avancement ----------

/** Travaux pertinents d'une feature (briques « non concernées » exclues). */
function relevantWork(data: ProjectData, f: Feature): BrickWork[] {
  return data.bricks.map((b) => f.work[b.id] ?? emptyWork()).filter((w) => w.status !== "na");
}

export function featureProgress(data: ProjectData, f: Feature): number {
  const works = relevantWork(data, f);
  if (works.length === 0) return 0;
  return Math.round(works.reduce((sum, w) => sum + w.progress, 0) / works.length);
}

export function featureStatus(data: ProjectData, f: Feature): StatusId {
  const works = relevantWork(data, f);
  if (works.length === 0) return "na";
  if (works.some((w) => w.status === "blocked")) return "blocked";
  if (works.every((w) => w.status === "done")) return "done";
  if (works.every((w) => w.status === "todo")) return "todo";
  if (works.every((w) => w.status === "done" || w.status === "review")) return "review";
  return "in_progress";
}

export function brickProgress(data: ProjectData, brickId: string): number {
  const works = data.features
    .map((f) => f.work[brickId])
    .filter((w): w is BrickWork => !!w && w.status !== "na");
  if (works.length === 0) return 0;
  return Math.round(works.reduce((sum, w) => sum + w.progress, 0) / works.length);
}

export function countByStatus(works: BrickWork[]): Record<StatusId, number> {
  const res = { todo: 0, in_progress: 0, review: 0, blocked: 0, done: 0, na: 0 };
  for (const w of works) res[w.status]++;
  return res;
}

/** Garde statut et avancement cohérents après une modification. */
export function applyWorkPatch(prev: BrickWork, patch: Partial<BrickWork>): BrickWork {
  const next = { ...prev, ...patch };
  next.progress = clampProgress(next.progress);
  if (patch.status !== undefined) {
    if (patch.status === "done") next.progress = 100;
    else if (patch.status === "todo" && patch.progress === undefined) next.progress = 0;
  } else if (patch.progress !== undefined) {
    if (next.progress === 100 && next.status !== "na") next.status = "done";
    else if (next.progress > 0 && next.status === "todo") next.status = "in_progress";
    else if (next.progress < 100 && next.status === "done") next.status = "in_progress";
  }
  return next;
}

function clampProgress(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ---------- Dates ----------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(s: string | undefined): Date | undefined {
  if (!s || !ISO_DATE.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function formatDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function displayDate(s: string | undefined): string {
  const d = parseDate(s);
  return d ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—";
}

// ---------- Import / export ----------

export class ImportError extends Error {}

const STATUS_IDS = new Set(STATUSES.map((s) => s.id));
const PRIORITY_IDS = new Set(PRIORITIES.map((p) => p.id));

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v : undefined;

/**
 * Valide et normalise un JSON importé. Tolérant sur les champs optionnels,
 * strict sur la structure (briques + features).
 */
export function normalizeProject(raw: unknown): ProjectData {
  if (!isObj(raw)) throw new ImportError("Le fichier doit contenir un objet JSON.");
  if (!Array.isArray(raw.bricks) || raw.bricks.length === 0)
    throw new ImportError("Le champ « bricks » doit être une liste non vide.");
  if (raw.features !== undefined && !Array.isArray(raw.features))
    throw new ImportError("Le champ « features » doit être une liste.");

  const seenBricks = new Set<string>();
  const bricks: Brick[] = raw.bricks.map((b, i) => {
    if (!isObj(b)) throw new ImportError(`Brique n°${i + 1} invalide.`);
    const id = str(b.id) ?? `brick-${i + 1}`;
    if (seenBricks.has(id)) throw new ImportError(`Identifiant de brique dupliqué : « ${id} ».`);
    seenBricks.add(id);
    return {
      id,
      name: str(b.name) ?? id,
      color: str(b.color) ?? DEFAULT_BRICK_COLORS[i % DEFAULT_BRICK_COLORS.length],
      ...(str(b.description) ? { description: b.description as string } : {}),
    };
  });

  const seenFeatures = new Set<string>();
  const features: Feature[] = ((raw.features as unknown[]) ?? []).map((f, i) => {
    if (!isObj(f)) throw new ImportError(`Feature n°${i + 1} invalide.`);
    let id = str(f.id) ?? uid("f");
    if (seenFeatures.has(id)) id = uid("f");
    seenFeatures.add(id);
    const rawWork = isObj(f.work) ? f.work : {};
    const work: Record<string, BrickWork> = {};
    for (const b of bricks) work[b.id] = normalizeWork(rawWork[b.id]);
    const priority = PRIORITY_IDS.has(f.priority as PriorityId) ? (f.priority as PriorityId) : "medium";
    return {
      id,
      name: str(f.name) ?? `Feature ${i + 1}`,
      priority,
      work,
      ...(str(f.description) ? { description: f.description as string } : {}),
      ...(str(f.milestone) ? { milestone: f.milestone as string } : {}),
    };
  });

  const project = isObj(raw.project) ? raw.project : {};
  return {
    version: FORMAT_VERSION,
    project: {
      name: str(project.name) ?? "Projet sans nom",
      ...(str(project.description) ? { description: project.description as string } : {}),
      ...(str(project.updatedAt) ? { updatedAt: project.updatedAt as string } : {}),
    },
    bricks,
    features,
  };
}

function normalizeWork(raw: unknown): BrickWork {
  if (!isObj(raw)) return emptyWork();
  const status = STATUS_IDS.has(raw.status as StatusId) ? (raw.status as StatusId) : "todo";
  const w: BrickWork = { status, progress: clampProgress(raw.progress ?? 0) };
  if (status === "done") w.progress = 100;
  const start = parseDate(str(raw.start));
  const end = parseDate(str(raw.end));
  if (start) w.start = formatDate(start);
  if (end) w.end = formatDate(end);
  if (start && end && end < start) w.end = w.start;
  if (str(raw.owner)) w.owner = raw.owner as string;
  if (str(raw.notes)) w.notes = raw.notes as string;
  return w;
}

export function parseProjectJson(text: string): ProjectData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new ImportError(`JSON invalide : ${(e as Error).message}`);
  }
  return normalizeProject(raw);
}

export function serializeProject(data: ProjectData): string {
  const out: ProjectData = {
    ...data,
    version: FORMAT_VERSION,
    project: { ...data.project, updatedAt: new Date().toISOString() },
  };
  return JSON.stringify(out, null, 2);
}

export function exportFileName(data: ProjectData): string {
  const slug =
    data.project.name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "projet";
  return `${slug}-${formatDate(new Date())}.json`;
}
