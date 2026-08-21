import type { GameModule } from "../../platform/types";
import { createDoublage, projectDoublage, reduceDoublage } from "./engine";
import type { DoublageClientAction, DoublagePublic, DoublageSettings, DoublageState } from "./types";

export const DOUBLAGE_GAME_ID = "doublage" as const;

function sanitize(input: unknown): DoublageSettings {
  const v = input as DoublageSettings | undefined;
  return { videoId: typeof v?.videoId === "string" ? v.videoId : null, mode: "free" };
}

export const doublageModule: GameModule<DoublageState, DoublagePublic, DoublageSettings, DoublageClientAction> = {
  id: DOUBLAGE_GAME_ID,
  meta: { name: "Doublage", minPlayers: 2, maxPlayers: 10 },
  defaultSettings: () => ({ videoId: null, mode: "free" }),
  sanitizeSettings: sanitize,
  createState: createDoublage,
  reduce: reduceDoublage,
  project: projectDoublage,
  deadline: (s) => s.deadline,
  isOver: () => false, // host-driven; returns to lobby via room controls
};
