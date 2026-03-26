"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import crypto from "crypto";

import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildLeaderboard } from "@/lib/leaderboard";
import { parseOptionalInt, pointsForPosition } from "@/lib/scoring";
import { sessionTemplates } from "@/lib/session-templates";
import { fetchBggGameDetails } from "@/lib/bgg";
import { fetchBoardGameAtlasGame } from "@/lib/bga";

function requiredString(
  formData: FormData,
  key: string,
  label: string,
) {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} est obligatoire.`);
  }
  return value.trim();
}

function requiredNumber(
  formData: FormData,
  key: string,
  label: string,
  min = 0,
) {
  const value = Number(requiredString(formData, key, label));
  if (Number.isNaN(value) || value < min) {
    throw new Error(`${label} doit etre un nombre valide.`);
  }
  return value;
}

function redirectWithError(path: string, message: string) {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function redirectWithSuccess(path: string, message: string) {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

async function logAction({
  sessionId,
  action,
  entityType,
  entityId,
  message,
}: {
  sessionId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  message?: string;
}) {
  await prisma.changeLog.create({
    data: {
      sessionId,
      action,
      entityType,
      entityId: entityId ?? null,
      message,
    },
  });
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  if (session.user?.role !== "admin") {
    redirect("/unauthorized");
  }
  return session;
}

async function logAdminAction({
  adminId,
  action,
  entityType,
  entityId,
  message,
}: {
  adminId: string;
  action: string;
  entityType?: string;
  entityId?: string | null;
  message?: string;
}) {
  await prisma.adminLog.create({
    data: {
      adminId,
      action,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      message,
    },
  });
}

async function assertRoundEditable(roundId: string, sessionId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { validatedAt: true, sessionId: true },
  });

  if (!round || round.sessionId !== sessionId) {
    redirectWithError(
      `/sessions/${sessionId}/rounds`,
      "Manche introuvable.",
    );
  }

  if (!round) {
    return;
  }

  if (round.validatedAt) {
    redirectWithError(
      `/sessions/${sessionId}/rounds`,
      "Cette manche est deja validee et ne peut plus etre modifiee.",
    );
  }
}

async function buildRoundValidation(roundId: string, sessionId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      tables: {
        include: {
          game: true,
          participants: {
            include: {
              player: true,
            },
          },
        },
      },
    },
  });

  if (!round || round.sessionId !== sessionId) {
    redirectWithError(
      `/sessions/${sessionId}/rounds`,
      "Manche introuvable pour cette session.",
    );
  }
  const safeRound = round!;

  const players = await prisma.player.findMany({
    where: { sessionId },
  });

  const participantMap = new Map<string, number>();
  const errors: string[] = [];

  for (const table of safeRound.tables) {
    const count = table.participants.length;
    if (count < table.game.minPlayers || count > table.game.maxPlayers) {
      errors.push(
        `La table ${table.game.name} a ${count} joueur(s) pour un minimum de ${table.game.minPlayers} et un maximum de ${table.game.maxPlayers}.`,
      );
    }

    for (const participant of table.participants) {
      participantMap.set(
        participant.playerId,
        (participantMap.get(participant.playerId) ?? 0) + 1,
      );
    }
  }

  const unassigned = players.filter(
    (player) => !participantMap.has(player.id),
  );
  if (unassigned.length > 0) {
    errors.push(
      `Joueurs non assignes: ${unassigned.map((player) => player.name).join(", ")}`,
    );
  }

  const duplicateAssignments = Array.from(participantMap.entries()).filter(
    ([, count]) => count > 1,
  );
  if (duplicateAssignments.length > 0) {
    errors.push(
      `Joueurs assignes plusieurs fois: ${duplicateAssignments
        .map(([playerId]) => {
          const player = players.find((item) => item.id === playerId);
          return player?.name ?? playerId;
        })
        .join(", ")}`,
    );
  }

  const pointsAwarded = safeRound.tables
    .flatMap((table) => table.participants)
    .reduce((total, participant) => {
      return total + pointsForPosition(participant.position);
    }, 0);

  return { round: safeRound, errors, pointsAwarded };
}

async function maybeAutoValidateRound(roundId: string, sessionId: string) {
  const { round, errors, pointsAwarded } = await buildRoundValidation(
    roundId,
    sessionId,
  );

  if (round.validatedAt || errors.length > 0) return;

  const allPositionsFilled = round.tables.every((table) =>
    table.participants.every((participant) => participant.position !== null),
  );

  if (!allPositionsFilled) return;

  await prisma.round.update({
    where: { id: roundId },
    data: { validatedAt: new Date() },
  });

  await logAction({
    sessionId,
    action: "auto-validate",
    entityType: "round",
    entityId: roundId,
    message: `Manche validee automatiquement. Points: ${pointsAwarded}.`,
  });

  revalidatePath(`/sessions/${sessionId}/rounds`);
  revalidatePath(`/sessions/${sessionId}/ranking`);
  revalidatePath(`/sessions/${sessionId}`);

  redirectWithSuccess(
    `/sessions/${sessionId}/rounds`,
    `Manche validee automatiquement. Points attribues: ${pointsAwarded}.`,
  );
}

export async function createSession(formData: FormData) {
  const name = requiredString(formData, "name", "Le nom de session");
  const dateValue = requiredString(formData, "date", "La date");
  const date = new Date(`${dateValue}T00:00:00`);

  const session = await prisma.tournamentSession.create({
    data: { name, date },
  });

  await logAction({
    sessionId: session.id,
    action: "create",
    entityType: "session",
    entityId: session.id,
    message: `Session creee: ${session.name}.`,
  });

  redirect(`/sessions/${session.id}`);
}

export async function createSessionWithTemplate(formData: FormData) {
  const name = requiredString(formData, "name", "Le nom de session");
  const dateValue = requiredString(formData, "date", "La date");
  const templateRaw = formData.get("templateId");
  const templateId =
    typeof templateRaw === "string" && templateRaw.trim().length > 0
      ? templateRaw.trim()
      : null;
  const date = new Date(`${dateValue}T00:00:00`);

  const template = templateId
    ? sessionTemplates.find((item) => item.id === templateId)
    : null;

  const session = await prisma.tournamentSession.create({
    data: { name, date },
  });

  if (template) {
    await prisma.game.createMany({
      data: template.games.map((game) => ({
        ...game,
        rules: game.rules ?? null,
      })),
    });

    await logAction({
      sessionId: session.id,
      action: "template",
      entityType: "session",
      entityId: session.id,
      message: `Template applique: ${template.name}.`,
    });
  } else {
    await logAction({
      sessionId: session.id,
      action: "template",
      entityType: "session",
      entityId: session.id,
      message: "Aucun template selectionne.",
    });
  }

  await logAction({
    sessionId: session.id,
    action: "create",
    entityType: "session",
    entityId: session.id,
    message: `Session creee: ${session.name}.`,
  });

  redirect(`/sessions/${session.id}`);
}

export async function addPlayer(formData: FormData) {
  const sessionId = requiredString(formData, "sessionId", "Session");
  const name = requiredString(formData, "name", "Le nom du joueur");

  await prisma.player.create({
    data: { name, sessionId },
  });

  await logAction({
    sessionId,
    action: "create",
    entityType: "player",
    message: `Joueur ajoute: ${name}.`,
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/players`);
  revalidatePath(`/sessions/${sessionId}/rounds`);
  revalidatePath(`/sessions/${sessionId}/ranking`);
}

export async function addGame(formData: FormData) {
  const sessionId = requiredString(formData, "sessionId", "Session");
  const name = requiredString(formData, "name", "Le nom du jeu");
  const minPlayers = requiredNumber(formData, "minPlayers", "Joueurs min", 1);
  const maxPlayers = requiredNumber(formData, "maxPlayers", "Joueurs max", 1);
  const duration = requiredNumber(formData, "duration", "Duree", 1);
  const scoringType = requiredString(formData, "scoringType", "Scoring");
  const rulesRaw = formData.get("rules");
  const rules = typeof rulesRaw === "string" && rulesRaw.trim().length > 0
    ? rulesRaw.trim()
    : null;

  if (minPlayers > maxPlayers) {
    redirectWithError(
      `/sessions/${sessionId}`,
      "Le minimum de joueurs ne peut pas depasser le maximum.",
    );
  }

  await prisma.game.create({
    data: {
      name,
      minPlayers,
      maxPlayers,
      duration,
      scoringType: scoringType === "raw" ? "raw" : "ranking",
      rules,
    },
  });

  await logAction({
    sessionId,
    action: "create",
    entityType: "game",
    message: `Jeu ajoute: ${name}.`,
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/games`);
  revalidatePath(`/sessions/${sessionId}/rounds`);
  revalidatePath(`/sessions/${sessionId}/ranking`);
}

type SessionImportPayload = {
  session: { name: string; date: string };
  players?: Array<{ name: string }>;
  games?: Array<{
    name: string;
    minPlayers: number;
    maxPlayers: number;
    duration: number;
    scoringType: "ranking" | "raw";
    rules?: string;
  }>;
  rounds?: Array<{
    order?: number;
    tables: Array<{
      gameName: string;
      participants: Array<{
        playerName: string;
        position?: number | null;
        score?: number | null;
      }>;
    }>;
  }>;
};

export async function importSessionJson(formData: FormData) {
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    redirectWithError("/dashboard", "Fichier JSON requis.");
  }
  const safeFile = file as File;

  let payload: SessionImportPayload | null = null;
  try {
    payload = JSON.parse(await safeFile.text()) as SessionImportPayload;
  } catch {
    redirectWithError("/dashboard", "JSON invalide.");
  }

  if (!payload || !payload.session?.name || !payload.session?.date) {
    redirectWithError("/dashboard", "Session manquante dans le JSON.");
    return;
  }

  const date = new Date(payload.session.date);
  if (Number.isNaN(date.getTime())) {
    redirectWithError("/dashboard", "Date de session invalide.");
  }

  const session = await prisma.tournamentSession.create({
    data: { name: payload.session.name, date },
  });

  const players = payload.players ?? [];
  if (players.length > 0) {
    await prisma.player.createMany({
      data: players.map((player) => ({ name: player.name, sessionId: session.id })),
    });
  }

  const games = payload.games ?? [];
  if (games.length > 0) {
    await prisma.game.createMany({
      data: games.map((game) => ({ ...game, rules: game.rules ?? null })),
    });
  }

  const [playerRows, gameRows] = await Promise.all([
    prisma.player.findMany({ where: { sessionId: session.id } }),
    prisma.game.findMany(),
  ]);
  const playerMap = new Map(playerRows.map((player) => [player.name, player]));
  const gameMap = new Map(gameRows.map((game) => [game.name, game]));

  if (payload.rounds && payload.rounds.length > 0) {
    for (const [index, roundData] of payload.rounds.entries()) {
      const round = await prisma.round.create({
        data: {
          sessionId: session.id,
          order: roundData.order ?? index + 1,
        },
      });

      for (const tableData of roundData.tables) {
        const game = gameMap.get(tableData.gameName);
        if (!game) {
          redirectWithError(
            "/dashboard",
            `Jeu introuvable: ${tableData.gameName}.`,
          );
          return;
        }

        await prisma.table.create({
          data: {
            roundId: round.id,
            gameId: game.id,
            participants: {
              create: tableData.participants.map((participant) => {
                const player = playerMap.get(participant.playerName);
                if (!player) {
                  redirectWithError(
                    "/dashboard",
                    `Joueur introuvable: ${participant.playerName}.`,
                  );
                  return null;
                }
                return {
                  playerId: player.id,
                  position: participant.position ?? null,
                  score: participant.score ?? null,
                };
              }).filter((value): value is {
                playerId: string;
                position: number | null;
                score: number | null;
              } => value !== null),
            },
          },
        });
      }
    }
  }

  await logAction({
    sessionId: session.id,
    action: "import",
    entityType: "session",
    entityId: session.id,
    message: "Session importee depuis JSON.",
  });

  revalidatePath("/dashboard");
  redirectWithSuccess("/dashboard", "Session importee.");
}

export async function createRound(formData: FormData) {
  const sessionId = requiredString(formData, "sessionId", "Session");
  const orderRaw = formData.get("order");
  let order: number | null = null;

  if (typeof orderRaw === "string" && orderRaw.length > 0) {
    const parsed = Number(orderRaw);
    if (!Number.isNaN(parsed) && parsed > 0) {
      order = parsed;
    }
  }

  if (!order) {
    const lastRound = await prisma.round.findFirst({
      where: { sessionId },
      orderBy: { order: "desc" },
    });
    order = (lastRound?.order ?? 0) + 1;
  }

  const round = await prisma.round.create({
    data: { sessionId, order },
  });

  await logAction({
    sessionId,
    action: "create",
    entityType: "round",
    entityId: round.id,
    message: `Manche creee: ${round.order}.`,
  });

  redirect(`/sessions/${sessionId}/rounds?focus=${round.id}`);
}

export async function duplicateRound(formData: FormData) {
  const sessionId = requiredString(formData, "sessionId", "Session");
  const roundId = requiredString(formData, "roundId", "Manche");

  const [source, lastRound] = await Promise.all([
    prisma.round.findUnique({
      where: { id: roundId },
      include: {
        tables: {
          include: {
            participants: true,
          },
        },
      },
    }),
    prisma.round.findFirst({
      where: { sessionId },
      orderBy: { order: "desc" },
    }),
  ]);

  if (!source || source.sessionId !== sessionId) {
    redirectWithError(`/sessions/${sessionId}/rounds`, "Manche introuvable.");
  }

  const order = (lastRound?.order ?? 0) + 1;

  const newRound = await prisma.round.create({
    data: { sessionId, order },
  });

  if (source.tables.length > 0) {
    await prisma.$transaction(
      source.tables.map((table) =>
        prisma.table.create({
          data: {
            roundId: newRound.id,
            gameId: table.gameId,
            participants: {
              create: table.participants.map((participant) => ({
                playerId: participant.playerId,
                position: null,
                score: null,
              })),
            },
          },
        }),
      ),
    );
  }

  await logAction({
    sessionId,
    action: "duplicate",
    entityType: "round",
    entityId: newRound.id,
    message: `Manche dupliquee depuis ${source.order}.`,
  });

  redirect(
    `/sessions/${sessionId}/rounds?success=${encodeURIComponent(
      "Manche dupliquee.",
    )}&focus=${newRound.id}`,
  );
}

export async function createTable(formData: FormData) {
  const sessionId = requiredString(formData, "sessionId", "Session");
  const roundId = requiredString(formData, "roundId", "Manche");
  const gameId = requiredString(formData, "gameId", "Jeu");

  await assertRoundEditable(roundId, sessionId);

  await prisma.table.create({
    data: { roundId, gameId },
  });

  revalidatePath(`/sessions/${sessionId}/rounds`);
  revalidatePath(`/sessions/${sessionId}/ranking`);
}

export async function addParticipant(formData: FormData) {
  const sessionId = requiredString(formData, "sessionId", "Session");
  const roundId = requiredString(formData, "roundId", "Manche");
  const tableId = requiredString(formData, "tableId", "Table");
  const playerId = requiredString(formData, "playerId", "Joueur");
  const position = parseOptionalInt(formData.get("position"));
  const score = parseOptionalInt(formData.get("score"));

  await assertRoundEditable(roundId, sessionId);

  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      round: true,
      game: true,
      participants: true,
    },
  });

  if (!table || table.roundId !== roundId) {
    redirectWithError(
      `/sessions/${sessionId}/rounds`,
      "Table introuvable.",
    );
  }

  const player = await prisma.player.findFirst({
    where: { id: playerId, sessionId },
  });

  if (!player) {
    redirectWithError(
      `/sessions/${sessionId}/rounds`,
      "Le joueur n'appartient pas a la session.",
    );
  }

  const alreadyAssigned = await prisma.tableParticipant.findFirst({
    where: {
      playerId,
      table: { roundId },
    },
  });

  if (alreadyAssigned) {
    redirectWithError(
      `/sessions/${sessionId}/rounds`,
      "Ce joueur est deja assigne a une autre table de la manche.",
    );
  }

  if (table.participants.length >= table.game.maxPlayers) {
    redirectWithError(
      `/sessions/${sessionId}/rounds`,
      "Cette table a deja atteint le maximum de joueurs.",
    );
  }

  await prisma.tableParticipant.create({
    data: {
      tableId,
      playerId,
      position,
      score,
    },
  });

  revalidatePath(`/sessions/${sessionId}/rounds`);
  revalidatePath(`/sessions/${sessionId}/ranking`);

  await maybeAutoValidateRound(roundId, sessionId);
}

export async function updateParticipant(formData: FormData) {
  const sessionId = requiredString(formData, "sessionId", "Session");
  const participantId = requiredString(formData, "participantId", "Participant");
  const roundId = requiredString(formData, "roundId", "Manche");

  await assertRoundEditable(roundId, sessionId);

  const position = parseOptionalInt(formData.get("position"));
  const score = parseOptionalInt(formData.get("score"));

  await prisma.tableParticipant.update({
    where: { id: participantId },
    data: {
      position,
      score,
    },
  });

  revalidatePath(`/sessions/${sessionId}/rounds`);

  await maybeAutoValidateRound(roundId, sessionId);
}

export async function validateRound(formData: FormData) {
  const sessionId = requiredString(formData, "sessionId", "Session");
  const roundId = requiredString(formData, "roundId", "Manche");
  const { round, errors, pointsAwarded } = await buildRoundValidation(
    roundId,
    sessionId,
  );

  if (round.validatedAt) {
    redirectWithError(
      `/sessions/${sessionId}/rounds`,
      "Cette manche est deja validee.",
    );
  }

  if (errors.length > 0) {
    redirectWithError(
      `/sessions/${sessionId}/rounds`,
      errors.join(" "),
    );
  }

  await prisma.round.update({
    where: { id: roundId },
    data: { validatedAt: new Date() },
  });

  await logAction({
    sessionId,
    action: "validate",
    entityType: "round",
    entityId: roundId,
    message: `Manche validee manuellement. Points: ${pointsAwarded}.`,
  });

  redirectWithSuccess(
    `/sessions/${sessionId}/rounds`,
    `Manche validee. Points attribues: ${pointsAwarded}.`,
  );
}

export async function previewRoundValidation(formData: FormData) {
  const sessionId = requiredString(formData, "sessionId", "Session");
  const roundId = requiredString(formData, "roundId", "Manche");
  const { round, errors, pointsAwarded } = await buildRoundValidation(
    roundId,
    sessionId,
  );

  const missingPositions = round.tables
    .flatMap((table) => table.participants)
    .filter((participant) => participant.position === null).length;

  if (errors.length > 0) {
    redirectWithError(
      `/sessions/${sessionId}/rounds`,
      errors.join(" "),
    );
  }

  const detail = [
    missingPositions > 0
      ? `${missingPositions} position(s) manquante(s)`
      : "Toutes les positions sont remplies",
    `Points a attribuer: ${pointsAwarded}`,
  ].join(" · ");

  redirectWithSuccess(
    `/sessions/${sessionId}/rounds`,
    `Prevalidation OK. ${detail}.`,
  );
}

export async function setTableRanking(formData: FormData) {
  const sessionId = requiredString(formData, "sessionId", "Session");
  const roundId = requiredString(formData, "roundId", "Manche");
  const tableId = requiredString(formData, "tableId", "Table");
  const rankingValues = formData.getAll("ranking");

  await assertRoundEditable(roundId, sessionId);

  const playerIds = rankingValues.filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  const uniquePlayers = new Set(playerIds);
  if (uniquePlayers.size !== playerIds.length) {
    redirectWithError(
      `/sessions/${sessionId}/rounds`,
      "Classement invalide: doublons detectes.",
    );
  }

  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      game: true,
      participants: true,
    },
  });

  if (!table) {
    redirectWithError(
      `/sessions/${sessionId}/rounds`,
      "Table introuvable.",
    );
  }

  if (table.roundId !== roundId) {
    redirectWithError(
      `/sessions/${sessionId}/rounds`,
      "Table non liee a cette manche.",
    );
  }

  if (table.game.scoringType !== "ranking") {
    redirectWithError(
      `/sessions/${sessionId}/rounds`,
      "Ce jeu utilise un scoring brut, pas un classement.",
    );
  }

  const participantIds = new Set(
    table.participants.map((participant) => participant.playerId),
  );

  for (const playerId of playerIds) {
    if (!participantIds.has(playerId)) {
      redirectWithError(
        `/sessions/${sessionId}/rounds`,
        "Classement invalide: joueur non present sur la table.",
      );
    }
  }

  await prisma.$transaction(
    table.participants.map((participant) => {
      const positionIndex = playerIds.indexOf(participant.playerId);
      return prisma.tableParticipant.update({
        where: { id: participant.id },
        data: {
          position: positionIndex === -1 ? null : positionIndex + 1,
        },
      });
    }),
  );

  revalidatePath(`/sessions/${sessionId}/rounds`);
  revalidatePath(`/sessions/${sessionId}/ranking`);

  await maybeAutoValidateRound(roundId, sessionId);
}

export async function autoGenerateTables(formData: FormData) {
  const sessionId = requiredString(formData, "sessionId", "Session");
  const roundId = requiredString(formData, "roundId", "Manche");
  const gameId = requiredString(formData, "gameId", "Jeu");
  const presetRaw = formData.get("preset");
  const preset =
    presetRaw === "swiss" || presetRaw === "random" || presetRaw === "balanced"
      ? presetRaw
      : "balanced";

  await assertRoundEditable(roundId, sessionId);

  const [round, game, players, existingTables, participants] = await Promise.all([
    prisma.round.findUnique({ where: { id: roundId } }),
    prisma.game.findUnique({ where: { id: gameId } }),
    prisma.player.findMany({ where: { sessionId }, orderBy: { name: "asc" } }),
    prisma.table.findMany({ where: { roundId } }),
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

  if (!round || round.sessionId !== sessionId) {
    redirectWithError(`/sessions/${sessionId}/rounds`, "Manche introuvable.");
  }

  if (!game) {
    redirectWithError(`/sessions/${sessionId}/rounds`, "Jeu introuvable.");
  }

  if (existingTables.length > 0) {
    redirectWithError(
      `/sessions/${sessionId}/rounds`,
      "Supprimez les tables existantes avant la generation automatique.",
    );
  }

  if (players.length === 0) {
    redirectWithError(
      `/sessions/${sessionId}/rounds`,
      "Aucun joueur a assigner.",
    );
  }

  const playerCount = players.length;
  let tableCount = Math.ceil(playerCount / game.maxPlayers);
  while (tableCount > 1 && playerCount / tableCount < game.minPlayers) {
    tableCount -= 1;
  }

  if (playerCount < game.minPlayers) {
    redirectWithError(
      `/sessions/${sessionId}/rounds`,
      "Pas assez de joueurs pour creer une table.",
    );
  }

  const baseSize = Math.floor(playerCount / tableCount);
  const remainder = playerCount % tableCount;
  const tableSizes = Array.from({ length: tableCount }, (_, index) =>
    baseSize + (index < remainder ? 1 : 0),
  );

  if (tableSizes.some((size) => size > game.maxPlayers)) {
    redirectWithError(
      `/sessions/${sessionId}/rounds`,
      "Impossible de repartir les joueurs avec les contraintes du jeu.",
    );
  }

  const leaderboard = buildLeaderboard(players, participants);
  const strengthOrder = leaderboard
    .map((entry) => players.find((player) => player.id === entry.playerId))
    .filter((player): player is (typeof players)[number] => Boolean(player));

  let orderedPlayers: typeof players = [];
  if (preset === "random") {
    orderedPlayers = shuffle(players);
  } else if (preset === "swiss") {
    orderedPlayers = strengthOrder;
  } else {
    orderedPlayers = strengthOrder;
  }

  const tables: typeof players[] = Array.from({ length: tableCount }, () => []);

  if (preset === "balanced") {
    let index = 0;
    let direction = 1;
    for (const player of orderedPlayers) {
      while (tables[index].length >= tableSizes[index]) {
        index += direction;
        if (index >= tableCount) {
          index = tableCount - 1;
          direction = -1;
        } else if (index < 0) {
          index = 0;
          direction = 1;
        }
      }
      tables[index].push(player);
      index += direction;
      if (index >= tableCount) {
        index = tableCount - 1;
        direction = -1;
      } else if (index < 0) {
        index = 0;
        direction = 1;
      }
    }
  } else {
    let cursor = 0;
    tableSizes.forEach((size, tableIndex) => {
      tables[tableIndex] = orderedPlayers.slice(cursor, cursor + size);
      cursor += size;
    });
  }

  const tableCreates = tables.map((tablePlayers) =>
    prisma.table.create({
      data: {
        roundId,
        gameId,
        participants: {
          create: tablePlayers.map((player) => ({
            playerId: player.id,
          })),
        },
      },
    }),
  );

  await prisma.$transaction(tableCreates);

  await logAction({
    sessionId,
    action: "auto-generate",
    entityType: "round",
    entityId: roundId,
    message: `Tables generees (${tableCount}) avec preset ${preset}.`,
  });

  revalidatePath(`/sessions/${sessionId}/rounds`);
  revalidatePath(`/sessions/${sessionId}/ranking`);
  revalidatePath(`/sessions/${sessionId}`);

  const presetLabel =
    preset === "swiss" ? "suisse" : preset === "random" ? "aleatoire" : "ronde";

  redirectWithSuccess(
    `/sessions/${sessionId}/rounds`,
    `Tables generees automatiquement (${tableCount}) · preset ${presetLabel}.`,
  );
}

export async function deletePlayer(formData: FormData) {
  const sessionId = requiredString(formData, "sessionId", "Session");
  const playerId = requiredString(formData, "playerId", "Joueur");

  await prisma.player.delete({
    where: { id: playerId },
  });

  await logAction({
    sessionId,
    action: "delete",
    entityType: "player",
    entityId: playerId,
    message: "Joueur supprime.",
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/players`);
  revalidatePath(`/sessions/${sessionId}/rounds`);
  revalidatePath(`/sessions/${sessionId}/ranking`);
}

export async function deleteGame(formData: FormData) {
  const sessionId = requiredString(formData, "sessionId", "Session");
  const gameId = requiredString(formData, "gameId", "Jeu");

  const hasTables = await prisma.table.findFirst({
    where: { gameId },
    select: { id: true },
  });

  if (hasTables) {
    redirectWithError(
      `/sessions/${sessionId}/games`,
      "Impossible de supprimer ce jeu : il est deja utilise dans des tables.",
    );
  }

  await prisma.game.delete({ where: { id: gameId } });

  await logAction({
    sessionId,
    action: "delete",
    entityType: "game",
    entityId: gameId,
    message: "Jeu supprime.",
  });

  revalidatePath(`/sessions/${sessionId}/games`);
  revalidatePath(`/sessions/${sessionId}/rounds`);
  revalidatePath(`/sessions/${sessionId}`);
}

export async function addGameGlobal(formData: FormData) {
  const session = await requireAdmin();
  const name = requiredString(formData, "name", "Le nom du jeu");
  const minPlayers = requiredNumber(formData, "minPlayers", "Joueurs min", 1);
  const maxPlayers = requiredNumber(formData, "maxPlayers", "Joueurs max", 1);
  const duration = requiredNumber(formData, "duration", "Duree", 1);
  const scoringType = requiredString(formData, "scoringType", "Scoring");
  const rulesRaw = formData.get("rules");
  const rules = typeof rulesRaw === "string" && rulesRaw.trim().length > 0
    ? rulesRaw.trim()
    : null;

  if (minPlayers > maxPlayers) {
    redirectWithError(
      "/admin",
      "Le minimum de joueurs ne peut pas depasser le maximum.",
    );
  }

  const game = await prisma.game.create({
    data: {
      name,
      minPlayers,
      maxPlayers,
      duration,
      scoringType: scoringType === "raw" ? "raw" : "ranking",
      rules,
    },
  });

  await logAdminAction({
    adminId: session.user.id,
    action: "create-game",
    entityType: "game",
    entityId: game.id,
    message: `Jeu global ajoute: ${game.name}.`,
  });

  revalidatePath("/admin");
  redirectWithSuccess("/admin", "Jeu ajoute.");
}

export async function updateGameGlobal(formData: FormData) {
  const session = await requireAdmin();
  const gameId = requiredString(formData, "gameId", "Jeu");
  const name = requiredString(formData, "name", "Le nom du jeu");
  const minPlayers = requiredNumber(formData, "minPlayers", "Joueurs min", 1);
  const maxPlayers = requiredNumber(formData, "maxPlayers", "Joueurs max", 1);
  const duration = requiredNumber(formData, "duration", "Duree", 1);
  const scoringType = requiredString(formData, "scoringType", "Scoring");
  const rulesRaw = formData.get("rules");
  const rules = typeof rulesRaw === "string" && rulesRaw.trim().length > 0
    ? rulesRaw.trim()
    : null;

  if (minPlayers > maxPlayers) {
    redirectWithError(
      "/admin",
      "Le minimum de joueurs ne peut pas depasser le maximum.",
    );
  }

  await prisma.game.update({
    where: { id: gameId },
    data: {
      name,
      minPlayers,
      maxPlayers,
      duration,
      scoringType: scoringType === "raw" ? "raw" : "ranking",
      rules,
    },
  });

  await logAdminAction({
    adminId: session.user.id,
    action: "update-game",
    entityType: "game",
    entityId: gameId,
    message: `Jeu global mis a jour: ${name}.`,
  });

  revalidatePath("/admin");
  redirectWithSuccess("/admin", "Jeu mis a jour.");
}

export async function deleteGameGlobal(formData: FormData) {
  const session = await requireAdmin();
  const gameId = requiredString(formData, "gameId", "Jeu");

  const hasTables = await prisma.table.findFirst({
    where: { gameId },
    select: { id: true },
  });

  if (hasTables) {
    redirectWithError(
      "/admin",
      "Impossible de supprimer ce jeu : il est deja utilise dans des tables.",
    );
  }

  await prisma.game.delete({ where: { id: gameId } });

  await logAdminAction({
    adminId: session.user.id,
    action: "delete-game",
    entityType: "game",
    entityId: gameId,
    message: "Jeu global supprime.",
  });

  revalidatePath("/admin");
  redirectWithSuccess("/admin", "Jeu supprime.");
}

export async function importGameFromBgg(formData: FormData) {
  const session = await requireAdmin();
  const bggId = requiredString(formData, "bggId", "Jeu BGG");

  let details;
  try {
    details = await fetchBggGameDetails(bggId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "BGG indisponible.";
    redirectWithError("/admin", message);
  }
  const existing = await prisma.game.findFirst({
    where: {
      name: {
        equals: details.name,
        mode: "insensitive",
      },
    },
  });

  if (existing) {
    redirectWithError("/admin", "Ce jeu existe deja dans le catalogue.");
  }

  const duration = details.playingTime > 0 ? details.playingTime : 30;
  const minPlayers = Math.max(1, details.minPlayers);
  const maxPlayers = Math.max(minPlayers, details.maxPlayers);

  const game = await prisma.game.create({
    data: {
      name: details.name,
      minPlayers,
      maxPlayers,
      duration,
      scoringType: "ranking",
    },
  });

  await logAdminAction({
    adminId: session.user.id,
    action: "import-bgg",
    entityType: "game",
    entityId: game.id,
    message: `Jeu importe: ${details.name} (BGG ${details.id}).`,
  });

  revalidatePath("/admin");
  redirectWithSuccess("/admin", "Jeu importe depuis BGG.");
}

export async function importGameFromAtlas(formData: FormData) {
  const session = await requireAdmin();
  const bgaId = requiredString(formData, "bgaId", "Jeu BGA");
  const clientId = process.env.BGA_CLIENT_ID ?? "";

  if (!clientId) {
    redirectWithError("/admin", "BGA_CLIENT_ID manquant.");
  }

  let details;
  try {
    details = await fetchBoardGameAtlasGame(bgaId, clientId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "BGA indisponible.";
    redirectWithError("/admin", message);
  }

  const existing = await prisma.game.findFirst({
    where: {
      name: {
        equals: details.name,
        mode: "insensitive",
      },
    },
  });

  if (existing) {
    redirectWithError("/admin", "Ce jeu existe deja dans le catalogue.");
  }

  const duration = details.playingTime > 0 ? details.playingTime : 30;
  const minPlayers = Math.max(1, details.minPlayers);
  const maxPlayers = Math.max(minPlayers, details.maxPlayers);

  const game = await prisma.game.create({
    data: {
      name: details.name,
      minPlayers,
      maxPlayers,
      duration,
      scoringType: "ranking",
    },
  });

  await logAdminAction({
    adminId: session.user.id,
    action: "import-bga",
    entityType: "game",
    entityId: game.id,
    message: `Jeu importe: ${details.name} (BGA ${details.id}).`,
  });

  revalidatePath("/admin");
  redirectWithSuccess("/admin", "Jeu importe depuis Board Game Atlas.");
}

export async function deleteSession(formData: FormData) {
  const sessionId = requiredString(formData, "sessionId", "Session");

  await prisma.tournamentSession.delete({
    where: { id: sessionId },
  });

  const adminSession = await getServerSession(authOptions);
  if (adminSession?.user?.role === "admin") {
    await logAdminAction({
      adminId: adminSession.user.id,
      action: "delete-session",
      entityType: "session",
      entityId: sessionId,
      message: "Session supprimee.",
    });
  }

  await logAction({
    sessionId,
    action: "delete",
    entityType: "session",
    entityId: sessionId,
    message: "Session supprimee.",
  });

  revalidatePath("/dashboard");
  redirectWithSuccess("/dashboard", "Session supprimee.");
}

export async function createShareToken(formData: FormData) {
  const sessionId = requiredString(formData, "sessionId", "Session");

  await prisma.sessionShareToken.deleteMany({
    where: { sessionId },
  });

  const token = crypto.randomBytes(16).toString("hex");
  await prisma.sessionShareToken.create({
    data: {
      sessionId,
      token,
    },
  });

  await logAction({
    sessionId,
    action: "share",
    entityType: "session",
    entityId: sessionId,
    message: "Lien public genere.",
  });

  revalidatePath(`/sessions/${sessionId}`);
  redirectWithSuccess(`/sessions/${sessionId}`, "Lien public genere.");
}

export async function revokeShareToken(formData: FormData) {
  const sessionId = requiredString(formData, "sessionId", "Session");

  await prisma.sessionShareToken.deleteMany({
    where: { sessionId },
  });

  await logAction({
    sessionId,
    action: "share",
    entityType: "session",
    entityId: sessionId,
    message: "Lien public revoque.",
  });

  revalidatePath(`/sessions/${sessionId}`);
  redirectWithSuccess(`/sessions/${sessionId}`, "Lien public revoque.");
}

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const separator = lines[0].includes(";") ? ";" : ",";
  const hasHeader =
    /name|nom|player/i.test(lines[0]) || lines[0].includes(separator);

  const startIndex = hasHeader ? 1 : 0;

  return lines.slice(startIndex).map((line) => {
    const [first] = line.split(separator);
    return first?.replace(/^"|"$/g, "").trim();
  });
}

export async function importPlayersCsv(formData: FormData) {
  const sessionId = requiredString(formData, "sessionId", "Session");
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    redirectWithError(`/sessions/${sessionId}/players`, "Fichier CSV requis.");
  }

  const text = await file.text();
  const names = parseCsv(text).filter(Boolean);

  if (names.length === 0) {
    redirectWithError(
      `/sessions/${sessionId}/players`,
      "Aucun joueur valide trouve dans le CSV.",
    );
  }

  const existing = await prisma.player.findMany({
    where: { sessionId },
    select: { name: true },
  });
  const existingSet = new Set(
    existing.map((player) => player.name.toLowerCase()),
  );

  const uniqueNames = Array.from(
    new Set(names.map((name) => name!.trim()).filter(Boolean)),
  ).filter((name) => !existingSet.has(name.toLowerCase()));

  if (uniqueNames.length === 0) {
    redirectWithError(
      `/sessions/${sessionId}/players`,
      "Tous les joueurs existent deja.",
    );
  }

  await prisma.player.createMany({
    data: uniqueNames.map((name) => ({ name, sessionId })),
  });

  await logAction({
    sessionId,
    action: "import",
    entityType: "player",
    message: `${uniqueNames.length} joueur(s) importes.`,
  });

  redirectWithSuccess(
    `/sessions/${sessionId}/players`,
    `${uniqueNames.length} joueur(s) importes.`,
  );
}

export async function updateUserRole(formData: FormData) {
  const session = await requireAdmin();
  const userId = requiredString(formData, "userId", "Utilisateur");
  const role = requiredString(formData, "role", "Role");

  const nextRole =
    role === "admin" || role === "organizer" || role === "viewer"
      ? role
      : null;

  if (!nextRole) {
    redirectWithError("/admin", "Role invalide.");
  }

  if (userId === session.user?.id && nextRole !== "admin") {
    redirectWithError(
      "/admin",
      "Impossible de retirer vos propres droits admin.",
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: nextRole },
  });

  await logAdminAction({
    adminId: session.user.id,
    action: "update-role",
    entityType: "user",
    entityId: userId,
    message: `Role defini: ${nextRole}.`,
  });

  revalidatePath("/admin");
  redirectWithSuccess("/admin", "Role mis a jour.");
}

export async function deleteUser(formData: FormData) {
  const session = await requireAdmin();
  const userId = requiredString(formData, "userId", "Utilisateur");

  if (userId === session.user?.id) {
    redirectWithError(
      "/admin",
      "Vous ne pouvez pas supprimer votre propre compte.",
    );
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  await logAdminAction({
    adminId: session.user.id,
    action: "delete-user",
    entityType: "user",
    entityId: userId,
    message: "Utilisateur supprime.",
  });

  revalidatePath("/admin");
  redirectWithSuccess("/admin", "Utilisateur supprime.");
}

export async function inviteUser(formData: FormData) {
  const session = await requireAdmin();
  const email = requiredString(formData, "email", "Email").toLowerCase();
  const role = requiredString(formData, "role", "Role");

  const nextRole =
    role === "admin" || role === "organizer" || role === "viewer"
      ? role
      : null;

  if (!nextRole) {
    redirectWithError("/admin", "Role invalide.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirectWithError("/admin", "Un compte avec cet email existe deja.");
  }

  await prisma.user.create({
    data: {
      email,
      role: nextRole,
      isActive: true,
    },
  });

  await logAdminAction({
    adminId: session.user.id,
    action: "invite-user",
    entityType: "user",
    message: `Invitation creee pour ${email}.`,
  });

  revalidatePath("/admin");
  redirectWithSuccess("/admin", "Utilisateur invite.");
}

export async function setUserActive(formData: FormData) {
  const session = await requireAdmin();
  const userId = requiredString(formData, "userId", "Utilisateur");
  const activeRaw = requiredString(formData, "active", "Etat");
  const active = activeRaw === "true";

  if (userId === session.user?.id && !active) {
    redirectWithError(
      "/admin",
      "Vous ne pouvez pas desactiver votre propre compte.",
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: active },
  });

  if (!active) {
    await prisma.session.deleteMany({
      where: { userId },
    });
  }

  await logAdminAction({
    adminId: session.user.id,
    action: active ? "activate-user" : "deactivate-user",
    entityType: "user",
    entityId: userId,
    message: active ? "Compte reactive." : "Compte desactive.",
  });

  revalidatePath("/admin");
  redirectWithSuccess(
    "/admin",
    active ? "Compte reactive." : "Compte desactive.",
  );
}

export async function forceUserSignOut(formData: FormData) {
  const session = await requireAdmin();
  const userId = requiredString(formData, "userId", "Utilisateur");

  await prisma.session.deleteMany({
    where: { userId },
  });

  await prisma.authLog.create({
    data: {
      userId,
      action: "force-sign-out",
    },
  });

  await logAdminAction({
    adminId: session.user.id,
    action: "force-sign-out",
    entityType: "user",
    entityId: userId,
    message: "Reconnexion forcee.",
  });

  revalidatePath("/admin");
  redirectWithSuccess("/admin", "Reconnexion forcee.");
}

export async function revalidateAllRankings() {
  const session = await requireAdmin();

  const sessions = await prisma.tournamentSession.findMany({
    select: { id: true },
  });

  sessions.forEach((session) => {
    revalidatePath(`/sessions/${session.id}`);
    revalidatePath(`/sessions/${session.id}/ranking`);
    revalidatePath(`/sessions/${session.id}/rounds`);
  });

  revalidatePath("/dashboard");
  revalidatePath("/admin");

  await logAdminAction({
    adminId: session.user.id,
    action: "revalidate-rankings",
    message: "Classements recalcules.",
  });

  redirectWithSuccess("/admin", "Classements recalcules.");
}

export async function cleanupInactiveSessions(formData: FormData) {
  const session = await requireAdmin();
  const daysRaw = formData.get("days");
  const days =
    typeof daysRaw === "string" && daysRaw.trim().length > 0
      ? Number(daysRaw)
      : 30;

  if (Number.isNaN(days) || days < 1) {
    redirectWithError("/admin", "Nombre de jours invalide.");
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const candidates = await prisma.tournamentSession.findMany({
    where: {
      createdAt: { lt: cutoff },
      rounds: { none: {} },
      players: { none: {} },
    },
    select: { id: true, name: true },
  });

  if (candidates.length === 0) {
    redirectWithSuccess("/admin", "Aucune session inactive a nettoyer.");
  }

  const ids = candidates.map((item) => item.id);
  await prisma.tournamentSession.deleteMany({
    where: { id: { in: ids } },
  });

  await logAdminAction({
    adminId: session.user.id,
    action: "cleanup-sessions",
    entityType: "session",
    message: `${candidates.length} session(s) supprimee(s).`,
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirectWithSuccess(
    "/admin",
    `${candidates.length} session(s) supprimee(s).`,
  );
}

export async function dedupePlayers() {
  const session = await requireAdmin();

  const sessions = await prisma.tournamentSession.findMany({
    select: { id: true },
  });

  let removed = 0;

  for (const sessionItem of sessions) {
    const players = await prisma.player.findMany({
      where: { sessionId: sessionItem.id },
      orderBy: { id: "asc" },
    });

    const groups = new Map<string, typeof players>();
    players.forEach((player) => {
      const key = normalizeName(player.name);
      const group = groups.get(key) ?? [];
      group.push(player);
      groups.set(key, group);
    });

    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const [keep, ...duplicates] = group;

      await prisma.$transaction([
        prisma.tableParticipant.updateMany({
          where: { playerId: { in: duplicates.map((item) => item.id) } },
          data: { playerId: keep.id },
        }),
        prisma.player.deleteMany({
          where: { id: { in: duplicates.map((item) => item.id) } },
        }),
      ]);

      removed += duplicates.length;
    }
  }

  await logAdminAction({
    adminId: session.user.id,
    action: "dedupe-players",
    entityType: "player",
    message: `${removed} joueur(s) dupliques supprimes.`,
  });

  revalidatePath("/admin");
  redirectWithSuccess(
    "/admin",
    `${removed} joueur(s) dupliques supprimes.`,
  );
}

export async function dedupeGames() {
  const session = await requireAdmin();

  const games = await prisma.game.findMany({
    orderBy: { id: "asc" },
  });

  const groups = new Map<string, typeof games>();
  games.forEach((game) => {
    const key = normalizeName(game.name);
    const group = groups.get(key) ?? [];
    group.push(game);
    groups.set(key, group);
  });

  let removed = 0;

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const [keep, ...duplicates] = group;

    const compatible = duplicates.filter(
      (game) =>
        game.minPlayers === keep.minPlayers &&
        game.maxPlayers === keep.maxPlayers &&
        game.duration === keep.duration &&
        game.scoringType === keep.scoringType &&
        (game.rules ?? "") === (keep.rules ?? ""),
    );

    if (compatible.length === 0) continue;

    await prisma.$transaction([
      prisma.table.updateMany({
        where: { gameId: { in: compatible.map((item) => item.id) } },
        data: { gameId: keep.id },
      }),
      prisma.game.deleteMany({
        where: { id: { in: compatible.map((item) => item.id) } },
      }),
    ]);

    removed += compatible.length;
  }

  await logAdminAction({
    adminId: session.user.id,
    action: "dedupe-games",
    entityType: "game",
    message: `${removed} jeu(x) dupliques supprimes.`,
  });

  revalidatePath("/admin");
  redirectWithSuccess("/admin", `${removed} jeu(x) dupliques supprimes.`);
}

export async function migrateTemplateGames(formData: FormData) {
  const session = await requireAdmin();
  const templateId = requiredString(formData, "templateId", "Template");

  const template = sessionTemplates.find((item) => item.id === templateId);
  if (!template) {
    redirectWithError("/admin", "Template introuvable.");
  }

  const existing = await prisma.game.findMany({
    select: { name: true },
  });
  const existingSet = new Set(existing.map((game) => normalizeName(game.name)));

  const toCreate = template.games.filter(
    (game) => !existingSet.has(normalizeName(game.name)),
  );

  if (toCreate.length === 0) {
    redirectWithSuccess("/admin", "Aucun jeu a migrer.");
  }

  await prisma.game.createMany({
    data: toCreate.map((game) => ({ ...game, rules: game.rules ?? null })),
  });

  await logAdminAction({
    adminId: session.user.id,
    action: "migrate-template",
    entityType: "game",
    message: `${toCreate.length} jeu(x) ajoute(s) depuis le template ${template.name}.`,
  });

  revalidatePath("/admin");
  redirectWithSuccess(
    "/admin",
    `${toCreate.length} jeu(x) ajoute(s).`,
  );
}





