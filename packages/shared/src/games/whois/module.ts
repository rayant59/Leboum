import type { GameModule } from "../../platform/types";
import { bestBy, plural, scoresResult } from "../../platform/result";
import { createWhois, projectWhois, reduceWhois, resolveWhoisConfig } from "./engine";
import type { WhoisClientAction, WhoisPublic, WhoisSettings, WhoisState } from "./types";

export const WHOIS_GAME_ID = "whois" as const;

export const whoisModule: GameModule<WhoisState, WhoisPublic, WhoisSettings, WhoisClientAction> = {
  id: WHOIS_GAME_ID,
  meta: { name: "Qui de nous ?", minPlayers: 3, maxPlayers: 12 },
  defaultSettings: () => ({ totalRounds: 10, seconds: 20, mode: "mix" }),
  sanitizeSettings: (input) => {
    const v = (input ?? {}) as WhoisSettings;
    const c = resolveWhoisConfig(v);
    return { totalRounds: c.totalRounds, seconds: c.seconds, mode: typeof v.mode === "string" ? v.mode : "mix" };
  },
  createState: createWhois,
  reduce: reduceWhois,
  project: projectWhois,
  deadline: (s) => s.deadline,
  isOver: (s) => s.phase === "final",
  results: (s) => {
    if (s.phase !== "final") return null;
    const star = bestBy(s.timesElected);
    const mind = bestBy(s.majorityVotes);
    return scoresResult(s.players, s.scores, {
      awards: [
        ...(star ? [{ id: "whois_star", label: "La vedette", playerId: star, detail: `élu·e ${s.timesElected[star]} fois` }] : []),
        ...(mind ? [{ id: "whois_mind", label: "Télépathe", playerId: mind, detail: `${plural(s.majorityVotes[mind], "vote")} dans le mille` }] : []),
      ],
    });
  },
};
