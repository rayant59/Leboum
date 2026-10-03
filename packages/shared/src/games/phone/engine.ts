// Moteur pur du « Téléphone cassé ».
// Étapes : phrase (texte) → dessin → description (texte) → dessin → …
// Chaque joueur traite à l'étape k la chaîne lancée par le joueur placé k
// rangs avant lui : personne ne voit sa propre chaîne avant la révélation.
//
// Barème : chaque « J'adore » reçu pendant la révélation = +100 pour l'auteur.
import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { GameAction, GameContext, GameReduceResult } from "../../platform/types";
import { latePlayers, withZeros, zeroScores } from "../../platform/presence";
import { clampInt, shuffle } from "../../platform/util";
import { phonePhraseBank } from "./phrases";
import type {
  PhoneChain,
  PhoneClientAction,
  PhoneConfig,
  PhoneMode,
  PhonePublic,
  PhonePublicChain,
  PhoneSettings,
  PhoneState,
  PhoneStepKind,
} from "./types";

export const PHONE_TEXT_MAX = 100;
/** Taille max d'un dessin (data URL). Le client compresse en WebP/JPEG ~480×360. */
export const PHONE_DRAWING_MAX = 200_000;
export const PHONE_LIKE_POINTS = 100;
export const PHONE_REVEAL_TEXT_MS = 4500;
export const PHONE_REVEAL_DRAWING_MS = 6500;
/** Pause en fin de chaîne pour rire (et liker) avant la suivante. */
export const PHONE_REVEAL_END_MS = 5000;

export function resolvePhoneConfig(s: PhoneSettings | undefined, playerCount = 4): PhoneConfig {
  const mode: PhoneMode = s?.mode === "complet" ? "complet" : "classique";
  const drawSeconds = clampInt(s?.seconds, 30, 180, 75);
  const n = Math.max(2, Math.min(12, playerCount));
  return {
    mode,
    drawSeconds,
    writeSeconds: clampInt(Math.round(drawSeconds * 0.6), 20, 90, 45),
    steps: mode === "complet" ? n : Math.min(n, 5),
  };
}

export const stepKindOf = (step: number): PhoneStepKind => (step % 2 === 0 ? "text" : "drawing");


function stepMs(s: { config: PhoneConfig }, step: number) {
  return (stepKindOf(step) === "text" ? s.config.writeSeconds : s.config.drawSeconds) * 1000;
}

export function createPhone(players: GamePlayer[], settings: PhoneSettings, ctx: GameContext): PhoneState {
  const config = resolvePhoneConfig(settings, players.length);
  const order = shuffle(players.map((p) => p.id), ctx.rng);
  const ms = config.writeSeconds * 1000;
  return {
    phase: "play",
    players,
    connectedIds: players.map((p) => p.id),
    config,
    order,
    chains: order.map((id) => ({ ownerId: id, entries: [] })),
    step: 0,
    pending: {},
    revealChain: 0,
    revealShown: 0,
    likes: {},
    deadline: ctx.now + ms,
    phaseMs: ms,
    scores: zeroScores(players),
    drawLikes: zeroScores(players),
    textLikes: zeroScores(players),
  };
}

/** Index de la chaîne que `playerId` traite à l'étape `step` (-1 = spectateur). */
export function chainFor(s: Pick<PhoneState, "order">, playerId: PlayerId, step: number): number {
  const pos = s.order.indexOf(playerId);
  if (pos < 0) return -1;
  const n = s.order.length;
  return (((pos - step) % n) + n) % n;
}

/** Auteur attendu pour la chaîne `chain` à l'étape `step`. */
export function authorFor(s: Pick<PhoneState, "order">, chain: number, step: number): PlayerId {
  return s.order[(chain + step) % s.order.length];
}

/** Nettoie un rendu ; `null` si invalide. */
export function cleanPhoneContent(kind: PhoneStepKind, raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (kind === "text") {
    const t = raw.replace(/\s+/g, " ").trim().slice(0, PHONE_TEXT_MAX);
    return t || null;
  }
  if (raw.length > PHONE_DRAWING_MAX) return null;
  return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw) ? raw : null;
}

function waitingOn(s: PhoneState): PlayerId[] {
  return s.order.filter((id) => s.connectedIds.includes(id) && s.pending[id] == null);
}

/** Clôt l'étape : chaque chaîne reçoit son rendu (ou un remplissage auto). */
function endStep(s: PhoneState, ctx: GameContext): PhoneState {
  const kind = stepKindOf(s.step);
  const bank = phonePhraseBank();
  const chains: PhoneChain[] = s.chains.map((c, i) => {
    const author = authorFor(s, i, s.step);
    const got = s.pending[author];
    if (got != null) return { ...c, entries: [...c.entries, { kind, authorId: author, content: got }] };
    // Rien rendu : une phrase de départ tirée au sort (la chaîne doit vivre), sinon vide.
    const content = s.step === 0 && bank.length ? bank[Math.floor(ctx.rng() * bank.length)] : "";
    return { ...c, entries: [...c.entries, { kind, authorId: author, content, auto: true }] };
  });
  const step = s.step + 1;
  if (step >= s.config.steps) return startReveal({ ...s, chains, pending: {} }, ctx);
  const ms = stepMs(s, step);
  return { ...s, chains, step, pending: {}, deadline: ctx.now + ms, phaseMs: ms };
}

function revealMs(s: PhoneState, chain: number, shown: number): number {
  const e = s.chains[chain]?.entries[shown - 1];
  const base = e?.kind === "drawing" ? PHONE_REVEAL_DRAWING_MS : PHONE_REVEAL_TEXT_MS;
  return shown >= s.config.steps ? base + PHONE_REVEAL_END_MS : base;
}

function startReveal(s: PhoneState, ctx: GameContext): PhoneState {
  const ms = revealMs(s, 0, 1);
  return { ...s, phase: "reveal", revealChain: 0, revealShown: 1, deadline: ctx.now + ms, phaseMs: ms };
}

function revealNext(s: PhoneState, ctx: GameContext): PhoneState {
  let chain = s.revealChain;
  let shown = s.revealShown + 1;
  if (shown > s.config.steps) {
    chain += 1;
    shown = 1;
  }
  if (chain >= s.chains.length) return { ...s, phase: "final", deadline: null, phaseMs: 0 };
  const ms = revealMs(s, chain, shown);
  return { ...s, revealChain: chain, revealShown: shown, deadline: ctx.now + ms, phaseMs: ms };
}

export function reducePhone(s: PhoneState, action: GameAction<PhoneClientAction>, ctx: GameContext): GameReduceResult<PhoneState> {
  switch (action.type) {
    case "presence": {
      const added = latePlayers(s.players, action.players);
      let next: PhoneState = { ...s, connectedIds: action.connectedIds };
      if (added.length) {
        next = {
          ...next,
          players: [...s.players, ...added],
          scores: withZeros(s.scores, added),
          drawLikes: withZeros(s.drawLikes, added),
          textLikes: withZeros(s.textLikes, added),
        };
      }
      // Quelqu'un est parti et tous les présents ont rendu : on passe.
      if (next.phase === "play" && next.order.some((id) => next.connectedIds.includes(id)) && waitingOn(next).length === 0) {
        return { state: endStep(next, ctx) };
      }
      return { state: next };
    }
    case "advance": {
      if (s.phase === "play") return { state: endStep(s, ctx) };
      if (s.phase === "reveal") return { state: revealNext(s, ctx) };
      return { state: s };
    }
    case "client": {
      const { playerId, msg } = action;
      if (msg?.kind === "submit") {
        if (s.phase !== "play" || !s.order.includes(playerId)) return { state: s };
        const content = cleanPhoneContent(stepKindOf(s.step), msg.content);
        if (!content) return { state: s, error: { code: "bad_content", message: "Ce rendu est vide ou trop lourd." } };
        const next = { ...s, pending: { ...s.pending, [playerId]: content } };
        if (waitingOn(next).length === 0) return { state: endStep(next, ctx) };
        return { state: next };
      }
      if (msg?.kind === "like") {
        if (s.phase !== "reveal") return { state: s };
        const { chain, step } = msg;
        if (chain !== s.revealChain || !Number.isInteger(step) || step < 0 || step >= s.revealShown) return { state: s };
        const entry = s.chains[chain]?.entries[step];
        if (!entry || entry.auto || entry.authorId === playerId) return { state: s };
        if (!s.players.some((p) => p.id === playerId)) return { state: s };
        const key = `${chain}:${step}`;
        if ((s.likes[key] ?? []).includes(playerId)) return { state: s };
        const stat = entry.kind === "drawing" ? "drawLikes" : "textLikes";
        return {
          state: {
            ...s,
            likes: { ...s.likes, [key]: [...(s.likes[key] ?? []), playerId] },
            scores: { ...s.scores, [entry.authorId]: (s.scores[entry.authorId] ?? 0) + PHONE_LIKE_POINTS },
            [stat]: { ...s[stat], [entry.authorId]: (s[stat][entry.authorId] ?? 0) + 1 },
          },
        };
      }
      return { state: s };
    }
  }
  return { state: s };
}

function publicChain(s: PhoneState, index: number, upTo: number, viewerId: PlayerId): PhonePublicChain {
  const c = s.chains[index];
  return {
    index,
    ownerId: c.ownerId,
    entries: c.entries.slice(0, upTo).map((e, step) => {
      const voters = s.likes[`${index}:${step}`] ?? [];
      return { ...e, step, likes: voters.length, youLiked: voters.includes(viewerId) };
    }),
  };
}

export function projectPhone(s: PhoneState, viewerId: PlayerId): PhonePublic {
  const kind = stepKindOf(s.step);
  let task: PhonePublic["task"] = null;
  if (s.phase === "play") {
    const c = chainFor(s, viewerId, s.step);
    if (c >= 0) task = { kind, prev: s.step > 0 ? s.chains[c].entries[s.step - 1] ?? null : null, first: s.step === 0 };
  }
  const mine = s.pending[viewerId];
  return {
    phase: s.phase,
    mode: s.config.mode,
    players: s.players,
    order: s.order,
    step: s.step,
    steps: s.config.steps,
    stepKind: kind,
    task,
    // Le dessin rendu n'est pas renvoyé (lourd) : `submittedIds` suffit.
    yourContent: s.phase === "play" && kind === "text" ? mine ?? null : null,
    submittedIds: s.phase === "play" ? Object.keys(s.pending) : [],
    deadline: s.deadline,
    phaseMs: s.phaseMs,
    scores: s.scores,
    reveal:
      s.phase === "reveal"
        ? { chain: publicChain(s, s.revealChain, s.revealShown, viewerId), chainIndex: s.revealChain, chainCount: s.chains.length, shown: s.revealShown }
        : null,
    album: s.phase === "final" ? s.chains.map((_, i) => publicChain(s, i, s.config.steps, viewerId)) : null,
    drawLikes: s.phase === "final" ? s.drawLikes : null,
    textLikes: s.phase === "final" ? s.textLikes : null,
  };
}
