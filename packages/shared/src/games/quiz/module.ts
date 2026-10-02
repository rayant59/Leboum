import type { GameModule } from "../../platform/types";
import { createQuiz, projectQuiz, reduceQuiz } from "./engine";
import type { QuizClientAction, QuizPublic, QuizSettings, QuizState } from "./types";
import { quizResults } from "../../platform/standard";

export const QUIZ_GAME_ID = "quiz" as const;

const QUIZ_MODES = ["classic", "speed", "survival", "teams"];
/** Garde-fou : taille max du texte des questions perso (≈ 50 questions). */
export const ROOM_QUESTIONS_MAX_CHARS = 6000;

function sanitize(input: unknown): QuizSettings {
  const v = input as QuizSettings | undefined;
  const types = v?.types;
  const okTypes = types === "mcq" || types === "truefalse" || types === "free" ? types : "all";
  return {
    totalQuestions: typeof v?.totalQuestions === "number" ? v.totalQuestions : 10,
    secondsPerQuestion: typeof v?.secondsPerQuestion === "number" ? v.secondsPerQuestion : 15,
    types: okTypes,
    mode: typeof v?.mode === "string" && QUIZ_MODES.includes(v.mode) ? v.mode : "classic",
    ...(typeof v?.roomQuestions === "string" && v.roomQuestions.trim() ? { roomQuestions: v.roomQuestions.slice(0, ROOM_QUESTIONS_MAX_CHARS) } : {}),
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
  results: (s) => (s.phase === "final" ? quizResults(s, s.config.mode === "teams") : null),
};
