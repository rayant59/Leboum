// ---------------------------------------------------------------------------
// Round "twists" — optional style constraints that spice up a round. Some
// rounds get one ("write it like an ad"), some don't. Pure data + a pure
// picker; the server assigns twists per round at game start (impure edge),
// exactly like it picks clips. The game engine never needs to know about them.
// ---------------------------------------------------------------------------

export const TWIST_POOL: string[] = [
  "En une seule phrase bien menaçante 😤",
  "Comme une pub qui vend un produit 📺",
  "Le plus mignon possible 🥺",
  "En mode complotiste 👁️",
  "En parlant (n'importe comment) de nourriture 🍔",
  "Comme dans un film d'action 💥",
  "Le plus dramatique possible 🎭",
  "Sous forme de question 🤔",
  "Avec un compliment qui cache une insulte 💅",
  "En overacting total, à fond 🤩",
  "Comme si tu révélais un énorme secret 🤫",
  "En parlant à ton animal de compagnie 🐶",
];

/** Choose a twist (or none) for each round. Not every round gets one, and a
 *  twist never repeats within a game. `rng` is injectable so tests stay stable. */
export function pickTwists(rounds: number, rng: () => number = Math.random): (string | null)[] {
  const shuffled = [...TWIST_POOL].sort(() => rng() - 0.5);
  const out: (string | null)[] = [];
  let k = 0;
  for (let i = 0; i < rounds; i++) {
    if (rng() < 0.55 && k < shuffled.length) out.push(shuffled[k++]);
    else out.push(null);
  }
  return out;
}
