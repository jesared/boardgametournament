"use client";

import { useMemo, useState } from "react";

import { deleteUser } from "@/app/actions";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DeleteUserDialog({
  userId,
  email,
}: {
  userId: string;
  email: string | null;
}) {
  const [confirmText, setConfirmText] = useState("");
  const target = email ?? "utilisateur";
  const isMatch = useMemo(
    () => confirmText.trim().toLowerCase() === target.trim().toLowerCase(),
    [confirmText, target],
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
          <DialogTitle>Supprimer l'utilisateur</DialogTitle>
          <DialogDescription>
            Cette action supprimera le compte {email ?? "selectionne"} et ses
            sessions d'authentification associees.
          </DialogDescription>
        </DialogHeader>
        <form action={deleteUser} className="mt-4 space-y-3">
          <input type="hidden" name="userId" value={userId} />
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Tapez {target} pour confirmer
            </label>
            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              placeholder={target}
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
