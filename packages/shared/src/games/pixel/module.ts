// Pixel incoming — a standalone game that REUSES the Reconnaissance engine and
// its image bank. The only difference is the client view: the image is revealed
// progressively (pixel by pixel) over the round instead of shown at once.
// Everything else (questions, answers, scoring, rounds, timers, sync) is the
// exact same battle-tested reco logic.
import type { GameModule } from "../../platform/types";
import { createReco, projectReco, reduceReco } from "../reconnaissance/engine";
import type { RecoClientAction, RecoPublic, RecoSettings, RecoState } from "../reconnaissance/types";

export const PIXEL_GAME_ID = "pixel" as const;

function sanitize(input: unknown): RecoSettings {
  const v = input as RecoSettings | undefined;
  return {
    totalQuestions: typeof v?.totalQuestions === "number" ? v.totalQuestions : 10,
    // A little longer than reco by default so the picture has time to emerge.
    secondsPerQuestion: typeof v?.secondsPerQuestion === "number" ? v.secondsPerQuestion : 22,
    category: typeof v?.category === "string" ? v.category : "all",
  };
}

export const pixelModule: GameModule<RecoState, RecoPublic, RecoSettings, RecoClientAction> = {
  id: PIXEL_GAME_ID,
  meta: { name: "Pixel incoming", minPlayers: 1, maxPlayers: 12 },
  defaultSettings: () => ({ totalQuestions: 10, secondsPerQuestion: 22, category: "all" }),
  sanitizeSettings: sanitize,
  createState: createReco,
  reduce: reduceReco,
  project: projectReco,
  deadline: (s) => s.deadline,
  isOver: (s) => s.phase === "final",
};
