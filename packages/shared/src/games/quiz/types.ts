import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { Question, QuizType } from "./questions";

export type QuizPhase = "question" | "reveal" | "final";

export interface QuizConfig {
  totalQuestions: number;
  secondsPerQuestion: number;
  types: "all" | QuizType;
}

export interface QuizSettings {
  totalQuestions?: number;
  secondsPerQuestion?: number;
  types?: "all" | QuizType;
}

export interface QuizAnswer {
  value: number | boolean | string; // mcq index | tf bool | free text
  at: number; // server time when answered
}

export interface QuizState {
  phase: QuizPhase;
  players: GamePlayer[];
  connectedIds: PlayerId[];
  config: QuizConfig;
  questions: Question[];
  index: number;
  startedAt: number;
  deadline: number | null;
  answers: Record<PlayerId, QuizAnswer>;
  scores: Record<PlayerId, number>;
  gained: Record<PlayerId, number>; // points from the last revealed question
  correct: Record<PlayerId, boolean>; // correctness of the last question
  streak: Record<PlayerId, number>;
  bestStreak: Record<PlayerId, number>;
  fastMs: Record<PlayerId, number>; // fastest correct answer time (ms), for stats
  goodCount: Record<PlayerId, number>;
}

export type QuizClientAction = { kind: "answer"; value: number | boolean | string };

// A question as seen by clients while answering — never leaks the correct answer.
export interface PublicQuestion {
  id: string;
  type: QuizType;
  cat: string;
  prompt: string;
  choices?: string[]; // mcq only
}

export interface QuizRankRow {
  id: PlayerId;
  name: string;
  color: string;
  avatar?: string | null;
  score: number;
  gained: number;
  correct: boolean;
  answered: boolean;
}

export interface QuizPublic {
  phase: QuizPhase;
  players: GamePlayer[];
  index: number; // 0-based
  total: number;
  question: PublicQuestion | null;
  deadline: number | null;
  secondsPerQuestion: number;
  answeredIds: PlayerId[]; // who has answered (not what)
  yourAnswer: number | boolean | string | null;
  ranking: QuizRankRow[]; // sorted desc by score
  // reveal only:
  correctChoice: number | null;
  correctBool: boolean | null;
  correctText: string | null;
  yourCorrect: boolean | null;
  yourGained: number | null;
  // final only:
  stats: { fastest: string | null; brain: string | null; streak: string | null } | null;
}
