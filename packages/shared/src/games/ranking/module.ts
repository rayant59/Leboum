import type { GameModule } from "../../platform/types";
import { bestBy, plural, scoresResult } from "../../platform/result";
import { createRanking, projectRanking, reduceRanking, resolveRankingConfig } from "./engine";
import type { RankingClientAction, RankingPublic, RankingSettings, RankingState } from "./types";

export const RANKING_GAME_ID = "ranking" as const;

export const rankingModule: GameModule<RankingState, RankingPublic, RankingSettings, RankingClientAction> = {
  id: RANKING_GAME_ID,
  meta: { name: "Le Top", minPlayers: 1, maxPlayers: 12 },
  defaultSettings: () => ({ totalRounds: 5, seconds: 45, mode: "savoir" }),
  sanitizeSettings: (input) => {
    const c = resolveRankingConfig((input ?? {}) as RankingSettings);
    return { totalRounds: c.totalRounds, seconds: c.seconds, mode: c.mode };
  },
  createState: createRanking,
  reduce: reduceRanking,
  project: projectRanking,
  deadline: (s) => s.deadline,
  isOver: (s) => s.phase === "final",
  results: (s) => {
    if (s.phase !== "final") return null;
    const ace = bestBy(s.perfects);
    return scoresResult(s.players, s.scores, {
      awards: ace ? [{ id: "ranking_perfect", label: "Sans faute", playerId: ace, detail: plural(s.perfects[ace], "classement parfait", "classements parfaits") }] : [],
    });
  },
};
