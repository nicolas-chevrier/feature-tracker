import { describe, expect, it } from "vitest";
import {
  ImportError,
  applyWorkPatch,
  exportFileName,
  featureProgress,
  featureStatus,
  moveBrick,
  normalizeProject,
  orderedBricks,
  parseProjectJson,
  serializeProject,
  type ProjectData,
} from "../src/model";
import { sampleProject } from "../src/sample";

const base = {
  project: { name: "Test" },
  bricks: [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
  ],
};

describe("normalizeProject", () => {
  it("rejette un contenu sans briques", () => {
    expect(() => normalizeProject({ features: [] })).toThrow(ImportError);
    expect(() => normalizeProject([])).toThrow(ImportError);
  });

  it("rejette les identifiants de brique dupliqués", () => {
    expect(() => normalizeProject({ bricks: [{ id: "x" }, { id: "x" }] })).toThrow(/dupliqué/);
  });

  it("complète les travaux manquants et nettoie les valeurs invalides", () => {
    const data = normalizeProject({
      ...base,
      features: [
        {
          id: "f1",
          name: "F1",
          priority: "urgent",
          work: {
            a: { status: "in_progress", progress: 250, start: "2026-10-10", end: "2026-10-01" },
            b: { status: "weird", progress: "12" },
            zzz: { status: "done" },
          },
        },
      ],
    });
    const f = data.features[0];
    expect(f.priority).toBe("medium");
    expect(Object.keys(f.work)).toEqual(["a", "b", "c"]);
    expect(f.work.a).toMatchObject({ progress: 100, start: "2026-10-10", end: "2026-10-10" });
    expect(f.work.b).toEqual({ status: "todo", progress: 12 });
    expect(f.work.c).toEqual({ status: "todo", progress: 0 });
  });

  it("force 100 % sur une brique terminée et ignore les dates mal formées", () => {
    const data = normalizeProject({
      ...base,
      features: [{ work: { a: { status: "done", progress: 10, start: "10/10/2026" } } }],
    });
    expect(data.features[0].work.a).toEqual({ status: "done", progress: 100 });
    expect(data.features[0].id).toBeTruthy();
  });

  it("dédoublonne les identifiants de feature", () => {
    const data = normalizeProject({ ...base, features: [{ id: "x" }, { id: "x" }] });
    expect(new Set(data.features.map((f) => f.id)).size).toBe(2);
  });
});

describe("avancement", () => {
  const data = normalizeProject({
    ...base,
    features: [
      {
        id: "f",
        work: {
          a: { status: "done" },
          b: { status: "in_progress", progress: 50 },
          c: { status: "na" },
        },
      },
    ],
  });

  it("exclut les briques non concernées de la moyenne", () => {
    expect(featureProgress(data, data.features[0])).toBe(75);
    expect(featureStatus(data, data.features[0])).toBe("in_progress");
  });

  it("remonte le blocage d'une brique au niveau de la feature", () => {
    const f = { ...data.features[0], work: { ...data.features[0].work, b: { status: "blocked" as const, progress: 50 } } };
    expect(featureStatus(data, f)).toBe("blocked");
  });
});

describe("applyWorkPatch", () => {
  it("passe en cours dès qu'un avancement est saisi", () => {
    expect(applyWorkPatch({ status: "todo", progress: 0 }, { progress: 20 })).toEqual({
      status: "in_progress",
      progress: 20,
    });
  });
  it("termine à 100 %", () => {
    expect(applyWorkPatch({ status: "in_progress", progress: 40 }, { progress: 100 }).status).toBe("done");
    expect(applyWorkPatch({ status: "in_progress", progress: 40 }, { status: "done" }).progress).toBe(100);
  });
  it("rouvre une brique terminée si l'avancement baisse", () => {
    expect(applyWorkPatch({ status: "done", progress: 100 }, { progress: 80 }).status).toBe("in_progress");
  });
});

describe("ordre des briques par feature", () => {
  const data = normalizeProject({
    ...base,
    features: [
      { id: "f", work: { a: { status: "todo" }, b: { status: "na" }, c: { status: "todo" } } },
      { id: "g", brickOrder: ["c", "zzz", 42, "a"] },
    ],
  });
  const [f, g] = data.features;
  const ids = (feature: typeof f) => orderedBricks(data, feature).map((b) => b.id);

  it("utilise l'ordre du projet par défaut", () => {
    expect(f.brickOrder).toBeUndefined();
    expect(ids(f)).toEqual(["a", "b", "c"]);
  });

  it("nettoie brickOrder à l'import et complète les briques manquantes", () => {
    expect(g.brickOrder).toEqual(["c", "a"]);
    expect(ids(g)).toEqual(["c", "a", "b"]);
  });

  it("saute les briques non affichées et s'arrête aux bords", () => {
    const visible = (b: { id: string }) => f.work[b.id].status !== "na";
    const moved = moveBrick(data, f, "c", -1, visible);
    expect(ids(moved)).toEqual(["c", "b", "a"]);
    expect(moveBrick(data, f, "a", -1, visible)).toBe(f);
    expect(moveBrick(data, f, "c", 1, visible)).toBe(f);
  });

  it("ne modifie que la feature concernée", () => {
    const moved = moveBrick(data, f, "a", 1);
    expect(ids(moved)).toEqual(["b", "a", "c"]);
    expect(ids(g)).toEqual(["c", "a", "b"]);
  });
});

describe("import / export", () => {
  it("fait un aller-retour sans perte", () => {
    const data: ProjectData = sampleProject(new Date(2026, 8, 29));
    const again = parseProjectJson(serializeProject(data));
    expect(again.features).toEqual(data.features);
    expect(again.bricks).toEqual(data.bricks);
    expect(again.project.updatedAt).toBeTruthy();
  });

  it("signale un JSON invalide", () => {
    expect(() => parseProjectJson("{oops")).toThrow(/JSON invalide/);
  });

  it("génère un nom de fichier lisible", () => {
    const name = exportFileName({ ...sampleProject(), project: { name: "Élan — Été 2026" } });
    expect(name).toMatch(/^elan-ete-2026-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
