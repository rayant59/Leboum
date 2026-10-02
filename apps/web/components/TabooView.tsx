"use client";

// « Mot interdit » — vue joueur : prêt → passage chronométré (cartes à la
// chaîne) → récap → joueur suivant → … → final.

import { useEffect, useRef, useState } from "react";
import type { TabooCard, TabooMessage, TabooPublic } from "@subtitles-party/shared";
import { TABOO_MSG_MAX } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { Avatar } from "@/components/Avatar";
import { playSound } from "@/lib/sound";
import { BODY, DISPLAY, Gain, HostSkip, K, MONO, SocialFinal, SocialHeader, SocialStage, StatusBar, hexA, plural, topOf, useCountdown } from "@/components/social/kit";

const ACCENT = "#8B7DF6";

export function TabooView({ room }: { room: UseRoom }) {
  const g = room.game as TabooPublic | null;
  const left = useCountdown(g && g.phase !== "final" ? g.deadline : null, room.serverNow);

  const prev = useRef<{ phase: string | null; played: number; found: number }>({ phase: null, played: 0, found: 0 });
  useEffect(() => {
    if (!g) return;
    const p = prev.current;
    if (g.phase === "turn" && p.phase !== "turn") playSound(g.giverId === room.you ? "yourTurn" : "start");
    if (g.phase === "turn" && g.foundCount > p.found) playSound("correct");
    else if (g.phase === "turn" && g.playedCount > p.played) playSound("wrong");
    if (g.phase === "recap" && p.phase === "turn") playSound("timeUp");
    if (g.phase === "final" && p.phase !== "final") playSound("fanfare");
    prev.current = { phase: g.phase, played: g.playedCount, found: g.foundCount };
  }, [g, room.you]);

  if (!g) return null;
  if (g.phase === "final") return <TabooFinal room={room} g={g} />;

  const giver = g.players.find((p) => p.id === g.giverId);
  const censor = g.players.find((p) => p.id === g.censorId);
  const isGiver = g.giverId === room.you;
  const isCensor = g.censorId === room.you;
  const label = g.phase === "ready" ? "Préparez-vous" : g.phase === "turn" ? (g.mode === "oral" ? "À voix haute" : "Indices écrits") : "Récap";

  return (
    <SocialStage gameId="taboo">
      <SocialHeader gameId="taboo" unit="Passage" round={g.turn} total={g.totalTurns} label={label} left={left} seconds={Math.round(g.phaseMs / 1000)} />

      {g.phase === "ready" && (
        <section style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center", marginTop: 10 }}>
          {giver && <span style={{ ["--a" as string]: ACCENT, borderRadius: 18, animation: "sk-glow 2.4s ease-in-out infinite" }}><Avatar name={giver.name} color={giver.color} avatar={giver.avatar} size={84} /></span>}
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26 }}>
            {isGiver ? <span style={{ color: ACCENT }}>À toi de faire deviner !</span> : <>Au tour de <span style={{ color: ACCENT }}>{giver?.name}</span> de faire deviner</>}
          </div>
          <p style={{ margin: 0, color: K.muted, maxWidth: 460 }}>
            {isGiver
              ? g.mode === "oral"
                ? `Parle à voix haute, sans jamais dire les mots interdits. ${censor ? `${censor.name} surveille ta carte et buzzera.` : ""}`
                : "Écris des indices : le serveur bloque tout indice qui contient un mot interdit (−50, carte perdue)."
              : isCensor
                ? "Tu es le censeur : tu verras la carte et tu buzzes au moindre mot interdit."
                : g.mode === "oral"
                  ? "Écoute bien et crie tes réponses !"
                  : "Tape tes réponses : le premier qui trouve marque +100."}
          </p>
          {isGiver && (
            <button className="arc arc-p" style={{ minWidth: 240 }} onClick={() => room.gameAction({ kind: "start" })}>
              C&apos;est parti !
            </button>
          )}
          <Scoreboard g={g} you={room.you} />
          {!isGiver && <HostSkip room={room} label={`Lancer pour ${giver?.name ?? "lui"}`} />}
        </section>
      )}

      {g.phase === "turn" && (
        <>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <Pill>{giver ? <><Avatar name={giver.name} color={giver.color} avatar={giver.avatar} size={20} /> {giver.name} fait deviner</> : null}</Pill>
            <Pill><b style={{ color: K.mint }}>{g.foundCount}</b>&nbsp;trouvé{g.foundCount > 1 ? "s" : ""}</Pill>
          </div>
          {g.card && <CardView card={g.card} censor={isCensor} />}
          {isGiver && g.mode === "ecrit" && <ClueBox room={room} />}
          {isGiver && g.mode === "oral" && <FoundGrid room={room} g={g} />}
          {isCensor && (
            <button className="arc arc-mag arc-block" style={{ maxWidth: 420, margin: "0 auto 14px", display: "flex", fontSize: 20 }} onClick={() => room.gameAction({ kind: "buzz" })}>
              BUZZ ! Mot interdit
            </button>
          )}
          {!isGiver && !isCensor && g.mode === "oral" && (
            <p style={{ textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, margin: "18px 0" }}>Écoute {giver?.name} et crie tes réponses !</p>
          )}
          {g.mode === "ecrit" && <Feed g={g} you={room.you} />}
          {!isGiver && g.mode === "ecrit" && <GuessBox room={room} />}
          <StatusBar>
            {isGiver ? (
              <button className="arc arc-sec" onClick={() => room.gameAction({ kind: "pass" })}>Passer cette carte</button>
            ) : (
              <span>Mot trouvé : <b style={{ color: K.mint }}>+100</b> pour toi et pour {giver?.name}</span>
            )}
            <HostSkip room={room} label="Fin du passage" />
          </StatusBar>
        </>
      )}

      {g.phase === "recap" && g.recap && <Recap room={room} g={g} />}
    </SocialStage>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, border: `1px solid ${K.line}`, background: "rgba(28,22,54,.7)", fontSize: 14 }}>{children}</span>;
}

/** La carte : le mot en grand, les mots interdits barrés en rouge. */
function CardView({ card, censor }: { card: TabooCard; censor: boolean }) {
  return (
    <section key={card.word} data-word={card.word} style={{ maxWidth: 380, margin: "0 auto 16px", borderRadius: 24, overflow: "hidden", border: `1px solid ${hexA(ACCENT, 0.55)}`, boxShadow: `0 24px 44px -26px ${hexA(ACCENT, 0.9)}`, animation: "sk-pop .35s ease-out both" }}>
      <div style={{ padding: "18px 18px 14px", background: `linear-gradient(160deg, ${hexA(ACCENT, 0.35)}, ${K.surface})`, textAlign: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: K.muted }}>{censor ? "Carte à surveiller" : "Fais deviner"}</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 34, letterSpacing: "-.01em", marginTop: 4 }}>{card.word}</div>
      </div>
      <div style={{ padding: "12px 18px 16px", background: K.ink, display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: K.danger }}>Interdit</div>
        {card.forbidden.map((f) => (
          <span key={f} style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 18, color: "#FFB3B3", textDecoration: "line-through", textDecorationColor: hexA(K.danger, 0.8), textDecorationThickness: 2 }}>{f}</span>
        ))}
      </div>
    </section>
  );
}

function ClueBox({ room }: { room: UseRoom }) {
  const [draft, setDraft] = useState("");
  const err = room.error?.code === "forbidden_word" ? room.error.message : null;
  useEffect(() => {
    if (!err) return;
    playSound("wrong");
    const id = window.setTimeout(() => room.clearError(), 2500);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [err]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = draft.trim();
        if (!t) return;
        room.gameAction({ kind: "clue", text: t });
        setDraft("");
      }}
      style={{ maxWidth: 560, margin: "0 auto 12px" }}
    >
      <div style={{ display: "flex", gap: 10 }}>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, TABOO_MSG_MAX))}
          placeholder="Ton indice (sans les mots interdits !)"
          aria-label="Ton indice"
          style={{ flex: 1, minWidth: 0, padding: "14px 16px", borderRadius: 14, border: `1px solid ${hexA(ACCENT, 0.55)}`, background: K.ink, color: K.text, fontSize: 17, fontFamily: BODY, outline: "none" }}
        />
        <button type="submit" className="arc arc-p" disabled={!draft.trim()} style={{ opacity: draft.trim() ? 1 : 0.5 }}>Envoyer</button>
      </div>
      {err && <p style={{ margin: "8px 0 0", textAlign: "center", color: K.danger, fontWeight: 700, animation: "sk-wiggle .3s ease-in-out 2" }}>{err}</p>}
    </form>
  );
}

function GuessBox({ room }: { room: UseRoom }) {
  const [draft, setDraft] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = draft.trim();
        if (!t) return;
        room.gameAction({ kind: "guess", text: t });
        setDraft("");
      }}
      style={{ display: "flex", gap: 10, maxWidth: 560, margin: "12px auto 0" }}
    >
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, TABOO_MSG_MAX))}
        placeholder="Ta réponse…"
        aria-label="Ta réponse"
        style={{ flex: 1, minWidth: 0, padding: "14px 16px", borderRadius: 14, border: `1px solid ${hexA(K.mint, 0.5)}`, background: K.ink, color: K.text, fontSize: 17, fontFamily: BODY, outline: "none" }}
      />
      <button type="submit" className="arc arc-ready" disabled={!draft.trim()} style={{ opacity: draft.trim() ? 1 : 0.5 }}>Proposer</button>
    </form>
  );
}

/** Fil des indices et propositions (mode écrit). */
function Feed({ g, you }: { g: TabooPublic; you: string }) {
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [g.log.length]);
  const nameOf = (id: string) => g.players.find((p) => p.id === id)?.name ?? "";
  return (
    <div ref={box} style={{ maxWidth: 560, margin: "0 auto", maxHeight: 280, minHeight: 120, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, padding: 12, borderRadius: 18, border: `1px solid ${K.line}`, background: "rgba(14,11,26,.6)" }}>
      {g.log.length === 0 && <p style={{ margin: "auto", color: K.faint, fontSize: 14 }}>Les indices vont apparaître ici…</p>}
      {g.log.map((m: TabooMessage) =>
        m.kind === "system" ? (
          <div key={m.id} style={{ alignSelf: "center", padding: "4px 12px", borderRadius: 999, background: m.text.includes("trouvé") ? hexA(K.mint, 0.16) : hexA(K.danger, 0.16), color: m.text.includes("trouvé") ? K.mint : "#FFB3B3", fontSize: 13, fontWeight: 700, animation: "sk-pop .3s ease-out both" }}>{m.text}</div>
        ) : m.kind === "clue" ? (
          <div key={m.id} style={{ alignSelf: "flex-start", maxWidth: "85%", padding: "8px 14px", borderRadius: "4px 16px 16px 16px", background: hexA(ACCENT, 0.22), border: `1px solid ${hexA(ACCENT, 0.45)}`, fontFamily: DISPLAY, fontWeight: 700, fontSize: 16 }}>{m.text}</div>
        ) : (
          <div key={m.id} style={{ alignSelf: "flex-end", maxWidth: "85%", fontSize: 14, color: K.muted }}>
            <span style={{ color: K.faint }}>{m.from === you ? "toi" : nameOf(m.from)} :</span> {m.text}
          </div>
        ),
      )}
    </div>
  );
}

/** Mode oral : le donneur touche celui qui a trouvé. */
function FoundGrid({ room, g }: { room: UseRoom; g: TabooPublic }) {
  const finders = g.players.filter((p) => p.id !== g.giverId && p.id !== g.censorId && g.order.includes(p.id));
  return (
    <section style={{ maxWidth: 560, margin: "0 auto 12px", textAlign: "center" }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: K.faint, marginBottom: 8 }}>Trouvé par…</div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
        {finders.map((p) => (
          <button key={p.id} className="sk-card" onClick={() => room.gameAction({ kind: "found", finderId: p.id })} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px 8px 8px", borderRadius: 999, border: `1px solid ${hexA(K.mint, 0.5)}`, background: hexA(K.mint, 0.1), color: K.text, cursor: "pointer", fontFamily: DISPLAY, fontWeight: 700 }}>
            <Avatar name={p.name} color={p.color} avatar={p.avatar} size={28} /> {p.name}
          </button>
        ))}
      </div>
    </section>
  );
}

const OUTCOME: Record<string, { label: string; color: string }> = {
  found: { label: "trouvé", color: K.mint },
  passed: { label: "passé", color: K.faint },
  forbidden: { label: "mot interdit", color: K.danger },
};

function Recap({ room, g }: { room: UseRoom; g: TabooPublic }) {
  const r = g.recap!;
  const giver = g.players.find((p) => p.id === r.giverId);
  const found = r.played.filter((p) => p.outcome === "found").length;
  return (
    <section style={{ maxWidth: 560, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26 }}>
          {giver?.name} : <span style={{ color: found ? K.mint : K.muted }}>{plural(found, "mot trouvé", "mots trouvés")}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {r.played.length === 0 && <p style={{ textAlign: "center", color: K.faint }}>Aucune carte jouée…</p>}
        {r.played.map((p, i) => {
          const o = OUTCOME[p.outcome];
          const finder = p.finderId ? g.players.find((x) => x.id === p.finderId) : null;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 14, border: `1px solid ${K.line}`, background: "rgba(28,22,54,.6)", animation: `sk-rise .3s ease-out ${(i * 0.05).toFixed(2)}s both` }}>
              <span style={{ flex: 1, fontFamily: DISPLAY, fontWeight: 700, fontSize: 16 }}>{p.card.word}</span>
              {finder && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: K.muted }}><Avatar name={finder.name} color={finder.color} avatar={finder.avatar} size={20} /> {finder.name}</span>}
              {p.culprit && <span style={{ fontSize: 12, color: K.faint }}>« {p.culprit} »</span>}
              <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: o.color }}>{o.label}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 14 }}>
        {Object.entries(r.gained).filter(([, v]) => v !== 0).map(([id, v]) => {
          const p = g.players.find((x) => x.id === id);
          return p ? (
            <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <Avatar name={p.name} color={p.color} avatar={p.avatar} size={22} /> {p.name} {v > 0 ? <Gain value={v} /> : <span style={{ color: K.danger, fontFamily: MONO, fontWeight: 700 }}>{v}</span>}
            </span>
          ) : null;
        })}
      </div>
      <StatusBar>
        <span>Prochain passage dans un instant…</span>
        <HostSkip room={room} label="Suivant" />
      </StatusBar>
    </section>
  );
}

/** Mini-classement (écran « prêt »). */
function Scoreboard({ g, you }: { g: TabooPublic; you: string }) {
  const rows = g.players.slice().sort((a, b) => (g.scores[b.id] ?? 0) - (g.scores[a.id] ?? 0));
  if (rows.every((p) => !g.scores[p.id])) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 8 }}>
      {rows.map((p) => (
        <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 4px", borderRadius: 999, border: `1px solid ${K.line}`, fontSize: 13 }}>
          <Avatar name={p.name} color={p.color} avatar={p.avatar} size={22} /> {p.name}{p.id === you ? " (toi)" : ""} · <b>{g.scores[p.id] ?? 0}</b>
        </span>
      ))}
    </div>
  );
}

function TabooFinal({ room, g }: { room: UseRoom; g: TabooPublic }) {
  const awards: { label: string; playerId: string; detail?: string }[] = [];
  const orator = topOf(g.cardsGiven);
  if (orator) awards.push({ label: "Langue bien pendue", playerId: orator, detail: `${plural(g.cardsGiven![orator], "mot")} fait${g.cardsGiven![orator] > 1 ? "s" : ""} deviner` });
  const finder = topOf(g.cardsFound);
  if (finder) awards.push({ label: "Devin", playerId: finder, detail: `${plural(g.cardsFound![finder], "mot")} trouvé${g.cardsFound![finder] > 1 ? "s" : ""}` });
  return (
    <SocialStage gameId="taboo">
      <SocialFinal room={room} players={g.players} scores={g.scores} awards={awards} />
    </SocialStage>
  );
}
