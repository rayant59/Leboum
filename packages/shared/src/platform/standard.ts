// Résultats standard partagés par plusieurs jeux (évite de dupliquer la logique
// de classement / distinctions dans chaque module).
import type { GamePlayer } from "../game/types";
import type { PlayerId } from "../room/types";
import type { BombeState } from "../games/bombe/types";
import { bestBy, scoresResult, type GameAward, type GameResult } from "./result";

/** Forme commune au Quiz, à Œil de Boum et à Pixel Panic. */
interface QuizLike {
  players: GamePlayer[];
  scores: Record<PlayerId, number>;
  fastMs?: Record<PlayerId, number>;
  bestStreak?: Record<PlayerId, number>;
  goodCount?: Record<PlayerId, number>;
}

export function quizResults(s: QuizLike, coop: boolean): GameResult {
  const awards: GameAward[] = [];
  const fast = Object.entries(s.fastMs ?? {}).filter(([, ms]) => ms > 0).sort((a, b) => a[1] - b[1])[0];
  if (fast) awards.push({ id: "fastest", label: "Plus rapide", playerId: fast[0], detail: `${(fast[1] / 1000).toFixed(1).replace(".", ",")} s` });
  const brain = bestBy(s.goodCount);
  if (brain) awards.push({ id: "brain", label: "Le cerveau", playerId: brain, detail: `${s.goodCount![brain]} bonne${s.goodCount![brain] > 1 ? "s" : ""} réponse${s.goodCount![brain] > 1 ? "s" : ""}` });
  const streak = bestBy(s.bestStreak);
  if (streak && (s.bestStreak![streak] ?? 0) >= 2) awards.push({ id: "streak", label: "Meilleure série", playerId: streak, detail: `${s.bestStreak![streak]} d'affilée` });
  return scoresResult(s.players, s.scores, { coop, awards });
}

/** Boum Rush n'a pas de points : le classement suit la survie. Le score
 *  affiché est le nombre de mots trouvés. */
export function bombeResults(s: BombeState): GameResult {
  const alive = s.order
    .filter((id) => !s.eliminated.includes(id))
    .sort((a, b) => (s.lives[b] ?? 0) - (s.lives[a] ?? 0) || (s.wordsFound[b] ?? 0) - (s.wordsFound[a] ?? 0));
  const order = [
    ...(s.winnerId ? [s.winnerId] : []),
    ...alive.filter((id) => id !== s.winnerId),
    ...s.eliminated.slice().reverse().filter((id) => id !== s.winnerId),
  ];
  const awards: GameAward[] = [];
  const words = bestBy(s.wordsFound);
  if (words) awards.push({ id: "most_words", label: "Dico vivant", playerId: words, detail: `${s.wordsFound[words]} mots` });
  return scoresResult(s.players, s.wordsFound, { order, coop: s.config.mode === "coop", awards });
}
