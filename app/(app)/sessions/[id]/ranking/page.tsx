import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SessionTabs } from "@/components/session-tabs";
import { SessionTopbar, topbarActionClass } from "@/components/session-topbar";
import { LiveRefresh } from "@/components/live-refresh";
import { buildLeaderboard } from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";

export default async function SessionRankingPage(
  props: PageProps<"/sessions/[id]/ranking">,
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

  const [players, participants] = await Promise.all([
    prisma.player.findMany({ where: { sessionId: id } }),
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
  ]);

  const leaderboard = buildLeaderboard(players, participants);

  return (
    <div className="space-y-6">
      <SessionTopbar
        title={session.name}
        subtitle="Classement en temps reel."
        badge="Classement"
        actions={
          <>
            <a
              href={`/sessions/${id}/ranking/export/csv`}
              className={`${topbarActionClass} border border-border text-foreground/80 hover:bg-muted hover:text-foreground`}
            >
              Export CSV
            </a>
            <a
              href={`/sessions/${id}/ranking/export/pdf`}
              className={`${topbarActionClass} bg-primary text-primary-foreground hover:bg-primary/90`}
            >
              Export PDF
            </a>
          </>
        }
      />

      <SessionTabs sessionId={id} current="ranking" />
      <LiveRefresh intervalMs={5000} />

      <Card>
        <CardHeader>
          <CardTitle>Classement</CardTitle>
          <CardDescription>
            Tri par points, victoires et position moyenne.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              Aucun resultat saisi.
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

