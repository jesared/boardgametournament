"use client";

import { useState } from "react";

import { addGameGlobal } from "@/app/actions";

export function QuickGameForm() {
  const [name, setName] = useState("");

  return (
    <form action={addGameGlobal} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground">
          Nom
        </label>
        <input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          placeholder="Nom du jeu"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Duree (min)
        </label>
        <input
          name="duration"
          type="number"
          min={1}
          defaultValue={30}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Joueurs min
        </label>
        <input
          name="minPlayers"
          type="number"
          min={1}
          defaultValue={2}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Joueurs max
        </label>
        <input
          name="maxPlayers"
          type="number"
          min={1}
          defaultValue={6}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Scoring
        </label>
        <select
          name="scoringType"
          defaultValue="ranking"
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none"
        >
          <option value="ranking">Classement</option>
          <option value="raw">Score brut</option>
        </select>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground">
          Regles (optionnel)
        </label>
        <textarea
          name="rules"
          className="min-h-[90px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          placeholder="Ex: scoring final, objectifs, tie-break."
        />
      </div>
      <div className="sm:col-span-2">
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90"
        >
          Creer le jeu
        </button>
      </div>
    </form>
  );
}
