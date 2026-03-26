import { addPlayer, importPlayersCsv } from "@/app/actions";
import { DeletePlayerDialog } from "@/components/delete-player-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SessionTabs } from "@/components/session-tabs";
import { SessionTopbar } from "@/components/session-topbar";
import { prisma } from "@/lib/prisma";

export default async function SessionPlayersPage(
  props: PageProps<"/sessions/[id]/players">,
) {
  const { id } = await props.params;

  const session = await prisma.tournamentSession.findUnique({
    where: { id },
  });

  if (!session) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Session introuvable</h1>
      </div>
    );
  }

  const players = await prisma.player.findMany({
    where: { sessionId: id },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <SessionTopbar
        title={session.name}
        subtitle="Ajout et suppression des joueurs."
        badge="Joueurs"
      />

      <SessionTabs sessionId={id} current="players" />

      <Card id="add-player">
        <CardHeader>
          <CardTitle>Ajouter un joueur</CardTitle>
          <CardDescription>Nom et ajout direct.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={addPlayer} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="sessionId" value={id} />
            <div className="space-y-2">
              <Label htmlFor="player-name">Nom du joueur</Label>
              <Input id="player-name" name="name" required />
            </div>
            <button className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90">
              Ajouter
            </button>
          </form>
        </CardContent>
      </Card>

      <Card id="import-players">
        <CardHeader>
          <CardTitle>Import CSV</CardTitle>
          <CardDescription>
            Une colonne avec les noms (ex: Nom). Delimiteur , ou ;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={importPlayersCsv}
            className="flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="sessionId" value={id} />
            <div className="space-y-2">
              <Label htmlFor="players-csv">Fichier CSV</Label>
              <Input id="players-csv" name="file" type="file" accept=".csv" />
            </div>
            <button className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90">
              Importer
            </button>
          </form>
        </CardContent>
      </Card>

      <Card id="players-list">
        <CardHeader>
          <CardTitle>Liste des joueurs</CardTitle>
          <CardDescription>Gestion et suppression.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {players.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              Aucun joueur enregistre.
            </div>
          ) : (
            <ul className="space-y-2">
              {players.map((player) => (
                <li
                  key={player.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted px-4 py-3 text-sm"
                >
                  <span className="font-medium">{player.name}</span>
                  <DeletePlayerDialog
                    sessionId={id}
                    playerId={player.id}
                    playerName={player.name}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

