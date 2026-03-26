export type SessionTemplate = {
  id: string;
  name: string;
  description: string;
  games: Array<{
    name: string;
    minPlayers: number;
    maxPlayers: number;
    duration: number;
    scoringType: "ranking" | "raw";
    rules?: string;
  }>;
};

export const sessionTemplates: SessionTemplate[] = [
  {
    id: "classic",
    name: "Classique (familial)",
    description: "3 jeux accessibles pour 4-6 joueurs.",
    games: [
      {
        name: "Carcassonne",
        minPlayers: 2,
        maxPlayers: 5,
        duration: 35,
        scoringType: "ranking",
        rules: "Placement de tuiles, scoring final par majorité.",
      },
      {
        name: "7 Wonders",
        minPlayers: 3,
        maxPlayers: 7,
        duration: 30,
        scoringType: "raw",
        rules: "Draft de cartes, points cumulés.",
      },
      {
        name: "Codenames",
        minPlayers: 4,
        maxPlayers: 8,
        duration: 15,
        scoringType: "ranking",
        rules: "Deux équipes, mots-clés à deviner.",
      },
    ],
  },
  {
    id: "party",
    name: "Party rapide",
    description: "Jeux courts pour rotation rapide.",
    games: [
      {
        name: "Dixit",
        minPlayers: 3,
        maxPlayers: 6,
        duration: 30,
        scoringType: "raw",
        rules: "Indices imagés, points cumulés.",
      },
      {
        name: "Love Letter",
        minPlayers: 2,
        maxPlayers: 4,
        duration: 20,
        scoringType: "ranking",
        rules: "Cartes à effet, dernière survivante.",
      },
      {
        name: "Just One",
        minPlayers: 3,
        maxPlayers: 7,
        duration: 15,
        scoringType: "raw",
        rules: "Coopératif, points par mot deviné.",
      },
    ],
  },
  {
    id: "strategy",
    name: "Stratégie",
    description: "Jeux plus longs, scoring par points.",
    games: [
      {
        name: "Terraforming Mars",
        minPlayers: 1,
        maxPlayers: 5,
        duration: 120,
        scoringType: "raw",
        rules: "Objectifs + production, score final.",
      },
      {
        name: "Azul",
        minPlayers: 2,
        maxPlayers: 4,
        duration: 40,
        scoringType: "raw",
        rules: "Placement de tuiles, scoring final.",
      },
      {
        name: "Splendor",
        minPlayers: 2,
        maxPlayers: 4,
        duration: 30,
        scoringType: "ranking",
        rules: "Points de prestige, seuil de fin.",
      },
    ],
  },
];
