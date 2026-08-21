// The Draw & Guess game as a platform module. Implementing GameModule here
// proves the contract is satisfiable by a real game and gives the (future)
// generic server a single object to host — no draw-specific server code.

import type { GameModule } from "../../platform/types";
import { createDrawGame, projectDraw, reduceDraw } from "./engine";
import { DEFAULT_DRAW_SETTINGS, sanitizeDrawSettings } from "./modes";
import type { DrawClientAction, DrawPublic, DrawSettings, DrawState } from "./types";

export const DRAW_GAME_ID = "draw" as const;

export const drawModule: GameModule<DrawState, DrawPublic, DrawSettings, DrawClientAction> = {
  id: DRAW_GAME_ID,
  meta: { name: "Dessin & Devinette", minPlayers: 2, maxPlayers: 12 },
  defaultSettings: () => ({ ...DEFAULT_DRAW_SETTINGS }),
  sanitizeSettings: (input) => sanitizeDrawSettings(input as Partial<DrawSettings> | undefined),
  createState: createDrawGame,
  reduce: reduceDraw,
  project: projectDraw,
  deadline: (s) => s.deadline,
  isOver: (s) => s.phase === "scoreboard",
};
