import type { GameModule } from "../../platform/types";
import { bestBy, plural, scoresResult } from "../../platform/result";
import { createYesNo, projectYesNo, reduceYesNo, resolveYesNoConfig } from "./engine";
import type { YesNoClientAction, YesNoPublic, YesNoSettings, YesNoState } from "./types";

export const YESNO_GAME_ID = "yesno" as const;

export const yesnoModule: GameModule<YesNoState, YesNoPublic, YesNoSettings, YesNoClientAction> = {
  id: YESNO_GAME_ID,
  meta: { name: "Ni oui ni non", minPlayers: 3, maxPlayers: 12 },
  defaultSettings: () => ({ totalRounds: 1, seconds: 45, mode: "voix" }),
  sanitizeSettings: (input) => {
    const c = resolveYesNoConfig((input ?? {}) as YesNoSettings);
    return { totalRounds: c.totalRounds, seconds: c.seconds, mode: c.mode };
  },
  createState: createYesNo,
  reduce: reduceYesNo,
  project: projectYesNo,
  deadline: (s) => s.deadline,
  isOver: (s) => s.phase === "final",
  results: (s) => {
    if (s.phase !== "final") return null;
    const wall = bestBy(s.survivals);
    const trap = bestBy(s.catches);
    return scoresResult(s.players, s.scores, {
      awards: [
        ...(wall ? [{ id: "yesno_wall", label: "La muraille", playerId: wall, detail: `a tenu ${plural(s.survivals[wall], "fois", "fois")}` }] : []),
        ...(trap ? [{ id: "yesno_trap", label: "Le piégeur", playerId: trap, detail: `${plural(s.catches[trap], "victime")}` }] : []),
      ],
    });
  },
};
