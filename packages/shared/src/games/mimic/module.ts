import type { GameModule } from "../../platform/types";
import { createMimic, mimicDeadline, mimicIsOver, projectMimic, reduceMimic, resolveMimicConfig } from "./engine";
import type { MimicClientAction, MimicPublic, MimicSettings, MimicState } from "./types";

export const MIMIC_GAME_ID = "mimic" as const;

function sanitize(input: unknown): MimicSettings {
  const cfg = resolveMimicConfig((input ?? {}) as MimicSettings);
  return { totalRounds: cfg.totalRounds, recordSeconds: Math.round(cfg.recordMs / 1000) };
}

export const mimicModule: GameModule<MimicState, MimicPublic, MimicSettings, MimicClientAction> = {
  id: MIMIC_GAME_ID,
  meta: { name: "Mimic", minPlayers: 2, maxPlayers: 8 },
  defaultSettings: () => ({ totalRounds: 4, recordSeconds: 6 }),
  sanitizeSettings: sanitize,
  createState: createMimic,
  reduce: reduceMimic,
  project: projectMimic,
  deadline: mimicDeadline,
  isOver: mimicIsOver,
};
