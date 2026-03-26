"use client";

import { useState } from "react";

import { updateGameGlobal } from "@/app/actions";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type EditGameDialogProps = {
  game: {
    id: string;
    name: string;
    minPlayers: number;
    maxPlayers: number;
    duration: number;
    scoringType: "ranking" | "raw";
    rules: string | null;
  };
};

export function EditGameDialog({ game }: EditGameDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-foreground transition-colors duration-300 hover:bg-muted">
          Editer
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le jeu</DialogTitle>
          <DialogDescription>
            Met a jour les parametres globaux du jeu.
          </DialogDescription>
        </DialogHeader>
        <form action={updateGameGlobal} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="gameId" value={game.id} />
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`edit-name-${game.id}`}>Nom</Label>
            <Input id={`edit-name-${game.id}`} name="name" defaultValue={game.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-duration-${game.id}`}>Duree (min)</Label>
            <Input
              id={`edit-duration-${game.id}`}
              name="duration"
              type="number"
              min={1}
              defaultValue={game.duration}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-min-${game.id}`}>Joueurs min</Label>
            <Input
              id={`edit-min-${game.id}`}
              name="minPlayers"
              type="number"
              min={1}
              defaultValue={game.minPlayers}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-max-${game.id}`}>Joueurs max</Label>
            <Input
              id={`edit-max-${game.id}`}
              name="maxPlayers"
              type="number"
              min={1}
              defaultValue={game.maxPlayers}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-scoring-${game.id}`}>Scoring</Label>
            <select
              id={`edit-scoring-${game.id}`}
              name="scoringType"
              defaultValue={game.scoringType}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm"
            >
              <option value="ranking">Classement</option>
              <option value="raw">Score brut</option>
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`edit-rules-${game.id}`}>Regles (optionnel)</Label>
            <Textarea
              id={`edit-rules-${game.id}`}
              name="rules"
              defaultValue={game.rules ?? ""}
              placeholder="Ex: scoring final, objectifs, tie-break."
            />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <DialogClose asChild>
              <button
                type="button"
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Annuler
              </button>
            </DialogClose>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
