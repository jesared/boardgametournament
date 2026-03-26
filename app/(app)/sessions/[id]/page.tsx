import Link from "next/link";
import { headers } from "next/headers";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SessionTabs } from "@/components/session-tabs";
import { SessionTopbar } from "@/components/session-topbar";
import { LiveRefresh } from "@/components/live-refresh";
import { formatDate } from "@/lib/format";
import { buildLeaderboard } from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";
import { createShareToken, revokeShareToken } from "@/app/actions";

export default async function SessionOverviewPage(
  props: PageProps<"/sessions/[id]">,
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

  const [players, games, rounds, participants, shareToken] = await Promise.all([
    prisma.player.findMany({ where: { sessionId: id } }),
    prisma.game.findMany(),
    prisma.round.findMany({ where: { sessionId: id } }),
    prisma.tableParticipant.findMany({
      where: { table: { round: { sessionId: id } } },
      include: {
        table: {
          include: {
            game: true,
            round: true,
          },
        },
      },
    }),
    prisma.sessionShareToken.findFirst({ where: { sessionId: id } }),
  ]);

  const leaderboard = buildLeaderboard(players, participants).slice(0, 5);
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  const shareUrl =
    shareToken && host
      ? `${proto}://${host}/public/${shareToken.token}`
      : shareToken
        ? `/public/${shareToken.token}`
        : "";

  return (
    <div className="space-y-6">
      <SessionTopbar
        title={session.name}
        subtitle={`Date: ${formatDate(session.date)}`}
        badge="Vue session"
      />

      <SessionTabs sessionId={id} current="overview" />
      <LiveRefresh intervalMs={5000} />

      <Card>
        <CardHeader>
          <CardTitle>Timeline du tournoi</CardTitle>
          <CardDescription>Suivi rapide de l avancement de la session.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted px-4 py-3">
              <div>
                <p className="font-semibold">1. Session creee</p>
                <p className="text-xs text-muted-foreground">
                  Nom, date et contexte de la journee de jeu.
                </p>
              </div>
              <Badge className="border-accent/60 bg-accent/30 text-foreground ring-1 ring-accent/40">
                OK
              </Badge>
            </li>
            <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted px-4 py-3">
              <div>
                <p className="font-semibold">2. Joueurs</p>
                <p className="text-xs text-muted-foreground">
                  Ajoute les participants du tournoi.
                </p>
              </div>
              {players.length > 0 ? (
                <Badge className="border-accent/60 bg-accent/30 text-foreground ring-1 ring-accent/40">
                  {players.length} joueur(s)
                </Badge>
              ) : (
                <Badge className="border-secondary/60 bg-secondary/30 text-foreground ring-1 ring-secondary/40">
                  A faire
                </Badge>
              )}
            </li>
            <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted px-4 py-3">
              <div>
                <p className="font-semibold">3. Jeux</p>
                <p className="text-xs text-muted-foreground">
                  Configure les jeux et leurs contraintes.
                </p>
              </div>
              {games.length > 0 ? (
                <Badge className="border-accent/60 bg-accent/30 text-foreground ring-1 ring-accent/40">
                  {games.length} jeu(x)
                </Badge>
              ) : (
                <Badge className="border-secondary/60 bg-secondary/30 text-foreground ring-1 ring-secondary/40">
                  A faire
                </Badge>
              )}
            </li>
            <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted px-4 py-3">
              <div>
                <p className="font-semibold">4. Manches et tables</p>
                <p className="text-xs text-muted-foreground">
                  Cree les manches et assigne les joueurs.
                </p>
              </div>
              {rounds.length > 0 ? (
                <Badge className="border-accent/60 bg-accent/30 text-foreground ring-1 ring-accent/40">
                  {rounds.length} manche(s)
                </Badge>
              ) : (
                <Badge className="border-secondary/60 bg-secondary/30 text-foreground ring-1 ring-secondary/40">
                  A faire
                </Badge>
              )}
            </li>
            <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted px-4 py-3">
              <div>
                <p className="font-semibold">5. Resultats</p>
                <p className="text-xs text-muted-foreground">
                  Saisis les positions et scores par table.
                </p>
              </div>
              {participants.length > 0 ? (
                <Badge className="border-accent/60 bg-accent/30 text-foreground ring-1 ring-accent/40">
                  {participants.length} resultat(s)
                </Badge>
              ) : (
                <Badge className="border-secondary/60 bg-secondary/30 text-foreground ring-1 ring-secondary/40">
                  A faire
                </Badge>
              )}
            </li>
            <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted px-4 py-3">
              <div>
                <p className="font-semibold">6. Classement</p>
                <p className="text-xs text-muted-foreground">
                  Classement live avec export CSV/PDF.
                </p>
              </div>
              <Badge className="border-accent/60 bg-accent/30 text-foreground ring-1 ring-accent/40">
                Disponible
              </Badge>
            </li>
          </ol>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Joueurs</CardTitle>
            <CardDescription>Total joueurs</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{players.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Jeux</CardTitle>
            <CardDescription>Catalogue actif</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{games.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Manches</CardTitle>
            <CardDescription>Manches creees</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{rounds.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Resultats</CardTitle>
            <CardDescription>Scores saisis</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{participants.length}</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Partage public</CardTitle>
          <CardDescription>
            Lien en lecture seule pour le classement et les infos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {shareToken ? (
            <>
              <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Lien actif
                </p>
                <p className="mt-1 break-all text-sm text-foreground">
                  {shareUrl}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={createShareToken}>
                  <input type="hidden" name="sessionId" value={id} />
                  <button className="h-9 rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition-colors duration-300 hover:bg-muted">
                    Regenerer
                  </button>
                </form>
                <form action={revokeShareToken}>
                  <input type="hidden" name="sessionId" value={id} />
                  <button className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90">
                    Revoquer
                  </button>
                </form>
              </div>
            </>
          ) : (
            <form action={createShareToken}>
              <input type="hidden" name="sessionId" value={id} />
              <button className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90">
                Generer un lien public
              </button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top 5 classement</CardTitle>
          <CardDescription>Points, victoires et position moyenne.</CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              Pas encore de resultats saisis.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[640px] [font-variant-numeric:tabular-nums_lining-nums]">
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Joueur</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Victoires</TableHead>
                    <TableHead>Pos moyenne</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((entry, index) => (
                    <TableRow key={entry.playerId}>
                      <TableCell className="font-semibold">
                        {index + 1}
                      </TableCell>
                      <TableCell>{entry.name}</TableCell>
                      <TableCell>{entry.totalPoints}</TableCell>
                      <TableCell>{entry.wins}</TableCell>
                      <TableCell>
                        {entry.averagePosition
                          ? entry.averagePosition.toFixed(2)
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}




