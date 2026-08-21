import type { GameModule } from "../../platform/types";
import { createReco, projectReco, reduceReco } from "./engine";
import type { RecoClientAction, RecoPublic, RecoSettings, RecoState } from "./types";

export const RECO_GAME_ID = "reco" as const;

function sanitize(input: unknown): RecoSettings {
  const v = input as RecoSettings | undefined;
  return {
    totalQuestions: typeof v?.totalQuestions === "number" ? v.totalQuestions : 10,
    secondsPerQuestion: typeof v?.secondsPerQuestion === "number" ? v.secondsPerQuestion : 15,
    category: typeof v?.category === "string" ? v.category : "all",
  };
}

export const recoModule: GameModule<RecoState, RecoPublic, RecoSettings, RecoClientAction> = {
  id: RECO_GAME_ID,
  meta: { name: "Reconnaissance", minPlayers: 1, maxPlayers: 12 },
  defaultSettings: () => ({ totalQuestions: 10, secondsPerQuestion: 15, category: "all" }),
  sanitizeSettings: sanitize,
  createState: createReco,
  reduce: reduceReco,
  project: projectReco,
  deadline: (s) => s.deadline,
  isOver: (s) => s.phase === "final",
};
