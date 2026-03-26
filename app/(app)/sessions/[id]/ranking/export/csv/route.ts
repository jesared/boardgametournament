import { buildLeaderboard } from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await context.params;
  const sessionId = params.id;

  const [session, players, participants] = await Promise.all([
    prisma.tournamentSession.findUnique({ where: { id: sessionId } }),
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

  if (!session) {
    return new Response("Session introuvable", { status: 404 });
  }

  const leaderboard = buildLeaderboard(players, participants);
  const header = ["Rang", "Joueur", "Points", "Victoires", "Position moyenne"];
  const rows = leaderboard.map((entry, index) => [
    String(index + 1),
    entry.name,
    String(entry.totalPoints),
    String(entry.wins),
    entry.averagePosition ? entry.averagePosition.toFixed(2) : "",
  ]);

  const csv = [header, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const safe = cell.replace(/"/g, '""');
          return `"${safe}"`;
        })
        .join(","),
    )
    .join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"classement-${session.name}.csv\"`,
    },
  });
}

