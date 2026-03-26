import { addGame } from "@/app/actions";
import { DeleteGameDialog } from "@/components/delete-game-dialog";
import { GameUsageDialog } from "@/components/game-usage-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SessionTabs } from "@/components/session-tabs";
import { SessionTopbar } from "@/components/session-topbar";
import { prisma } from "@/lib/prisma";

export default async function SessionGamesPage(
  props: PageProps<"/sessions/[id]/games">,
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

  const games = await prisma.game.findMany({ orderBy: { name: "asc" } });
  const tables = await prisma.table.findMany({
    where: { round: { sessionId: id } },
    include: {
      round: true,
      participants: true,
    },
  });

  const usageByGame = new Map<
    string,
    Array<{
      id: string;
      roundId: string;
      roundOrder: number;
      participantCount: number;
    }>
  >();

  tables.forEach((table) => {
    const list = usageByGame.get(table.gameId) ?? [];
    list.push({
      id: table.id,
      roundId: table.roundId,
      roundOrder: table.round.order,
      participantCount: table.participants.length,
    });
    usageByGame.set(table.gameId, list);
  });

  return (
    <div className="space-y-6">
      <SessionTopbar
        title={session.name}
        subtitle="Catalogue des jeux disponibles pour les tables."
        badge="Jeux"
      />

      <SessionTabs sessionId={id} current="games" />

      <Card id="add-game">
        <CardHeader>
          <CardTitle>Ajouter un jeu</CardTitle>
          <CardDescription>Parametres de jeu.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={addGame} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="sessionId" value={id} />
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="game-name">Nom</Label>
              <Input id="game-name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="game-duration">Duree (min)</Label>
              <Input
                id="game-duration"
                name="duration"
                type="number"
                min={1}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="game-min">Joueurs min</Label>
              <Input
                id="game-min"
                name="minPlayers"
                type="number"
                min={1}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="game-max">Joueurs max</Label>
              <Input
                id="game-max"
                name="maxPlayers"
                type="number"
                min={1}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="game-scoring">Scoring</Label>
              <select
                id="game-scoring"
                name="scoringType"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm"
              >
                <option value="ranking">Classement</option>
                <option value="raw">Score brut</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="game-rules">Regles (optionnel)</Label>
              <Textarea
                id="game-rules"
                name="rules"
                placeholder="Ex: scoring final, objectifs, tie-break."
              />
            </div>
            <div className="sm:col-span-2">
              <button className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90">
                Ajouter le jeu
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card id="games-list">
        <CardHeader>
          <CardTitle>Jeux enregistres</CardTitle>
          <CardDescription>Liste des jeux disponibles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {games.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              Aucun jeu enregistre.
            </div>
          ) : (
            <ul className="space-y-2">
              {games.map((game) => (
                <li
                  key={game.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold">{game.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {game.minPlayers}-{game.maxPlayers} joueurs -{" "}
                      {game.duration} min
                    </p>
                    {game.rules ? (
                      <p className="text-xs text-muted-foreground">
                        Regles: {game.rules}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="border-secondary/60 bg-secondary/30 text-foreground ring-1 ring-secondary/40">
                      {game.scoringType === "raw"
                        ? "Score brut"
                        : "Classement"}
                    </Badge>
                    {usageByGame.get(game.id)?.length ? (
                      <GameUsageDialog
                        sessionId={id}
                        gameName={game.name}
                        tables={usageByGame.get(game.id) ?? []}
                      />
                    ) : null}
                    <DeleteGameDialog
                      sessionId={id}
                      gameId={game.id}
                      gameName={game.name}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


