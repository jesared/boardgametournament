import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LiveRefresh } from "@/components/live-refresh";
import { formatDate } from "@/lib/format";
import { buildLeaderboard } from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";

export default async function PublicSessionPage(
  props: PageProps<"/public/[token]">,
) {
  const { token } = await props.params;

  const share = await prisma.sessionShareToken.findUnique({
    where: { token },
    include: { session: true },
  });

  if (!share) {
    return (
      <div className="min-h-screen bg-background px-6 py-12 text-foreground">
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <CardTitle>Lien invalide</CardTitle>
            <CardDescription>Ce lien public n est plus actif.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const sessionId = share.sessionId;
  const [players, participants] = await Promise.all([
    prisma.player.findMany({ where: { sessionId } }),
    prisma.tableParticipant.findMany({
      where: { table: { round: { sessionId } } },
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
    <div className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{share.session.name}</CardTitle>
            <CardDescription>
              Session du {formatDate(share.session.date)} · Acces public
            </CardDescription>
          </CardHeader>
        </Card>

        <LiveRefresh intervalMs={5000} />

        <Card>
          <CardHeader>
            <CardTitle>Classement</CardTitle>
            <CardDescription>Lecture seule.</CardDescription>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
                Aucun resultat disponible.
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
    </div>
  );
}
