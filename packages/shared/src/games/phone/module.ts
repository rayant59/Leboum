import type { GameModule } from "../../platform/types";
import { bestBy, plural, scoresResult } from "../../platform/result";
import { createPhone, projectPhone, reducePhone, resolvePhoneConfig } from "./engine";
import type { PhoneClientAction, PhonePublic, PhoneSettings, PhoneState } from "./types";

export const PHONE_GAME_ID = "phone" as const;

export const phoneModule: GameModule<PhoneState, PhonePublic, PhoneSettings, PhoneClientAction> = {
  id: PHONE_GAME_ID,
  meta: { name: "Téléphone cassé", minPlayers: 3, maxPlayers: 12 },
  defaultSettings: () => ({ seconds: 75, mode: "classique" }),
  sanitizeSettings: (input) => {
    const v = (input ?? {}) as PhoneSettings;
    const c = resolvePhoneConfig(v);
    return { seconds: c.drawSeconds, mode: c.mode };
  },
  createState: createPhone,
  reduce: reducePhone,
  project: projectPhone,
  deadline: (s) => s.deadline,
  isOver: (s) => s.phase === "final",
  results: (s) => {
    if (s.phase !== "final") return null;
    const drawer = bestBy(s.drawLikes);
    const writer = bestBy(s.textLikes);
    return scoresResult(s.players, s.scores, {
      awards: [
        ...(drawer ? [{ id: "best_drawer", label: "Meilleur dessinateur", playerId: drawer, detail: plural(s.drawLikes[drawer], "j'adore", "j'adore") }] : []),
        ...(writer ? [{ id: "best_writer", label: "Plume d'or", playerId: writer, detail: plural(s.textLikes[writer], "j'adore", "j'adore") }] : []),
      ],
    });
  },
};
