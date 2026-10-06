import type { GameModule } from "../../platform/types";
import { bestBy, plural, scoresResult } from "../../platform/result";
import { createFunny, projectFunny, reduceFunny, resolveFunnyConfig } from "./engine";
import type { FunnyClientAction, FunnyPublic, FunnySettings, FunnyState } from "./types";

export const FUNNY_GAME_ID = "funny" as const;

export const funnyModule: GameModule<FunnyState, FunnyPublic, FunnySettings, FunnyClientAction> = {
  id: FUNNY_GAME_ID,
  meta: { name: "La Plus Drôle", minPlayers: 3, maxPlayers: 12 },
  defaultSettings: () => ({ totalRounds: 5, seconds: 60 }),
  sanitizeSettings: (input) => {
    const c = resolveFunnyConfig((input ?? {}) as FunnySettings);
    return { totalRounds: c.totalRounds, seconds: c.writeSeconds };
  },
  createState: createFunny,
  reduce: reduceFunny,
  project: projectFunny,
  deadline: (s) => s.deadline,
  isOver: (s) => s.phase === "final",
  results: (s) => {
    if (s.phase !== "final") return null;
    const pen = bestBy(s.votesReceived);
    const champ = bestBy(s.roundWins);
    const top = s.best.slice().sort((a, b) => b.votes - a.votes)[0];
    return scoresResult(s.players, s.scores, {
      awards: [
        ...(pen ? [{ id: "funny_pen", label: "Plume d'or", playerId: pen, detail: plural(s.votesReceived[pen], "vote") }] : []),
        ...(champ && champ !== pen ? [{ id: "funny_champ", label: "Roi des manches", playerId: champ, detail: `${plural(s.roundWins[champ], "manche")} gagnée${s.roundWins[champ] > 1 ? "s" : ""}` }] : []),
        ...(top && top.votes > 0 ? [{ id: "funny_best", label: "Réponse la plus drôle", playerId: top.authorId, detail: `« ${top.text} »` }] : []),
      ],
    });
  },
};
