"use client";

import { useMemo, useState } from "react";

import { createSessionWithTemplate } from "@/app/actions";

type SessionTemplate = {
  id: string;
  name: string;
};

type SessionCreateFormProps = {
  templates: SessionTemplate[];
};

const formatDate = (value: string) => {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
  }).format(parsed);
};

export function SessionCreateForm({ templates }: SessionCreateFormProps) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [templateId, setTemplateId] = useState("");

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? null,
    [templateId, templates],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <form
        action={createSessionWithTemplate}
        className="space-y-6 rounded-2xl border border-border bg-card/70 p-6 shadow-sm"
      >
        <div className="space-y-2">
          <label
            htmlFor="session-name"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Nom de la session
          </label>
          <input
            id="session-name"
            name="name"
            placeholder="Tournoi du samedi"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="rounded-xl border border-secondary/40 bg-secondary/20 px-3 py-2 text-xs text-foreground/90">
            Choisis un nom clair pour retrouver facilement la session.
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="session-date"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Date du tournoi
          </label>
          <input
            id="session-date"
            name="date"
            type="date"
            className="h-11 w-full rounded-lg border border-input bg-card/80 px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:[color-scheme:dark]"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <div className="rounded-xl border border-secondary/40 bg-secondary/20 px-3 py-2 text-xs text-foreground/90">
            Cette date s'affiche dans les dashboards et exports.
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="session-template"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Template (optionnel)
          </label>
          <select
            id="session-template"
            name="templateId"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            <option value="">Aucun template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <div className="rounded-xl border border-secondary/40 bg-secondary/20 px-3 py-2 text-xs text-foreground/90">
            Les templates prechargent des jeux avec regles.
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 mt-6 border-t border-border bg-card/90 px-6 py-4 backdrop-blur">
          <button
            type="submit"
            className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90"
          >
            Creer la session
          </button>
        </div>
      </form>

      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card/70 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Resume live
          </p>
          <div className="mt-3 space-y-3 text-sm text-foreground">
            <div>
              <p className="text-xs text-muted-foreground">Nom</p>
              <p className="text-base font-semibold">
                {name.trim().length > 0 ? name : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="text-base font-semibold">{formatDate(date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Template</p>
              <p className="text-base font-semibold">
                {selectedTemplate?.name ?? "Aucun template"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/40 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Astuces rapides
          </p>
          <ul className="mt-3 space-y-2 text-sm text-foreground">
            <li>Ajoute les joueurs juste apres la creation.</li>
            <li>Les templates accelerent le setup des jeux.</li>
            <li>Les manches peuvent etre generees automatiquement.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
