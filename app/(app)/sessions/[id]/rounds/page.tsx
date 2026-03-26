import Link from "next/link";

import {
  addParticipant,
  autoGenerateTables,
  createRound,
  createTable,
  duplicateRound,
  previewRoundValidation,
  setTableRanking,
  updateParticipant,
  validateRound,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SessionTabs } from "@/components/session-tabs";
import { SessionTopbar } from "@/components/session-topbar";
import { formatDate } from "@/lib/format";
import { pointsForPosition } from "@/lib/scoring";
import { prisma } from "@/lib/prisma";

export default async function SessionRoundsPage(
  props: PageProps<"/sessions/[id]/rounds">,
) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const error = typeof searchParams.error === "string" ? searchParams.error : "";
  const success =
    typeof searchParams.success === "string" ? searchParams.success : "";
  const focus = typeof searchParams.focus === "string" ? searchParams.focus : "";

  const session = await prisma.tournamentSession.findUnique({
    where: { id },
  });

  if (!session) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Session introuvable</h1>
        <Link
          href="/dashboard"
          className="text-sm text-foreground/80 transition-colors duration-300 hover:text-foreground hover:underline decoration-accent/70 underline-offset-4"
        >
          &larr; Retour au dashboard
        </Link>
      </div>
    );
  }

  const [rounds, games, players] = await Promise.all([
    prisma.round.findMany({
      where: { sessionId: id },
      orderBy: { order: "asc" },
      include: {
        tables: {
          include: {
            game: true,
            participants: {
              include: { player: true },
            },
          },
        },
      },
    }),
    prisma.game.findMany({ orderBy: { name: "asc" } }),
    prisma.player.findMany({ where: { sessionId: id }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <SessionTopbar
        title={session.name}
        subtitle="Creer les manches et assigner les joueurs aux tables."
        badge="Manches"
      />
      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/15 px-4 py-2 text-sm text-foreground">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-accent/40 bg-accent/15 px-4 py-2 text-sm text-foreground">
          {success}
        </div>
      ) : null}

      <SessionTabs sessionId={id} current="rounds" />

      <Card id="create-round">
        <CardHeader>
          <CardTitle>Creer une manche</CardTitle>
          <CardDescription>Ordre automatique si vide.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createRound} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="sessionId" value={id} />
            <div className="space-y-2">
              <Label htmlFor="round-order">Ordre (optionnel)</Label>
              <Input id="round-order" name="order" type="number" min={1} />
            </div>
            <button className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90">
              Ajouter une manche
            </button>
          </form>
        </CardContent>
      </Card>

      {rounds.length === 0 ? (
        <Card>
          <CardContent>
            <div className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              Aucune manche pour le moment.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div id="rounds-list" className="space-y-6">
          {rounds.map((round) => {
            const assignedCounts = new Map<string, number>();
            for (const table of round.tables) {
              for (const participant of table.participants) {
                assignedCounts.set(
                  participant.playerId,
                  (assignedCounts.get(participant.playerId) ?? 0) + 1,
                );
              }
            }

            const duplicatePlayers = Array.from(assignedCounts.entries())
              .filter(([, count]) => count > 1)
              .map(([playerId]) => {
                const player = players.find((item) => item.id === playerId);
                return player?.name ?? playerId;
              });

            const unassignedPlayers = players
              .filter((player) => !assignedCounts.has(player.id))
              .map((player) => player.name);

            const tableIssues = round.tables.flatMap((table, index) => {
              const count = table.participants.length;
              if (count < table.game.minPlayers || count > table.game.maxPlayers) {
                return [
                  `Table ${index + 1} (${table.game.name}) : ${count} joueur(s) pour ${table.game.minPlayers}-${table.game.maxPlayers}.`,
                ];
              }
              return [];
            });

            const hasIssues =
              duplicatePlayers.length > 0 ||
              unassignedPlayers.length > 0 ||
              tableIssues.length > 0;

            const isLocked = Boolean(round.validatedAt);

            return (
              <Card
                key={round.id}
                className={
                  focus === round.id ? "border-ring/50 ring-1 ring-ring/40" : undefined
                }
              >
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>Manche {round.order}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      {isLocked ? (
                        <Badge className="border-accent/60 bg-accent/30 text-foreground ring-1 ring-accent/40">
                          Valide le {formatDate(round.validatedAt)}
                        </Badge>
                      ) : (
                        <Badge className="border-secondary/60 bg-secondary/30 text-foreground ring-1 ring-secondary/40">
                          En edition
                        </Badge>
                      )}
                      <form action={duplicateRound}>
                        <input type="hidden" name="sessionId" value={id} />
                        <input type="hidden" name="roundId" value={round.id} />
                        <button className="h-7 rounded-lg border border-border px-3 text-xs font-semibold text-foreground/80 transition-colors duration-300 hover:bg-muted hover:text-foreground">
                          Dupliquer
                        </button>
                      </form>
                    </div>
                  </div>
                  <CardDescription>{round.tables.length} table(s)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLocked ? (
                    <div className="rounded-lg border border-accent/40 bg-accent/20 px-4 py-3 text-sm text-foreground">
                      Cette manche est verrouillee. Les modifications sont desactivees.
                    </div>
                  ) : null}
                  {hasIssues ? (
                    <div className="rounded-lg border border-secondary/40 bg-secondary/20 px-4 py-3 text-sm text-foreground">
                      <p className="font-semibold">Contraintes a corriger</p>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {tableIssues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                        {duplicatePlayers.length > 0 ? (
                          <li>
                            Joueurs en doublon : {duplicatePlayers.join(", ")}.
                          </li>
                        ) : null}
                        {unassignedPlayers.length > 0 ? (
                          <li>
                            Joueurs non assignes : {unassignedPlayers.join(", ")}.
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-accent/40 bg-secondary/20 px-4 py-3 text-sm text-foreground">
                      Toutes les contraintes sont respectees pour cette manche.
                    </div>
                  )}

                  {games.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Ajoute un jeu pour creer des tables.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      <form
                        action={createTable}
                        className="flex flex-wrap items-end gap-3"
                      >
                        <input type="hidden" name="sessionId" value={id} />
                        <input type="hidden" name="roundId" value={round.id} />
                        <div className="space-y-2">
                          <Label>Jeu</Label>
                          <select
                            name="gameId"
                            disabled={isLocked}
                            className="h-9 min-w-[180px] rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {games.map((game) => (
                              <option key={game.id} value={game.id}>
                                {game.name} ({game.minPlayers}-{game.maxPlayers})
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isLocked}
                        >
                          Ajouter une table
                        </button>
                      </form>
                      <form
                        action={autoGenerateTables}
                        className="flex flex-wrap items-end gap-3"
                      >
                        <input type="hidden" name="sessionId" value={id} />
                        <input type="hidden" name="roundId" value={round.id} />
                        <div className="space-y-2">
                          <Label>Preset</Label>
                          <select
                            name="preset"
                            disabled={isLocked}
                            className="h-9 min-w-[180px] rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <option value="balanced">Ronde (equilibre)</option>
                            <option value="swiss">Suisse</option>
                            <option value="random">Aleatoire</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>Auto (jeu)</Label>
                          <select
                            name="gameId"
                            disabled={isLocked}
                            className="h-9 min-w-[180px] rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {games.map((game) => (
                              <option key={game.id} value={game.id}>
                                {game.name} ({game.minPlayers}-{game.maxPlayers})
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          className="h-9 rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition-colors duration-300 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isLocked}
                        >
                          Auto-generer
                        </button>
                      </form>
                    </div>
                  )}

                  {round.tables.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aucune table pour cette manche.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {round.tables.map((table, index) => (
                        <Card key={table.id} className="border-border">
                          <CardHeader>
                            <CardTitle>
                              Table {index + 1} Â· {table.game.name}
                            </CardTitle>
                            <CardDescription>
                              {table.participants.length} /{" "}
                              {table.game.maxPlayers} joueurs
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {players.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Ajoute des joueurs avant d assigner une table.
                              </p>
                            ) : (
                              <form
                                action={addParticipant}
                                className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]"
                              >
                                <input
                                  type="hidden"
                                  name="sessionId"
                                  value={id}
                                />
                                <input
                                  type="hidden"
                                  name="roundId"
                                  value={round.id}
                                />
                                <input
                                  type="hidden"
                                  name="tableId"
                                  value={table.id}
                                />
                                <div className="space-y-2">
                                  <Label>Joueur</Label>
                                  <select
                                    name="playerId"
                                    disabled={isLocked}
                                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {players.map((player) => {
                                      const alreadyAssigned = assignedCounts.has(
                                        player.id,
                                      );
                                      return (
                                        <option
                                          key={player.id}
                                          value={player.id}
                                          disabled={alreadyAssigned}
                                        >
                                          {player.name}
                                          {alreadyAssigned
                                            ? " (deja assigne)"
                                            : ""}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Position</Label>
                                  <Input
                                    name="position"
                                    type="number"
                                    min={1}
                                    disabled={isLocked}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Score</Label>
                                  <Input
                                    name="score"
                                    type="number"
                                    min={0}
                                    disabled={isLocked}
                                  />
                                </div>
                                <button
                                  className="h-9 self-end rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                  disabled={isLocked}
                                >
                                  Ajouter
                                </button>
                              </form>
                            )}

                            {table.participants.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Aucun joueur assigne.
                              </p>
                            ) : (
                              <div className="overflow-x-auto">
                                <Table className="min-w-[720px]">
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Joueur</TableHead>
                                      <TableHead>Position</TableHead>
                                      <TableHead>Score</TableHead>
                                      <TableHead>Points</TableHead>
                                      <TableHead>Maj</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {table.participants.map((participant) => (
                                      <TableRow key={participant.id}>
                                        <TableCell>
                                          {participant.player.name}
                                        </TableCell>
                                        <TableCell>
                                          {participant.position ?? "-"}
                                        </TableCell>
                                        <TableCell>{participant.score ?? "-"}</TableCell>
                                        <TableCell>
                                          {table.game.scoringType === "raw"
                                            ? participant.score ?? 0
                                            : pointsForPosition(
                                                participant.position,
                                              )}
                                        </TableCell>
                                        <TableCell>
                                          <form
                                            action={updateParticipant}
                                            className="flex flex-wrap items-center gap-2"
                                          >
                                            <input
                                              type="hidden"
                                              name="sessionId"
                                              value={id}
                                            />
                                            <input
                                              type="hidden"
                                              name="roundId"
                                              value={round.id}
                                            />
                                            <input
                                              type="hidden"
                                              name="participantId"
                                              value={participant.id}
                                            />
                                            <Input
                                              name="position"
                                              type="number"
                                              min={1}
                                              defaultValue={
                                                participant.position ?? undefined
                                              }
                                              className="h-8 w-24"
                                              disabled={isLocked}
                                            />
                                            <Input
                                              name="score"
                                              type="number"
                                              min={0}
                                              defaultValue={
                                                participant.score ?? undefined
                                              }
                                              className="h-8 w-24"
                                              disabled={isLocked}
                                            />
                                            <button
                                              className="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                              disabled={isLocked}
                                            >
                                              Sauver
                                            </button>
                                          </form>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}

                            {table.game.scoringType === "ranking" &&
                            table.participants.length > 1 ? (
                              <div className="rounded-xl border border-border bg-muted p-4">
                                <p className="text-sm font-semibold text-foreground">
                                  Saisie rapide du classement
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Choisis l ordre d arrivee pour attribuer
                                  automatiquement les points.
                                </p>
                                <form
                                  action={setTableRanking}
                                  className="mt-3 grid gap-3 sm:grid-cols-2"
                                >
                                  <input
                                    type="hidden"
                                    name="sessionId"
                                    value={id}
                                  />
                                  <input
                                    type="hidden"
                                    name="roundId"
                                    value={round.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="tableId"
                                    value={table.id}
                                  />
                                  {table.participants.map((participant, index) => (
                                    <div key={participant.id} className="space-y-2">
                                      <Label>Position {index + 1}</Label>
                                      <select
                                        name="ranking"
                                        defaultValue={
                                          participant.position
                                            ? participant.playerId
                                            : ""
                                        }
                                        disabled={isLocked}
                                        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        <option value="">--</option>
                                        {table.participants.map((item) => (
                                          <option
                                            key={item.playerId}
                                            value={item.playerId}
                                          >
                                            {item.player.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ))}
                                  <div className="sm:col-span-2">
                                    <button
                                      className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                      disabled={isLocked}
                                    >
                                      Appliquer le classement
                                    </button>
                                  </div>
                                </form>
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <form action={previewRoundValidation}>
                      <input type="hidden" name="sessionId" value={id} />
                      <input type="hidden" name="roundId" value={round.id} />
                      <button
                        className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition-colors duration-300 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isLocked}
                      >
                        Previsualiser
                      </button>
                    </form>
                    <form action={validateRound}>
                      <input type="hidden" name="sessionId" value={id} />
                      <input type="hidden" name="roundId" value={round.id} />
                      <button
                        className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isLocked}
                      >
                        Valider cette manche
                      </button>
                    </form>
                    <p className="text-xs text-muted-foreground">
                      Cloture auto quand toutes les positions sont saisies.
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

