import type { GameModule } from "../../platform/types";
import { bestBy, plural, scoresResult } from "../../platform/result";
import { createTaboo, projectTaboo, reduceTaboo, resolveTabooConfig } from "./engine";
import type { TabooClientAction, TabooPublic, TabooSettings, TabooState } from "./types";

export const TABOO_GAME_ID = "taboo" as const;

export const tabooModule: GameModule<TabooState, TabooPublic, TabooSettings, TabooClientAction> = {
  id: TABOO_GAME_ID,
  meta: { name: "Mot interdit", minPlayers: 3, maxPlayers: 12 },
  defaultSettings: () => ({ totalRounds: 1, seconds: 60, mode: "ecrit" }),
  sanitizeSettings: (input) => {
    const c = resolveTabooConfig((input ?? {}) as TabooSettings);
    return { totalRounds: c.totalRounds, seconds: c.turnSeconds, mode: c.mode };
  },
  createState: createTaboo,
  reduce: reduceTaboo,
  project: projectTaboo,
  deadline: (s) => s.deadline,
  isOver: (s) => s.phase === "final",
  results: (s) => {
    if (s.phase !== "final") return null;
    const orator = bestBy(s.cardsGiven);
    const finder = bestBy(s.cardsFound);
    return scoresResult(s.players, s.scores, {
      awards: [
        ...(orator ? [{ id: "best_orator", label: "Langue bien pendue", playerId: orator, detail: `${plural(s.cardsGiven[orator], "mot")} fait${s.cardsGiven[orator] > 1 ? "s" : ""} deviner` }] : []),
        ...(finder ? [{ id: "best_finder", label: "Devin", playerId: finder, detail: `${plural(s.cardsFound[finder], "mot")} trouvé${s.cardsFound[finder] > 1 ? "s" : ""}` }] : []),
      ],
    });
  },
};
