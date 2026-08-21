import type { GameModule } from "../../platform/types";
import { createQuiz, projectQuiz, reduceQuiz } from "./engine";
import type { QuizClientAction, QuizPublic, QuizSettings, QuizState } from "./types";

export const QUIZ_GAME_ID = "quiz" as const;

function sanitize(input: unknown): QuizSettings {
  const v = input as QuizSettings | undefined;
  const types = v?.types;
  const okTypes = types === "mcq" || types === "truefalse" || types === "free" ? types : "all";
  return {
    totalQuestions: typeof v?.totalQuestions === "number" ? v.totalQuestions : 10,
    secondsPerQuestion: typeof v?.secondsPerQuestion === "number" ? v.secondsPerQuestion : 15,
    types: okTypes,
  };
}

export const quizModule: GameModule<QuizState, QuizPublic, QuizSettings, QuizClientAction> = {
  id: QUIZ_GAME_ID,
  meta: { name: "Quiz", minPlayers: 1, maxPlayers: 12 },
  defaultSettings: () => ({ totalQuestions: 10, secondsPerQuestion: 15, types: "all" }),
  sanitizeSettings: sanitize,
  createState: createQuiz,
  reduce: reduceQuiz,
  project: projectQuiz,
  deadline: (s) => s.deadline,
  isOver: (s) => s.phase === "final",
};
