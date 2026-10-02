import type { GameModule } from "../../platform/types";
import { bestBy, plural, scoresResult } from "../../platform/result";
import { createImposter, projectImposter, reduceImposter, resolveImposterConfig } from "./engine";
import type { ImposterClientAction, ImposterPublic, ImposterSettings, ImposterState } from "./types";

export const IMPOSTER_GAME_ID = "imposter" as const;

export const imposterModule: GameModule<ImposterState, ImposterPublic, ImposterSettings, ImposterClientAction> = {
  id: IMPOSTER_GAME_ID,
  meta: { name: "Imposteur", minPlayers: 3, maxPlayers: 12 },
  defaultSettings: () => ({ totalRounds: 3, seconds: 30, mode: "classique" }),
  sanitizeSettings: (input) => {
    const v = (input ?? {}) as ImposterSettings;
    const c = resolveImposterConfig(v);
    return { totalRounds: c.totalRounds, seconds: c.clueSeconds, mode: c.mode };
  },
  createState: createImposter,
  reduce: reduceImposter,
  project: projectImposter,
  deadline: (s) => s.deadline,
  isOver: (s) => s.phase === "final",
  results: (s) => {
    if (s.phase !== "final") return null;
    const liar = bestBy(s.imposterWins);
    const detective = bestBy(s.goodVotes);
    return scoresResult(s.players, s.scores, {
      awards: [
        ...(liar ? [{ id: "best_liar", label: "Meilleur menteur", playerId: liar, detail: `${plural(s.imposterWins[liar], "manche")} gagnée${s.imposterWins[liar] > 1 ? "s" : ""}` }] : []),
        ...(detective ? [{ id: "detective", label: "Détective", playerId: detective, detail: `${plural(s.goodVotes[detective], "imposteur")} démasqué${s.goodVotes[detective] > 1 ? "s" : ""}` }] : []),
      ],
    });
  },
};
