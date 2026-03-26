"use client";

import { useMemo, useState } from "react";

import { deleteGame } from "@/app/actions";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DeleteGameDialog({
  sessionId,
  gameId,
  gameName,
}: {
  sessionId: string;
  gameId: string;
  gameName: string;
}) {
  const [confirmText, setConfirmText] = useState("");
  const isMatch = useMemo(
    () => confirmText.trim().toLowerCase() === gameName.trim().toLowerCase(),
    [confirmText, gameName],
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          Supprimer
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer un jeu</DialogTitle>
          <DialogDescription>
            Cette action supprimera le jeu {gameName}. Elle est impossible si le
            jeu est deja utilise dans une manche.
          </DialogDescription>
        </DialogHeader>
        <form action={deleteGame} className="mt-4 space-y-3">
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="gameId" value={gameId} />
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Tapez le nom du jeu pour confirmer
            </label>
            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              placeholder={gameName}
            />
          </div>
          <div className="flex flex-wrap gap-2">
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
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              disabled={!isMatch}
            >
              Confirmer
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
