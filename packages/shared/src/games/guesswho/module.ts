import type { GameModule } from "../../platform/types";
import { bestBy, plural, scoresResult } from "../../platform/result";
import { createGuessWho, projectGuessWho, reduceGuessWho, resolveGuessWhoConfig } from "./engine";
import type { GuessWhoClientAction, GuessWhoPublic, GuessWhoSettings, GuessWhoState } from "./types";

export const GUESSWHO_GAME_ID = "guesswho" as const;

export const guessWhoModule: GameModule<GuessWhoState, GuessWhoPublic, GuessWhoSettings, GuessWhoClientAction> = {
  id: GUESSWHO_GAME_ID,
  meta: { name: "Devine qui", minPlayers: 3, maxPlayers: 12 },
  defaultSettings: () => ({ totalRounds: 4, seconds: 120, mode: "celebrites" }),
  sanitizeSettings: (input) => {
    const c = resolveGuessWhoConfig((input ?? {}) as GuessWhoSettings);
    return { totalRounds: c.totalRounds, seconds: c.seconds, mode: c.mode };
  },
  createState: createGuessWho,
  reduce: reduceGuessWho,
  project: projectGuessWho,
  deadline: (s) => s.deadline,
  isOver: (s) => s.phase === "final",
  results: (s) => {
    if (s.phase !== "final") return null;
    const sherlock = bestBy(s.founds);
    const oracle = bestBy(s.masterWins);
    return scoresResult(s.players, s.scores, {
      awards: [
        ...(sherlock ? [{ id: "guesswho_sherlock", label: "Sherlock", playerId: sherlock, detail: `${plural(s.founds[sherlock], "personne")} démasquée${s.founds[sherlock] > 1 ? "s" : ""}` }] : []),
        ...(oracle ? [{ id: "guesswho_oracle", label: "L'oracle", playerId: oracle, detail: `${plural(s.masterWins[oracle], "secret")} bien guidé${s.masterWins[oracle] > 1 ? "s" : ""}` }] : []),
      ],
    });
  },
};
