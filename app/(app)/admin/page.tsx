import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";
import {
  cleanupInactiveSessions,
  dedupeGames,
  dedupePlayers,
  forceUserSignOut,
  inviteUser,
  addGameGlobal,
  migrateTemplateGames,
  revalidateAllRankings,
  setUserActive,
  updateUserRole,
} from "@/app/actions";
import { DeleteUserDialog } from "@/components/delete-user-dialog";
import { DeleteGameGlobalDialog } from "@/components/delete-game-global-dialog";
import { DeleteSessionDialog } from "@/components/delete-session-dialog";
import { EditGameDialog } from "@/components/edit-game-dialog";
import { QuickGameForm } from "@/components/quick-game-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sessionTemplates } from "@/lib/session-templates";
import { BggSearchPanel } from "@/components/bgg-search-panel";
import { prisma } from "@/lib/prisma";

const roleBadgeClass = (role: string) => {
  if (role === "admin") {
    return "border-accent/70 bg-accent/30 text-foreground ring-1 ring-accent/40";
  }
  if (role === "organizer") {
    return "border-secondary/70 bg-secondary/30 text-foreground ring-1 ring-secondary/40";
  }
  return "border-muted-foreground/40 bg-muted/60 text-foreground ring-1 ring-muted-foreground/30";
};

const normalizeName = (value: string) => value.trim().toLowerCase();

export default async function AdminPage(
  props: PageProps<"/admin">,
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  if (String(session.user?.role) !== "admin") {
    redirect("/unauthorized");
  }

  const [
    users,
    authLogs,
    sessions,
    players,
    games,
    validatedRounds,
    roundCount,
    tableCount,
    participantCount,
    roundsWithoutTables,
    gameUsage,
  ] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { email: "asc" }],
    }),
    prisma.authLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: true },
    }),
    prisma.tournamentSession.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            players: true,
            rounds: true,
          },
        },
      },
    }),
    prisma.player.findMany({
      select: { id: true, name: true, sessionId: true },
    }),
    prisma.game.findMany({
      select: {
        id: true,
        name: true,
        minPlayers: true,
        maxPlayers: true,
        duration: true,
        scoringType: true,
        rules: true,
      },
    }),
    prisma.round.findMany({
      where: { validatedAt: { not: null } },
      select: { createdAt: true, validatedAt: true },
    }),
    prisma.round.count(),
    prisma.table.count(),
    prisma.tableParticipant.count(),
    prisma.round.count({
      where: { tables: { none: {} } },
    }),
    prisma.table.groupBy({
      by: ["gameId"],
      _count: { _all: true },
    }),
  ]);

  const adminLogs = await prisma.adminLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { admin: true },
  });

  await props.searchParams;

  const totalSessions = sessions.length;
  const totalPlayers = players.length;
  const totalGames = games.length;

  const averageRoundMinutes = (() => {
    const durations = validatedRounds
      .map((round) => {
        if (!round.validatedAt) return null;
        return round.validatedAt.getTime() - round.createdAt.getTime();
      })
      .filter((value): value is number => value !== null && value >= 0);
    if (durations.length === 0) return null;
    const avgMs = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    return avgMs / 1000 / 60;
  })();

  const duplicatePlayers = (() => {
    const groups = new Map<string, number>();
    players.forEach((player) => {
      const key = `${player.sessionId}:${normalizeName(player.name)}`;
      groups.set(key, (groups.get(key) ?? 0) + 1);
    });
    return Array.from(groups.values()).reduce((total, count) => {
      if (count <= 1) return total;
      return total + (count - 1);
    }, 0);
  })();

  const duplicateGames = (() => {
    const groups = new Map<string, number>();
    games.forEach((game) => {
      const key = normalizeName(game.name);
      groups.set(key, (groups.get(key) ?? 0) + 1);
    });
    return Array.from(groups.values()).reduce((total, count) => {
      if (count <= 1) return total;
      return total + (count - 1);
    }, 0);
  })();

  const emptyPlayerNames = players.filter((player) => player.name.trim().length === 0).length;
  const emptyGameNames = games.filter((game) => game.name.trim().length === 0).length;
  const gameUsageMap = new Map(gameUsage.map((item) => [item.gameId, item._count._all]));

  const counts = {
    total: users.length,
    admin: users.filter((user) => user.role === "admin").length,
    organizer: users.filter((user) => user.role === "organizer").length,
    viewer: users.filter((user) => user.role === "viewer").length,
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestion des utilisateurs</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Admin : {counts.admin} · Organisateur : {counts.organizer} · Viewer :{" "}
          {counts.viewer} · Total : {counts.total}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Insights &amp; monitoring</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Volumes globaux
            </p>
            <div className="mt-2 space-y-1 text-sm text-foreground">
              <p>Sessions: {totalSessions}</p>
              <p>Joueurs: {totalPlayers}</p>
              <p>Manches: {roundCount}</p>
              <p>Tables: {tableCount}</p>
              <p>Participants: {participantCount}</p>
              <p>Jeux: {totalGames}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Performance
            </p>
            <div className="mt-2 space-y-1 text-sm text-foreground">
              <p>
                Temps moyen par manche:{" "}
                {averageRoundMinutes !== null
                  ? `${averageRoundMinutes.toFixed(1)} min`
                  : "—"}
              </p>
              <p>Manches validees: {validatedRounds.length}</p>
              <p>Manches sans tables: {roundsWithoutTables}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Qualite des donnees
            </p>
            <div className="mt-2 space-y-1 text-sm text-foreground">
              <p>Doublons joueurs: {duplicatePlayers}</p>
              <p>Doublons jeux: {duplicateGames}</p>
              <p>Noms joueurs vides: {emptyPlayerNames}</p>
              <p>Noms jeux vides: {emptyGameNames}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions globales</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <form action={revalidateAllRankings}>
            <button
              type="submit"
              className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90"
            >
              Recalculer tous les classements
            </button>
          </form>
          <a
            href="/admin/export/csv"
            className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition-colors duration-300 hover:bg-muted"
          >
            Export CSV global
          </a>
          <a
            href="/admin/export/pdf"
            className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition-colors duration-300 hover:bg-muted"
          >
            Export PDF global
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catalogue global des jeux</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={addGameGlobal} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                Nom
              </label>
              <input
                name="name"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Duree (min)
              </label>
              <input
                name="duration"
                type="number"
                min={1}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Joueurs min
              </label>
              <input
                name="minPlayers"
                type="number"
                min={1}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Joueurs max
              </label>
              <input
                name="maxPlayers"
                type="number"
                min={1}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Scoring
              </label>
              <select
                name="scoringType"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none"
              >
                <option value="ranking">Classement</option>
                <option value="raw">Score brut</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                Regles (optionnel)
              </label>
              <textarea
                name="rules"
                className="min-h-[90px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                placeholder="Ex: scoring final, objectifs, tie-break."
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90"
              >
                Ajouter le jeu
              </button>
            </div>
          </form>

          {games.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              Aucun jeu enregistre.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jeu</TableHead>
                  <TableHead>Joueurs</TableHead>
                  <TableHead>Duree</TableHead>
                  <TableHead>Scoring</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {games.map((game) => (
                  <TableRow key={game.id}>
                    <TableCell className="font-medium">
                      <div className="space-y-1">
                        <p>{game.name}</p>
                        {game.rules ? (
                          <p className="text-xs text-muted-foreground">
                            {game.rules}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {game.minPlayers}-{game.maxPlayers}
                    </TableCell>
                    <TableCell>{game.duration} min</TableCell>
                    <TableCell>
                      <Badge className="border-secondary/60 bg-secondary/30 text-foreground ring-1 ring-secondary/40">
                        {game.scoringType === "raw" ? "Score brut" : "Classement"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {gameUsageMap.get(game.id) ?? 0} table(s)
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <EditGameDialog game={game} />
                        <DeleteGameGlobalDialog
                          gameId={game.id}
                          gameName={game.name}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Importer depuis BGG</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">\n          <BggSearchPanel />\n        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fallback local (creation rapide)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Saisis un nom, les valeurs sont pre-remplies (2-6 joueurs, 30 min).
            Tu peux ajuster avant d enregistrer.
          </p>
          <QuickGameForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance &amp; DX</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={cleanupInactiveSessions} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[160px] space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Nettoyer les sessions inactives (jours)
              </label>
              <input
                name="days"
                type="number"
                min={1}
                defaultValue={30}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </div>
            <button
              type="submit"
              className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition-colors duration-300 hover:bg-muted"
            >
              Nettoyer
            </button>
          </form>

          <div className="flex flex-wrap gap-3">
            <form action={dedupePlayers}>
              <button
                type="submit"
                className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition-colors duration-300 hover:bg-muted"
              >
                Dedupliquer joueurs
              </button>
            </form>
            <form action={dedupeGames}>
              <button
                type="submit"
                className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition-colors duration-300 hover:bg-muted"
              >
                Dedupliquer jeux
              </button>
            </form>
          </div>

          <form action={migrateTemplateGames} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Migrer un template vers la librairie
              </label>
              <select
                name="templateId"
                defaultValue={sessionTemplates[0]?.id}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                {sessionTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90"
            >
              Migrer
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions globales</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Joueurs</TableHead>
                <TableHead>Manches</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    Aucune session.
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((sessionItem) => (
                  <TableRow key={sessionItem.id}>
                    <TableCell className="font-medium">
                      {sessionItem.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sessionItem.date.toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>{sessionItem._count.players}</TableCell>
                    <TableCell>{sessionItem._count.rounds}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <a
                          href={`/sessions/${sessionItem.id}`}
                          className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-foreground transition-colors duration-300 hover:bg-muted"
                        >
                          Ouvrir
                        </a>
                        <DeleteSessionDialog
                          sessionId={sessionItem.id}
                          sessionName={sessionItem.name}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inviter un utilisateur</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={inviteUser} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1 space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Email
              </label>
              <input
                name="email"
                type="email"
                placeholder="nom@exemple.com"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                required
              />
            </div>
            <div className="min-w-[160px] space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Role
              </label>
              <select
                name="role"
                defaultValue="organizer"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <option value="admin">admin</option>
                <option value="organizer">organizer</option>
                <option value="viewer">viewer</option>
              </select>
            </div>
            <button
              type="submit"
              className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90"
            >
              Inviter
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comptes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Etat</TableHead>
                <TableHead>Derniere connexion</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isSelf = user.id === session.user?.id;
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="space-y-1">
                        <p>{user.name ?? "Utilisateur"}</p>
                        {isSelf ? (
                          <p className="text-xs text-muted-foreground">
                            Vous
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.email ?? "Sans email"}
                    </TableCell>
                    <TableCell>
                      <Badge className={roleBadgeClass(user.role)}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          user.isActive
                            ? "border-secondary/70 bg-secondary/30 text-foreground ring-1 ring-secondary/40"
                            : "border-destructive/70 bg-destructive/30 text-foreground ring-1 ring-destructive/40"
                        }
                      >
                        {user.isActive ? "Actif" : "Bloque"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.lastLoginAt
                        ? user.lastLoginAt.toLocaleString("fr-FR")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <form action={updateUserRole} className="flex items-center gap-2">
                          <input type="hidden" name="userId" value={user.id} />
                          <select
                            name="role"
                            defaultValue={user.role}
                            disabled={isSelf}
                            className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <option value="admin">admin</option>
                            <option value="organizer">organizer</option>
                            <option value="viewer">viewer</option>
                          </select>
                          <button
                            type="submit"
                            className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-foreground transition-colors duration-300 hover:bg-muted"
                            disabled={isSelf}
                          >
                            Mettre a jour
                          </button>
                        </form>
                        <form action={setUserActive}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input
                            type="hidden"
                            name="active"
                            value={user.isActive ? "false" : "true"}
                          />
                          <button
                            type="submit"
                            disabled={isSelf}
                            className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-foreground transition-colors duration-300 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {user.isActive ? "Bloquer" : "Reactiver"}
                          </button>
                        </form>
                        <form action={forceUserSignOut}>
                          <input type="hidden" name="userId" value={user.id} />
                          <button
                            type="submit"
                            disabled={isSelf}
                            className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-foreground transition-colors duration-300 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Forcer reconnexion
                          </button>
                        </form>
                        {!isSelf ? (
                          <DeleteUserDialog userId={user.id} email={user.email} />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des connexions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {authLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    Aucun historique disponible.
                  </TableCell>
                </TableRow>
              ) : (
                authLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {log.user?.email ?? "Utilisateur inconnu"}
                    </TableCell>
                    <TableCell>
                      <Badge className="border-accent/70 bg-accent/30 text-foreground ring-1 ring-accent/40">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.provider ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.createdAt.toLocaleString("fr-FR")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit admin</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entite</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    Aucun audit disponible.
                  </TableCell>
                </TableRow>
              ) : (
                adminLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {log.admin?.email ?? "Admin inconnu"}
                    </TableCell>
                    <TableCell>
                      <Badge className="border-accent/70 bg-accent/30 text-foreground ring-1 ring-accent/40">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.entityType ?? "—"}
                      {log.entityId ? ` (${log.entityId.slice(0, 6)}…)` : ""}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.message ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.createdAt.toLocaleString("fr-FR")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

