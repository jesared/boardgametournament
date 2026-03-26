"use client";

import { useRouter } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabRoutes: Record<string, string> = {
  overview: "",
  players: "players",
  games: "games",
  rounds: "rounds",
  ranking: "ranking",
  history: "history",
};

export function SessionTabs({
  sessionId,
  current,
}: {
  sessionId: string;
  current: keyof typeof tabRoutes;
}) {
  const router = useRouter();

  return (
    <Tabs
      value={current}
      onValueChange={(value) => {
        const segment = tabRoutes[value] ?? "";
        const target = segment
          ? `/sessions/${sessionId}/${segment}`
          : `/sessions/${sessionId}`;
        router.push(target);
      }}
    >
      <TabsList className="flex flex-wrap">
        <TabsTrigger value="overview">Vue</TabsTrigger>
        <TabsTrigger value="players">Joueurs</TabsTrigger>
        <TabsTrigger value="games">Jeux</TabsTrigger>
        <TabsTrigger value="rounds">Manches</TabsTrigger>
        <TabsTrigger value="ranking">Classement</TabsTrigger>
        <TabsTrigger value="history">Historique</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
