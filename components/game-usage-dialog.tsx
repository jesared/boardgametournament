"use client";

import Link from "next/link";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type GameUsageDialogProps = {
  sessionId: string;
  gameName: string;
  tables: Array<{
    id: string;
    roundId: string;
    roundOrder: number;
    participantCount: number;
  }>;
};

export function GameUsageDialog({
  sessionId,
  gameName,
  tables,
}: GameUsageDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-foreground transition-colors duration-300 hover:bg-muted">
          Voir tables ({tables.length})
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tables utilisees</DialogTitle>
          <DialogDescription>
            {gameName} est utilise dans {tables.length} table(s).
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-2 text-sm">
          {tables.map((table) => (
            <div
              key={table.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-2"
            >
              <div>
                <p className="font-semibold">Manche {table.roundOrder}</p>
                <p className="text-xs text-muted-foreground">
                  {table.participantCount} joueur(s) · table {table.id.slice(0, 6)}…
                </p>
              </div>
              <Link
                href={`/sessions/${sessionId}/rounds?focus=${table.roundId}`}
                className="text-xs font-semibold text-foreground transition-colors duration-300 hover:underline decoration-accent/70 underline-offset-4"
              >
                Ouvrir
              </Link>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
