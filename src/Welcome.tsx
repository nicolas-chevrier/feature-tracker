import { useRef, useState } from "react";
import { parseProjectJson, type ProjectData } from "./model";

interface Props {
  loading: boolean;
  error: string | null;
  onError: (message: string | null) => void;
  draft: ProjectData | null;
  onOpen: (data: ProjectData, message?: string) => void;
  onNew: () => void;
  onSample: () => void;
}

export default function Welcome({ loading, error, onError, draft, onOpen, onNew, onSample }: Props) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const read = async (file: File | undefined) => {
    if (!file) return;
    try {
      onOpen(parseProjectJson(await file.text()), `« ${file.name} » importé`);
    } catch (e) {
      onError(`« ${file.name} » : ${(e as Error).message}`);
    }
  };

  return (
    <div className="ft-welcome">
      <div className="ft-welcome-card">
        <header className="ft-welcome-head">
          <svg viewBox="0 0 32 32" width="40" height="40" aria-hidden="true">
            <rect x="3" y="6" width="14" height="5" rx="2" fill="#4f7cff" />
            <rect x="9" y="14" width="18" height="5" rx="2" fill="#22a06b" />
            <rect x="5" y="22" width="12" height="5" rx="2" fill="#e8912d" />
          </svg>
          <div>
            <h1>Feature Tracker</h1>
            <p>Suivi de l'avancement des features par brique applicative</p>
          </div>
        </header>

        {loading ? (
          <div className="ft-drop is-loading">Chargement du projet…</div>
        ) : (
          <button
            type="button"
            className={`ft-drop ${over ? "is-over" : ""}`}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void read(e.dataTransfer.files[0]);
            }}
          >
            <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true">
              <path
                d="M12 16V4m0 0-4 4m4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <strong>Déposez votre fichier JSON ici</strong>
            <span>ou cliquez pour le sélectionner</span>
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void read(file);
          }}
        />

        {error && (
          <p className="ft-welcome-error" role="alert">
            {error}
          </p>
        )}

        <div className="ft-welcome-alt">
          {draft && (
            <button className="ft-btn" onClick={() => onOpen(draft, "Brouillon local restauré")}>
              Reprendre « {draft.project.name} »
              <span className="ft-muted">(brouillon local)</span>
            </button>
          )}
          <button className="ft-link-btn" onClick={onNew}>
            Créer un projet vide
          </button>
          <button className="ft-link-btn" onClick={onSample}>
            Voir un exemple
          </button>
        </div>
      </div>
    </div>
  );
}
