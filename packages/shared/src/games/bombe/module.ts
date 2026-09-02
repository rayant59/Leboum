import type { GameModule } from "../../platform/types";
import { bombeDeadline, bombeIsOver, createBombe, projectBombe, reduceBombe, resolveBombeConfig } from "./engine";
import type { BombeClientAction, BombePublic, BombeSettings, BombeState } from "./types";

export const BOMBE_GAME_ID = "bombe" as const;

function sanitize(input: unknown): BombeSettings {
  const v = (input ?? {}) as BombeSettings;
  const cfg = resolveBombeConfig(v); // clampe + range tout
  return {
    lives: cfg.lives,
    minSeconds: Math.round(cfg.minMs / 1000),
    maxSeconds: Math.round(cfg.maxMs / 1000),
    minLetters: cfg.minLetters,
    maxLetters: cfg.maxLetters,
  };
}

export const bombeModule: GameModule<BombeState, BombePublic, BombeSettings, BombeClientAction> = {
  id: BOMBE_GAME_ID,
  meta: { name: "Bombe", minPlayers: 2, maxPlayers: 12 },
  defaultSettings: () => ({ lives: 3, minSeconds: 5, maxSeconds: 12, minLetters: 2, maxLetters: 3 }),
  sanitizeSettings: sanitize,
  createState: createBombe,
  reduce: reduceBombe,
  project: projectBombe,
  deadline: bombeDeadline,
  isOver: bombeIsOver,
};
