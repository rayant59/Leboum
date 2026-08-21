import type { GameModule } from "../../platform/types";
import { createRelay, projectRelay, reduceRelay } from "./engine";
import type { RelayClientAction, RelayPublic, RelaySettings, RelayState } from "./types";

export const RELAY_GAME_ID = "relay" as const;

function sanitize(input: unknown): RelaySettings {
  const totalRounds = Math.min(8, Math.max(2, Math.round(Number((input as RelaySettings)?.totalRounds) || 4)));
  return { totalRounds };
}

export const relayModule: GameModule<RelayState, RelayPublic, RelaySettings, RelayClientAction> = {
  id: RELAY_GAME_ID,
  meta: { name: "Relais", minPlayers: 3, maxPlayers: 12 },
  defaultSettings: () => ({ totalRounds: 4 }),
  sanitizeSettings: sanitize,
  createState: createRelay,
  reduce: reduceRelay,
  project: projectRelay,
  deadline: (s) => s.deadline,
  isOver: (s) => s.phase === "scoreboard",
};
