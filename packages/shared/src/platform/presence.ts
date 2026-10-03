// Utilitaires communs à tous les Game Modes pour la présence des joueurs.
import type { GamePlayer } from "../game/types";

/**
 * Joueurs arrivés en cours de partie : ceux du `roster` fourni par le serveur
 * qui ne sont pas encore dans la partie. Les modules les ajoutent avec un
 * score à 0 pour qu'ils puissent jouer dès la question suivante (au lieu de
 * rester spectateurs invisibles dont les réponses ne comptent pas).
 */
export function latePlayers(current: GamePlayer[], roster: GamePlayer[] | undefined): GamePlayer[] {
  if (!roster) return [];
  const known = new Set(current.map((p) => p.id));
  return roster.filter((p) => !known.has(p.id));
}

/** Copie d'un enregistrement `id → nombre` avec les nouveaux joueurs à 0. */
export function withZeros(rec: Record<string, number>, added: GamePlayer[]): Record<string, number> {
  if (added.length === 0) return rec;
  const out = { ...rec };
  for (const p of added) if (out[p.id] == null) out[p.id] = 0;
  return out;
}

/** Un compteur `id → 0` pour chaque joueur (scores, votes, stats de départ). */
export function zeroScores(players: GamePlayer[]): Record<string, number> {
  return Object.fromEntries(players.map((p) => [p.id, 0]));
}
