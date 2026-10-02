import {
  addDays,
  formatDate,
  normalizeProject,
  type BrickWork,
  type ProjectData,
  type StatusId,
} from "./model";

// Projet d'exemple, daté relativement à aujourd'hui pour que le planning soit parlant.
export function sampleProject(today = new Date()): ProjectData {
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  const d = (offset: number) => formatDate(addDays(monday, offset));
  const w = (
    status: StatusId,
    progress: number,
    start?: number,
    end?: number,
    owner?: string,
  ): BrickWork => ({
    status,
    progress,
    ...(start !== undefined ? { start: d(start) } : {}),
    ...(end !== undefined ? { end: d(end) } : {}),
    ...(owner ? { owner } : {}),
  });

  return normalizeProject({
    version: 1,
    project: { name: "Plateforme Client", description: "Refonte de l'espace client" },
    bricks: [
      { id: "mapi", name: "sfd", color: "#4f7cff", description: "sfd VueJS + API" },
      { id: "api", name: "Real", color: "#22a06b", description: "Real Rbin Rbex" },
      { id: "data", name: "IA", color: "#e8912d", description: "IA" },
    ],
    features: [
      {
        id: "auth",
        name: "Authentification SSO",
        priority: "critical",
        milestone: "MVP",
        work: {
          mapi: w("done", 100, -21, -10, "Nicolas"),
          api: w("done", 100, -24, -12, "Bruno"),
          data: w("na", 0),
        },
      },
      {
        id: "dashboard",
        name: "Tableau de bord client",
        priority: "high",
        milestone: "MVP",
        work: {
          mapi: w("in_progress", 60, -7, 6, "Alice"),
          api: w("review", 90, -12, 1, "Bruno"),
          data: w("done", 100, -18, -8, "Chloé"),
        },
      },
      {
        id: "invoices",
        name: "Consultation des factures",
        priority: "high",
        milestone: "MVP",
        work: {
          mapi: w("todo", 0, 7, 18, "David"),
          api: w("in_progress", 40, -3, 10, "Bruno"),
          data: w("na", 0),
        },
        description: "Bloqué : attente des accès au flux de facturation.",
      },
      {
        id: "notifications",
        name: "Notifications e-mail",
        priority: "medium",
        milestone: "V1",
        work: {
          mapi: w("todo", 0, 14, 21),
          api: w("todo", 0, 10, 24, "Eva"),
          data: w("na", 0),
        },
      },
      {
        id: "export",
        name: "Export CSV des contrats",
        priority: "low",
        milestone: "V1",
        work: {
          mapi: w("todo", 0, 21, 25),
          api: w("todo", 0, 18, 25),
          data: w("in_progress", 30, 0, 14, "Chloé"),
        },
      },
      {
        id: "search",
        name: "Recherche multi-critères",
        priority: "medium",
        milestone: "V1",
        work: {
          mapi: w("todo", 0),
          api: w("todo", 0),
          data: w("todo", 0),
        },
      },
    ],
  });
}
