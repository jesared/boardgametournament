import PDFDocument from "pdfkit";
import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";
import { buildLeaderboard } from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";

async function renderGlobalPdf(
  sessions: Array<{ id: string; name: string; date: Date }>,
  playersBySession: Map<string, Parameters<typeof buildLeaderboard>[0]>,
  participantsBySession: Map<string, Parameters<typeof buildLeaderboard>[1]>,
) {
  const doc = new PDFDocument({ margin: 48 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  sessions.forEach((sessionItem, sessionIndex) => {
    if (sessionIndex > 0) {
      doc.addPage();
    }

    doc.fontSize(18).fillColor("#111").text(sessionItem.name, { align: "left" });
    doc
      .fontSize(11)
      .fillColor("#444")
      .text(`Classement global · ${sessionItem.date.toLocaleDateString("fr-FR")}`);
    doc.moveDown(0.8);

    const leaderboard = buildLeaderboard(
      playersBySession.get(sessionItem.id) ?? [],
      participantsBySession.get(sessionItem.id) ?? [],
    );

    const colX = [48, 90, 280, 360, 430];
    doc.fontSize(10).fillColor("#111");
    doc.text("#", colX[0], doc.y);
    doc.text("Joueur", colX[1], doc.y);
    doc.text("Points", colX[2], doc.y);
    doc.text("Victoires", colX[3], doc.y);
    doc.text("Pos. moy.", colX[4], doc.y);
    doc.moveDown(0.5);

    doc.fontSize(9).fillColor("#333");
    leaderboard.forEach((entry, index) => {
      doc.text(String(index + 1), colX[0], doc.y);
      doc.text(entry.name, colX[1], doc.y);
      doc.text(String(entry.totalPoints), colX[2], doc.y);
      doc.text(String(entry.wins), colX[3], doc.y);
      doc.text(
        entry.averagePosition ? entry.averagePosition.toFixed(2) : "-",
        colX[4],
        doc.y,
      );
      doc.moveDown(0.35);
    });

    if (leaderboard.length === 0) {
      doc.text("Aucun resultat pour cette session.", colX[0], doc.y);
    }
  });

  doc.end();

  return new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (session.user?.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const sessions = await prisma.tournamentSession.findMany({
    orderBy: { createdAt: "desc" },
  });

  const sessionIds = sessions.map((item) => item.id);
  const [players, participants] = await Promise.all([
    prisma.player.findMany({
      where: { sessionId: { in: sessionIds } },
    }),
    prisma.tableParticipant.findMany({
      where: { table: { round: { sessionId: { in: sessionIds } } } },
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

  const playersBySession = new Map(
    sessionIds.map((id) => [id, [] as typeof players]),
  );
  players.forEach((player) => {
    const list = playersBySession.get(player.sessionId);
    if (list) list.push(player);
  });

  const participantsBySession = new Map(
    sessionIds.map((id) => [id, [] as typeof participants]),
  );
  participants.forEach((participant) => {
    const sessionId = participant.table.round.sessionId;
    const list = participantsBySession.get(sessionId);
    if (list) list.push(participant);
  });

  const buffer = await renderGlobalPdf(
    sessions,
    playersBySession,
    participantsBySession,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="classements-global.pdf"',
    },
  });
}
