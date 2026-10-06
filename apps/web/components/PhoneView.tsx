"use client";

// « Téléphone cassé » — vue joueur : phrase → dessin → description → … puis
// la grande révélation des chaînes, étape par étape, et l'album final.

import { useEffect, useRef, useState } from "react";
import type { GamePlayer, PhoneEntry, PhonePublic, PhonePublicChain, PhonePublicEntry } from "@subtitles-party/shared";
import { PHONE_TEXT_MAX, phonePhraseBank } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { Avatar } from "@/components/Avatar";
import { DrawPad, type DrawPadHandle } from "@/components/DrawPad";
import { playSound } from "@/lib/sound";
import { useAutoSubmit } from "@/lib/useAutoSubmit";
import { BODY, DISPLAY, HostSkip, K, MONO, SocialFinal, SocialHeader, SocialStage, StatusBar, hexA, plural, topOf, useCountdown } from "@/components/social/kit";

const ACCENT = "rgb(var(--c-mint))";

export function PhoneView({ room }: { room: UseRoom }) {
  const g = room.game as PhonePublic | null;
  const left = useCountdown(g && g.phase !== "final" ? g.deadline : null, room.serverNow);

  const prev = useRef<{ phase: string | null; step: number; shown: number }>({ phase: null, step: -1, shown: 0 });
  useEffect(() => {
    if (!g) return;
    const p = prev.current;
    if (g.phase === "play" && g.step !== p.step && p.phase === "play") playSound("start");
    if (g.phase === "reveal" && (p.phase !== "reveal" || g.reveal?.shown !== p.shown)) playSound("reveal");
    if (g.phase === "final" && p.phase !== "final") playSound("fanfare");
    prev.current = { phase: g.phase, step: g.step, shown: g.reveal?.shown ?? 0 };
  }, [g]);

  if (!g) return null;
  if (g.phase === "final") return <PhoneFinal room={room} g={g} />;

  if (g.phase === "reveal" && g.reveal) {
    return (
      <SocialStage gameId="phone">
        <SocialHeader gameId="phone" unit="Chaîne" round={g.reveal.chainIndex + 1} total={g.reveal.chainCount} label="Révélation" left={left} seconds={Math.round(g.phaseMs / 1000)} />
        <ChainView room={room} g={g} chain={g.reveal.chain} live />
        <StatusBar>
          <span>Touche <b style={{ color: K.pink }}>J&apos;adore</b> sous tes passages préférés : <b style={{ color: K.mint }}>+100</b> pour l&apos;auteur</span>
          <HostSkip room={room} label="Suite" />
        </StatusBar>
      </SocialStage>
    );
  }

  const kindLabel = g.task?.first ? "Phrase de départ" : g.stepKind === "drawing" ? "Dessine" : "Décris";
  return (
    <SocialStage gameId="phone">
      <SocialHeader gameId="phone" unit="Étape" round={g.step + 1} total={g.steps} label={kindLabel} left={left} seconds={Math.round(g.phaseMs / 1000)} />
      <StepProgress g={g} />
      {!g.task ? (
        <p style={{ textAlign: "center", color: K.muted }}>Tu regardes cette partie — les chaînes sont déjà lancées. Rendez-vous à la révélation !</p>
      ) : g.task.kind === "drawing" ? (
        <DrawTask key={`d${g.step}`} room={room} g={g} />
      ) : (
        <TextTask key={`t${g.step}`} room={room} g={g} />
      )}
      <StatusBar>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <span><b style={{ color: K.text }}>{g.submittedIds.length}</b>/{g.order.length} ont rendu</span>
          <span style={{ display: "inline-flex", gap: 3 }}>
            {g.order.map((id) => {
              const p = g.players.find((x) => x.id === id);
              if (!p) return null;
              const done = g.submittedIds.includes(id);
              return <span key={id} title={p.name} style={{ opacity: done ? 1 : 0.3, transition: "opacity .2s" }}><Avatar name={p.name} color={p.color} avatar={p.avatar} size={20} /></span>;
            })}
          </span>
        </span>
        <HostSkip room={room} label="Étape suivante" />
      </StatusBar>
    </SocialStage>
  );
}

/** Pastilles d'étapes : ✎ écrire / pinceau dessiner. */
function StepProgress({ g }: { g: PhonePublic }) {
  return (
    <div aria-hidden style={{ display: "flex", justifyContent: "center", gap: 6, margin: "-4px 0 16px" }}>
      {Array.from({ length: g.steps }, (_, i) => {
        const done = i < g.step;
        const cur = i === g.step;
        return (
          <span key={i} style={{ display: "grid", placeItems: "center", minWidth: 30, height: 24, padding: "0 8px", borderRadius: 999, fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: cur ? K.ink : done ? ACCENT : K.faint, background: cur ? ACCENT : done ? hexA(ACCENT, 0.14) : K.raised }}>
            {i % 2 === 0 ? (i === 0 ? "phrase" : "texte") : "dessin"}
          </span>
        );
      })}
    </div>
  );
}

/** Ce que le joueur reçoit de l'étape précédente. */
function Received({ entry }: { entry: PhoneEntry }) {
  if (entry.kind === "drawing") {
    return entry.content ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={entry.content} alt="Dessin à décrire" style={{ width: "100%", maxWidth: 560, aspectRatio: "4 / 3", objectFit: "contain", borderRadius: 18, background: "#fff", display: "block", margin: "0 auto", boxShadow: `0 0 0 2px ${hexA(ACCENT, 0.4)}, 0 20px 40px -24px rgba(0,0,0,.9)`, animation: "sk-pop .4s ease-out both" }} />
    ) : (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: 28, borderRadius: 18, border: `1px dashed ${K.line}`, color: K.muted, textAlign: "center" }}>Le dessin s&apos;est perdu en route… invente ce que tu veux !</div>
    );
  }
  return (
    <section style={{ margin: "0 auto 14px", maxWidth: 640, padding: "18px 20px", borderRadius: 22, border: `1px solid ${hexA(ACCENT, 0.4)}`, background: `linear-gradient(160deg, ${hexA(ACCENT, 0.12)}, rgb(var(--c-ink-surface) / .75) 60%)`, textAlign: "center", animation: "sk-rise .35s ease-out both" }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: ACCENT, marginBottom: 6 }}>Dessine…</div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "clamp(20px, 4.4vw, 30px)", lineHeight: 1.2 }}>{entry.content || "… rien du tout. Dessine ce qui te passe par la tête !"}</div>
    </section>
  );
}

function TextTask({ room, g }: { room: UseRoom; g: PhonePublic }) {
  const first = !!g.task?.first;
  const [draft, setDraft] = useState(g.yourContent ?? "");
  const send = (t: string) => {
    const v = t.trim();
    if (!v) return;
    room.gameAction({ kind: "submit", content: v });
    playSound("vote");
  };
  useAutoSubmit({ key: `phone-${g.step}`, active: !!g.task && g.yourContent == null, deadline: g.deadline, now: room.serverNow, text: draft, submit: send });
  const inspire = () => {
    const bank = phonePhraseBank();
    setDraft(bank[Math.floor(Math.random() * bank.length)] ?? "");
    playSound("click");
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {first ? (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 24 }}>Écris une phrase à dessiner</div>
          <p style={{ margin: "4px 0 0", color: K.muted, fontSize: 14 }}>Une situation, une scène absurde… le joueur suivant devra la dessiner.</p>
        </div>
      ) : (
        <>
          <div style={{ textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 22 }}>Qu&apos;est-ce que c&apos;est ?</div>
          {g.task?.prev && <Received entry={g.task.prev} />}
        </>
      )}
      <form onSubmit={(e) => { e.preventDefault(); send(draft); }} style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 620, margin: "0 auto" }}>
        <div style={{ position: "relative" }}>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, PHONE_TEXT_MAX))}
            maxLength={PHONE_TEXT_MAX}
            placeholder={first ? "Un pingouin qui fait du ski nautique…" : "Décris le dessin en une phrase…"}
            aria-label={first ? "Ta phrase" : "Ta description"}
            style={{ width: "100%", boxSizing: "border-box", padding: "16px 56px 16px 18px", borderRadius: 16, border: `1px solid ${hexA(ACCENT, 0.5)}`, background: K.ink, color: K.text, fontSize: 18, fontFamily: BODY, outline: "none" }}
          />
          <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontFamily: MONO, fontSize: 12, color: K.faint }}>{PHONE_TEXT_MAX - draft.length}</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {first && <button type="button" onClick={inspire} className="arc arc-sec" style={{ flex: "none" }}>Inspire-moi</button>}
          <button type="submit" className="arc arc-ready arc-block" disabled={!draft.trim()} style={{ opacity: draft.trim() ? 1 : 0.5 }}>
            {g.yourContent ? "Modifier" : "Envoyer"}
          </button>
        </div>
        {g.yourContent && <p style={{ margin: 0, textAlign: "center", color: K.mint, fontSize: 14 }}>Envoyé ! Tu peux encore modifier tant que le chrono tourne.</p>}
      </form>
    </div>
  );
}

function DrawTask({ room, g }: { room: UseRoom; g: PhonePublic }) {
  const pad = useRef<DrawPadHandle | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [dirty, setDirty] = useState(true);
  const submitted = g.submittedIds.includes(room.you);
  const send = () => {
    const img = pad.current?.exportImage();
    if (!img) return;
    room.gameAction({ kind: "submit", content: img });
    setDirty(false);
    playSound("vote");
  };
  // Envoi automatique juste avant la fin du chrono (si le dessin a changé).
  const sendRef = useRef(send);
  sendRef.current = send;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (g.deadline == null) return;
    const id = window.setInterval(() => {
      if (g.deadline! - room.serverNow() > 900) return;
      window.clearInterval(id);
      if (dirtyRef.current && !pad.current?.isEmpty()) sendRef.current();
    }, 150);
    return () => window.clearInterval(id);
  }, [g.deadline, room]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640, margin: "0 auto" }}>
      {g.task?.prev && <Received entry={g.task.prev} />}
      <DrawPad ref={pad} accent={ACCENT} onInk={(v) => { setHasInk(v); setDirty(true); }} />
      <button className="arc arc-ready arc-block" onClick={send} disabled={!hasInk} style={{ opacity: hasInk ? 1 : 0.5 }}>
        {submitted ? (dirty ? "Renvoyer ma nouvelle version" : "Envoyé ✓ — tu peux encore retoucher") : "J'ai fini !"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------- révélation */

function EntryCard({ room, g, chain, e, live, isNew }: { room: UseRoom; g: PhonePublic; chain: PhonePublicChain; e: PhonePublicEntry; live: boolean; isNew: boolean }) {
  const p = g.players.find((x) => x.id === e.authorId);
  const mine = e.authorId === room.you;
  const canLike = live && !mine && !e.youLiked && !e.auto;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: e.kind === "drawing" ? "stretch" : "flex-start", animation: isNew ? "sk-pop .5s cubic-bezier(.2,.9,.3,1.3) both" : undefined }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {p && <Avatar name={p.name} color={p.color} avatar={p.avatar} size={26} />}
        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 14 }}>{p?.name ?? "?"}</span>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: K.faint }}>
          {e.step === 0 ? "a écrit" : e.kind === "drawing" ? "a dessiné" : "a compris"}
        </span>
      </div>
      {e.kind === "drawing" ? (
        e.content ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.content} alt={`Dessin de ${p?.name ?? "?"}`} style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "contain", borderRadius: 18, background: "#fff", boxShadow: "0 18px 36px -22px rgba(0,0,0,.9)" }} />
        ) : (
          <div style={{ padding: 22, borderRadius: 18, border: `1px dashed ${K.line}`, color: K.faint, textAlign: "center", fontStyle: "italic" }}>Page blanche…</div>
        )
      ) : (
        <div style={{ maxWidth: "100%", padding: "12px 18px", borderRadius: "6px 20px 20px 20px", background: e.step === 0 ? hexA(K.gold, 0.16) : K.raised, border: `1px solid ${e.step === 0 ? hexA(K.gold, 0.5) : K.line}`, fontFamily: DISPLAY, fontWeight: 700, fontSize: "clamp(17px, 3.6vw, 22px)", lineHeight: 1.25, color: e.content ? K.text : K.faint, fontStyle: e.content ? "normal" : "italic" }}>
          {e.content || "… silence radio"}
        </div>
      )}
      {(live || e.likes > 0) && !e.auto && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {live && !mine && (
            <button
              onClick={() => { if (canLike) { room.gameAction({ kind: "like", chain: chain.index, step: e.step }); playSound("click"); } }}
              disabled={!canLike}
              aria-pressed={e.youLiked}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999, border: `1px solid ${e.youLiked ? K.pink : K.line}`, background: e.youLiked ? hexA(K.pink, 0.18) : "transparent", color: e.youLiked ? K.pink : K.muted, fontSize: 13, fontWeight: 700, cursor: canLike ? "pointer" : "default" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={e.youLiked ? K.pink : "none"} stroke="currentColor" strokeWidth="2.2"><path d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.3 3.2 4.5 7 4.5c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.8 0 5.9 3.8 4.5 7.2C19.5 16.4 12 21 12 21z" /></svg>
              J&apos;adore
            </button>
          )}
          {e.likes > 0 && <span style={{ fontFamily: MONO, fontSize: 12, color: K.pink }}>{plural(e.likes, "j'adore", "j'adore")}</span>}
        </div>
      )}
    </div>
  );
}

function ChainView({ room, g, chain, live }: { room: UseRoom; g: PhonePublic; chain: PhonePublicChain; live: boolean }) {
  const owner = g.players.find((p) => p.id === chain.ownerId);
  const endRef = useRef<HTMLDivElement | null>(null);
  const count = chain.entries.length;
  useEffect(() => {
    if (live) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [count, live]);
  const finished = count >= g.steps;
  const first = chain.entries[0]?.content ?? "";
  const lastText = [...chain.entries].reverse().find((e) => e.kind === "text" && e.step > 0);
  return (
    <section style={{ maxWidth: 620, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
        {owner && <Avatar name={owner.name} color={owner.color} avatar={owner.avatar} size={34} />}
        <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20 }}>La chaîne de {owner?.name ?? "?"}</span>
      </div>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 18, paddingLeft: 18, borderLeft: `2px dashed ${hexA(ACCENT, 0.35)}` }}>
        {chain.entries.map((e, i) => (
          <EntryCard key={i} room={room} g={g} chain={chain} e={e} live={live} isNew={live && i === count - 1} />
        ))}
      </div>
      {finished && lastText && first && (
        <div style={{ marginTop: 18, padding: "14px 16px", borderRadius: 18, border: `1px solid ${hexA(K.gold, 0.45)}`, background: hexA(K.gold, 0.08), textAlign: "center", animation: "sk-pop .5s ease-out both" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: K.gold, marginBottom: 6 }}>Avant / après</div>
          <div style={{ fontSize: 15 }}>« {first} »</div>
          <div style={{ color: K.faint, fontSize: 12, margin: "2px 0" }}>est devenu</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 18 }}>« {lastText.content || "…rien du tout"} »</div>
        </div>
      )}
      <div ref={endRef} />
    </section>
  );
}

/* ------------------------------------------------------------------ final */

function PhoneFinal({ room, g }: { room: UseRoom; g: PhonePublic }) {
  const [tab, setTab] = useState(0);
  const awards: { label: string; playerId: string; detail?: string }[] = [];
  const drawer = topOf(g.drawLikes);
  if (drawer) awards.push({ label: "Meilleur dessinateur", playerId: drawer, detail: plural(g.drawLikes![drawer], "j'adore", "j'adore") });
  const writer = topOf(g.textLikes);
  if (writer) awards.push({ label: "Plume d'or", playerId: writer, detail: plural(g.textLikes![writer], "j'adore", "j'adore") });
  const album = g.album ?? [];
  const chain = album[Math.min(tab, album.length - 1)];
  const roster = g.order.map((id) => g.players.find((p) => p.id === id)).filter(Boolean) as GamePlayer[];
  return (
    <SocialStage gameId="phone">
      <SocialFinal room={room} players={roster.length ? roster : g.players} scores={g.scores} awards={awards} />
      {chain && (
        <section style={{ marginTop: 28 }}>
          <h3 style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: K.faint, textAlign: "center", marginBottom: 10 }}>L&apos;album de la partie</h3>
          <div role="tablist" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginBottom: 18 }}>
            {album.map((c, i) => {
              const p = g.players.find((x) => x.id === c.ownerId);
              const on = i === tab;
              return (
                <button key={i} role="tab" aria-selected={on} onClick={() => setTab(i)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px 5px 5px", borderRadius: 999, border: `1px solid ${on ? ACCENT : K.line}`, background: on ? hexA(ACCENT, 0.14) : "rgb(var(--c-ink-surface) / .6)", color: K.text, cursor: "pointer", fontSize: 13 }}>
                  {p && <Avatar name={p.name} color={p.color} avatar={p.avatar} size={22} />}
                  {p?.name ?? "?"}
                </button>
              );
            })}
          </div>
          <ChainView room={room} g={g} chain={chain} live={false} />
        </section>
      )}
    </SocialStage>
  );
}
