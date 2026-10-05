"use client";

// « Imposteur » — vue joueur : carte secrète → indices à tour de rôle → vote →
// (dernière chance de l'imposteur) → révélation → … → final.

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GamePlayer, ImposterPublic } from "@subtitles-party/shared";
import { IMPOSTER_CLUE_MAX } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { Avatar } from "@/components/Avatar";
import { playSound } from "@/lib/sound";
import { BODY, DISPLAY, Gain, HostSkip, K, MONO, PlayerGrid, SocialFinal, SocialHeader, SocialStage, StatusBar, hexA, plural, topOf, useCountdown } from "@/components/social/kit";

const ACCENT = "#FF5C7A";

const PHASE_LABEL: Record<string, string> = {
  secret: "Carte secrète",
  clues: "Indices",
  vote: "Vote",
  guess: "Dernière chance",
  reveal: "Révélation",
};

export function ImposterView({ room }: { room: UseRoom }) {
  const g = room.game as ImposterPublic | null;
  const left = useCountdown(g && g.phase !== "final" ? g.deadline : null, room.serverNow);

  // Sons : ton tour, révélation, fin.
  const prev = useRef<{ phase: string | null; current: string | null }>({ phase: null, current: null });
  useEffect(() => {
    if (!g) return;
    const p = prev.current;
    if (g.phase === "clues" && g.currentId === room.you && p.current !== room.you) playSound("yourTurn");
    if (g.phase === "vote" && p.phase === "clues") playSound("start");
    if (g.phase === "reveal" && p.phase !== "reveal") playSound("reveal");
    if (g.phase === "final" && p.phase !== "final") playSound("fanfare");
    prev.current = { phase: g.phase, current: g.currentId };
  }, [g, room.you]);

  if (!g) return null;

  if (g.phase === "final") return <ImposterFinal room={room} g={g} />;

  const inRound = g.roster.includes(room.you);
  const nameOf = (id: string | null | undefined) => g.players.find((p) => p.id === id)?.name ?? "?";

  return (
    <SocialStage gameId="imposter">
      <SocialHeader gameId="imposter" round={g.round} total={g.totalRounds} label={`${g.category} · ${PHASE_LABEL[g.phase] ?? ""}`} left={left} seconds={Math.round(g.phaseMs / 1000)} />

      {!inRound && g.phase !== "reveal" && (
        <p style={{ textAlign: "center", color: K.muted, margin: "0 0 16px" }}>Tu regardes cette manche — tu joueras à la suivante.</p>
      )}

      {g.phase === "secret" && <SecretPhase room={room} g={g} inRound={inRound} />}

      {(g.phase === "clues" || g.phase === "vote" || g.phase === "guess") && inRound && <WordPill g={g} />}

      {g.phase === "clues" && <CluesPhase room={room} g={g} nameOf={nameOf} />}
      {g.phase === "vote" && <VotePhase room={room} g={g} inRound={inRound} />}
      {g.phase === "guess" && <GuessPhase room={room} g={g} nameOf={nameOf} />}
      {g.phase === "reveal" && <RevealPhase room={room} g={g} nameOf={nameOf} />}
    </SocialStage>
  );
}

/* ------------------------------------------------------------------ carte */

function SecretPhase({ room, g, inRound }: { room: UseRoom; g: ImposterPublic; inRound: boolean }) {
  const [shown, setShown] = useState(false);
  const seen = g.seenIds.includes(room.you);
  if (!inRound) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <p style={{ margin: 0, color: K.muted, textAlign: "center", fontSize: 14 }}>Cache ton écran, puis retourne ta carte.</p>
      <button
        onClick={() => { setShown((v) => !v); playSound("click"); }}
        aria-label={shown ? "Cacher ma carte" : "Voir ma carte"}
        className="sk-card"
        style={{ width: "min(340px, 100%)", minHeight: 220, borderRadius: 26, border: `1px solid ${shown ? hexA(g.youAreImposter ? ACCENT : K.mint, 0.6) : K.line}`, background: shown ? (g.youAreImposter ? `linear-gradient(160deg, ${hexA(ACCENT, 0.3)}, ${K.surface})` : `linear-gradient(160deg, ${hexA(K.mint, 0.18)}, ${K.surface})`) : `repeating-linear-gradient(135deg, ${K.raised} 0 14px, ${K.surface} 14px 28px)`, color: K.text, padding: 24, cursor: "pointer", boxShadow: "0 18px 40px -22px rgba(0,0,0,.9)", animation: "sk-pop .4s ease-out both" }}
      >
        {!shown ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/games/imposter.webp" alt="" width={72} height={72} style={{ borderRadius: 18 }} />
            <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20 }}>Touche pour voir ta carte</span>
          </div>
        ) : g.youAreImposter ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: ACCENT }}>Ton rôle</span>
            <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 34, color: ACCENT, letterSpacing: "-.01em" }}>Imposteur</span>
            <span style={{ fontSize: 15, color: K.muted }}>Catégorie : <b style={{ color: K.text }}>{g.category}</b></span>
            <span style={{ fontSize: 13, color: K.muted, maxWidth: 260 }}>Tu n&apos;as pas le mot. Écoute les autres, fonds-toi dans la masse… et ne te fais pas griller.</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: K.mint }}>Ton mot</span>
            <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 34, letterSpacing: "-.01em" }}>{g.yourWord}</span>
            <span style={{ fontSize: 13, color: K.muted, maxWidth: 260 }}>
              {g.mode === "infiltre"
                ? "Attention : quelqu'un a un mot légèrement différent… et ce n'est peut-être pas celui que tu crois."
                : "Un imposteur n'a pas ce mot. Donne des indices assez clairs pour tes alliés, mais pas trop pour lui !"}
            </span>
          </div>
        )}
      </button>
      <button
        className={`arc ${seen ? "arc-sec" : "arc-ready"}`}
        disabled={seen}
        onClick={() => { room.gameAction({ kind: "seen" }); playSound("click"); }}
        style={{ minWidth: 220, opacity: seen ? 0.7 : 1 }}
      >
        {seen ? "On attend les autres…" : "C'est bon, j'ai vu"}
      </button>
      <StatusBar>
        <span><b style={{ color: K.text }}>{g.seenIds.length}</b>/{g.roster.length} prêts</span>
        <HostSkip room={room} label="Commencer les indices" />
      </StatusBar>
    </div>
  );
}

/** Rappel discret du mot (masquable) pendant la manche. */
function WordPill({ g }: { g: ImposterPublic }) {
  const [hidden, setHidden] = useState(false);
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
      <button
        onClick={() => setHidden((v) => !v)}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 999, border: `1px solid ${g.youAreImposter ? hexA(ACCENT, 0.6) : K.line}`, background: g.youAreImposter ? hexA(ACCENT, 0.12) : "rgba(28,22,54,.7)", color: K.text, fontSize: 14, cursor: "pointer", fontFamily: BODY }}
      >
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: K.faint }}>{g.youAreImposter ? "Rôle" : "Ton mot"}</span>
        <b style={{ fontFamily: DISPLAY, color: g.youAreImposter ? ACCENT : K.text, filter: hidden ? "blur(7px)" : "none", transition: "filter .2s" }}>
          {g.youAreImposter ? "Imposteur" : g.yourWord}
        </b>
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- indices */

function CluesBoard({ g, highlight, footer }: { g: ImposterPublic; highlight?: string | null; footer?: (p: GamePlayer) => ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", textAlign: "left" }}>
      {g.order.map((id, i) => {
        const p = g.players.find((x) => x.id === id);
        if (!p) return null;
        const mine = g.clues.filter((c) => c.playerId === id);
        const cur = highlight === id;
        return (
          <div key={id} style={{ ["--a" as string]: ACCENT, display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 16, border: `1px solid ${cur ? ACCENT : K.line}`, background: cur ? `linear-gradient(90deg, ${hexA(ACCENT, 0.16)}, rgba(28,22,54,.7))` : "rgba(28,22,54,.6)", animation: `sk-rise .3s ease-out ${(i * 0.04).toFixed(2)}s both${cur ? ", sk-glow 2.4s ease-in-out infinite" : ""}` }}>
            <span style={{ width: 18, fontFamily: MONO, fontSize: 12, color: K.faint }}>{i + 1}</span>
            <Avatar name={p.name} color={p.color} avatar={p.avatar} size={36} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15 }}>{p.name}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: mine.length ? 5 : 0 }}>
                {mine.map((c, k) => (
                  <span key={k} style={{ padding: "3px 10px", borderRadius: 999, background: c.text ? K.raised : "transparent", border: `1px solid ${c.text ? K.line : "transparent"}`, color: c.text ? K.text : K.faint, fontSize: 14, fontStyle: c.text ? "normal" : "italic", animation: "sk-pop .35s ease-out both" }}>
                    {c.text || "pas d'indice"}
                  </span>
                ))}
                {cur && <span style={{ color: ACCENT, fontSize: 13, fontStyle: "italic" }}>réfléchit…</span>}
              </div>
            </div>
            {footer?.(p)}
          </div>
        );
      })}
    </div>
  );
}

function CluesPhase({ room, g, nameOf }: { room: UseRoom; g: ImposterPublic; nameOf: (id: string | null) => string }) {
  const [draft, setDraft] = useState("");
  const myTurn = g.currentId === room.you;
  const turnKey = `${g.pass}-${g.currentId}`;
  useEffect(() => setDraft(""), [turnKey]);
  const err = room.error?.code === "clue_is_word" ? room.error.message : null;
  return (
    <>
      <div style={{ textAlign: "center", margin: "0 0 14px" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 22 }}>
          {myTurn ? <span style={{ color: ACCENT }}>À toi ! Donne ton indice</span> : <>Au tour de <span style={{ color: ACCENT }}>{nameOf(g.currentId)}</span></>}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: K.faint, marginTop: 4 }}>
          Tour d&apos;indices {g.pass}/{g.passes}
        </div>
      </div>
      {myTurn && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = draft.trim();
            if (!t) return;
            room.gameAction({ kind: "clue", text: t });
            playSound("vote");
          }}
          style={{ display: "flex", gap: 10, maxWidth: 560, margin: "0 auto 16px" }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => { setDraft(e.target.value.slice(0, IMPOSTER_CLUE_MAX)); if (room.error) room.clearError(); }}
            maxLength={IMPOSTER_CLUE_MAX}
            placeholder="Un mot ou deux, pas le mot secret…"
            aria-label="Ton indice"
            style={{ flex: 1, minWidth: 0, padding: "14px 16px", borderRadius: 14, border: `1px solid ${hexA(ACCENT, 0.55)}`, background: K.ink, color: K.text, fontSize: 17, fontFamily: BODY, outline: "none" }}
          />
          <button type="submit" className="arc arc-p" disabled={!draft.trim()} style={{ opacity: draft.trim() ? 1 : 0.5 }}>Envoyer</button>
        </form>
      )}
      {myTurn && err && <p style={{ textAlign: "center", color: K.danger, margin: "-6px 0 14px", fontSize: 14 }}>{err}</p>}
      <CluesBoard g={g} highlight={g.currentId} />
      <StatusBar>
        <span>Un indice court, sans dire le mot. L&apos;imposteur écoute…</span>
        <HostSkip room={room} label="Passer ce joueur" />
      </StatusBar>
    </>
  );
}

/* ------------------------------------------------------------------- vote */

function VotePhase({ room, g, inRound }: { room: UseRoom; g: ImposterPublic; inRound: boolean }) {
  const voted = g.yourVote != null;
  const roster = g.players.filter((p) => g.roster.includes(p.id));
  return (
    <>
      <div style={{ textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 24, margin: "0 0 6px" }}>Qui est l&apos;imposteur ?</div>
      <p style={{ textAlign: "center", margin: "0 0 14px", color: K.muted, fontSize: 14 }}>
        {!inRound ? "Le vote est en cours." : voted ? "Vote enregistré ! On attend les autres…" : g.youAreImposter ? "Vote comme si de rien n'était…" : "Relis les indices et désigne le suspect."}
      </p>
      <PlayerGrid
        players={roster}
        you={room.you}
        accent={ACCENT}
        selected={g.yourVote}
        disabledIds={inRound && !voted ? [room.you] : roster.map((p) => p.id)}
        onPick={inRound && !voted ? (id) => { playSound("vote"); room.gameAction({ kind: "vote", targetId: id }); } : undefined}
        badge={(p) => (g.votedIds.includes(p.id) ? <span title="A voté" style={{ display: "grid", placeItems: "center", width: 22, height: 22, borderRadius: 999, background: hexA(K.mint, 0.2), color: K.mint, fontSize: 12, fontWeight: 800 }}>✓</span> : null)}
        footer={(p) => {
          const cl = g.clues.filter((c) => c.playerId === p.id);
          return (
            <span style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 4 }}>
              {cl.map((c, i) => (
                <span key={i} style={{ padding: "2px 8px", borderRadius: 999, background: K.raised, color: c.text ? K.muted : K.faint, fontSize: 12, fontStyle: c.text ? "normal" : "italic" }}>{c.text || "—"}</span>
              ))}
            </span>
          );
        }}
      />
      <StatusBar>
        <span><b style={{ color: K.text }}>{g.votedIds.length}</b>/{g.roster.length} ont voté · égalité = l&apos;imposteur s&apos;échappe</span>
        <HostSkip room={room} label="Clore le vote" />
      </StatusBar>
    </>
  );
}

/* -------------------------------------------------------- dernière chance */

function GuessPhase({ room, g, nameOf }: { room: UseRoom; g: ImposterPublic; nameOf: (id: string | null) => string }) {
  const [draft, setDraft] = useState("");
  const accused = g.accused[0] ?? null;
  const p = g.players.find((x) => x.id === accused);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
      {p && <span style={{ ["--a" as string]: ACCENT, borderRadius: 18, animation: "sk-glow 2s ease-in-out infinite" }}><Avatar name={p.name} color={p.color} avatar={p.avatar} size={84} /></span>}
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26 }}>
        {g.youAreImposter ? <span style={{ color: ACCENT }}>Démasqué !</span> : <><span style={{ color: ACCENT }}>{nameOf(accused)}</span> est démasqué·e !</>}
      </div>
      {g.youAreImposter ? (
        <form
          onSubmit={(e) => { e.preventDefault(); if (draft.trim()) room.gameAction({ kind: "guess", text: draft.trim() }); }}
          style={{ display: "flex", flexDirection: "column", gap: 10, width: "min(460px, 100%)" }}
        >
          <p style={{ margin: 0, color: K.muted }}>Dernière chance : trouve le mot et tu voles la manche (+150).</p>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, IMPOSTER_CLUE_MAX))}
            placeholder="Le mot secret, c'était…"
            aria-label="Ta proposition"
            style={{ padding: "14px 16px", borderRadius: 14, border: `1px solid ${hexA(ACCENT, 0.55)}`, background: K.ink, color: K.text, fontSize: 18, fontFamily: BODY, outline: "none", textAlign: "center" }}
          />
          <button type="submit" className="arc arc-p arc-block" disabled={!draft.trim()} style={{ opacity: draft.trim() ? 1 : 0.5 }}>Tenter ma chance</button>
        </form>
      ) : (
        <p style={{ margin: 0, color: K.muted, maxWidth: 420 }}>Mais tout n&apos;est pas joué : s&apos;il devine le mot secret, il vole la manche. Croisez les doigts…</p>
      )}
      <CluesBoard g={g} />
    </div>
  );
}

/* ------------------------------------------------------------- révélation */

const OUTCOME_TEXT: Record<string, { title: string; sub: string; good: boolean }> = {
  caught: { title: "Imposteur démasqué !", sub: "La table a vu clair dans son jeu.", good: true },
  stolen: { title: "Démasqué… mais il a trouvé le mot !", sub: "Il vole la manche sur le fil.", good: false },
  escaped: { title: "L'imposteur s'en sort !", sub: "Vous avez accusé la mauvaise personne.", good: false },
  left: { title: "L'imposteur a quitté la partie", sub: "Manche annulée, aucun point.", good: false },
};

function RevealPhase({ room, g, nameOf }: { room: UseRoom; g: ImposterPublic; nameOf: (id: string | null) => string }) {
  const r = g.reveal;
  if (!r) return null;
  const base = OUTCOME_TEXT[r.outcome] ?? OUTCOME_TEXT.caught;
  const o =
    r.outcome === "escaped" && r.accused.length === 0 ? { ...base, sub: "Personne n'a voté… il file en douce." }
    : r.outcome === "escaped" && r.accused.length > 1 ? { ...base, sub: "Égalité au vote : le doute profite à l'imposteur." }
    : base;
  const imp = g.players.find((p) => p.id === r.imposterId);
  const roster = g.players.filter((p) => g.roster.includes(p.id));
  const tally = r.tally ?? {};
  const sorted = roster.slice().sort((a, b) => (tally[b.id] ?? 0) - (tally[a.id] ?? 0));
  return (
    <>
      <section style={{ textAlign: "center", margin: "4px 0 18px", padding: "22px 18px", borderRadius: 24, border: `1px solid ${hexA(o.good ? K.mint : ACCENT, 0.45)}`, background: `linear-gradient(160deg, ${hexA(o.good ? K.mint : ACCENT, 0.14)}, rgba(28,22,54,.75) 60%)`, animation: "sk-pop .45s ease-out both" }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: K.faint }}>L&apos;imposteur était…</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, margin: "12px 0 8px" }}>
          {imp && <Avatar name={imp.name} color={imp.color} avatar={imp.avatar} size={52} />}
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 30, color: ACCENT }}>{nameOf(r.imposterId)}{r.imposterId === room.you ? " (toi)" : ""}</span>
        </div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, color: o.good ? K.mint : K.gold }}>{o.title}</div>
        <div style={{ color: K.muted, fontSize: 14, marginTop: 2 }}>{o.sub}</div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 14 }}>
          <span style={{ padding: "6px 14px", borderRadius: 999, background: K.raised, fontSize: 14 }}>Le mot : <b style={{ fontFamily: DISPLAY }}>{r.word}</b></span>
          {r.decoy && <span style={{ padding: "6px 14px", borderRadius: 999, background: hexA(ACCENT, 0.15), fontSize: 14 }}>Son mot : <b style={{ fontFamily: DISPLAY }}>{r.decoy}</b></span>}
          {r.guess && <span style={{ padding: "6px 14px", borderRadius: 999, background: K.raised, fontSize: 14, color: K.muted }}>Sa proposition : « {r.guess} »</span>}
        </div>
      </section>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((p, i) => {
          const n = tally[p.id] ?? 0;
          const isImp = p.id === r.imposterId;
          const voters = Object.entries(r.votes ?? {}).filter(([, t]) => t === p.id).map(([v]) => g.players.find((x) => x.id === v)).filter(Boolean) as GamePlayer[];
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 16, border: `1px solid ${isImp ? ACCENT : K.line}`, background: isImp ? hexA(ACCENT, 0.1) : "rgba(28,22,54,.6)", animation: `sk-rise .3s ease-out ${(0.2 + i * 0.06).toFixed(2)}s both` }}>
              <Avatar name={p.name} color={p.color} avatar={p.avatar} size={38} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontFamily: DISPLAY, fontWeight: 700, fontSize: 15 }}>
                  {p.name}
                  {isImp && <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: ACCENT }}>imposteur</span>}
                  <Gain value={r.gained?.[p.id] ?? 0} />
                </div>
                {voters.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
                    {voters.map((v) => <Avatar key={v.id} name={v.name} color={v.color} avatar={v.avatar} size={20} />)}
                  </div>
                )}
              </div>
              <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, color: isImp ? ACCENT : K.muted }}>{n}</span>
            </div>
          );
        })}
      </div>
      <StatusBar>
        <span>Bon vote : <b style={{ color: K.mint }}>+100</b> · imposteur qui s&apos;échappe : <b style={{ color: ACCENT }}>+250</b></span>
        <HostSkip room={room} label={g.round >= g.totalRounds ? "Résultats" : "Manche suivante"} />
      </StatusBar>
    </>
  );
}

/* ------------------------------------------------------------------ final */

const OUTCOME_SHORT: Record<string, string> = { caught: "démasqué", stolen: "a volé la manche", escaped: "s'en est sorti", left: "parti" };

function ImposterFinal({ room, g }: { room: UseRoom; g: ImposterPublic }) {
  const awards: { label: string; playerId: string; detail?: string }[] = [];
  const liar = topOf(g.imposterWins);
  if (liar) awards.push({ label: "Meilleur menteur", playerId: liar, detail: `${plural(g.imposterWins![liar], "manche")} gagnée${g.imposterWins![liar] > 1 ? "s" : ""}` });
  const det = topOf(g.goodVotes);
  if (det) awards.push({ label: "Détective", playerId: det, detail: `${plural(g.goodVotes![det], "imposteur")} démasqué${g.goodVotes![det] > 1 ? "s" : ""}` });
  const nameOf = (id: string) => g.players.find((p) => p.id === id)?.name ?? "?";
  return (
    <SocialStage gameId="imposter">
      <SocialFinal room={room} players={g.players} scores={g.scores} awards={awards} />
      {g.history && g.history.length > 0 && (
        <section style={{ maxWidth: 560, margin: "26px auto 0" }}>
          <h3 style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: K.faint, textAlign: "center", marginBottom: 10 }}>Les manches</h3>
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {g.history.map((h, i) => (
              <li key={i} style={{ padding: "10px 14px", borderRadius: 14, border: `1px solid ${K.line}`, background: "rgba(28,22,54,.55)", fontSize: 14, color: K.muted }}>
                <b style={{ color: K.text }}>{h.word}</b>
                {h.decoy ? <> / {h.decoy}</> : null} — <b style={{ color: ACCENT }}>{nameOf(h.imposterId)}</b> {OUTCOME_SHORT[h.outcome]}
              </li>
            ))}
          </ol>
        </section>
      )}
    </SocialStage>
  );
}
