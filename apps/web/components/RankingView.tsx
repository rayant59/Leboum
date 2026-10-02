"use client";

// « Le Top » — vue joueur : range les 5 éléments (▲ ▼ ou touche deux cartes
// pour les échanger), valide, puis découvre le bon ordre.

import { useEffect, useRef, useState } from "react";
import type { RankingPublic } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { Avatar } from "@/components/Avatar";
import { playSound } from "@/lib/sound";
import { DISPLAY, Gain, HostSkip, K, MONO, SocialFinal, SocialHeader, SocialStage, StatusBar, hexA, plural, topOf, useCountdown } from "@/components/social/kit";

const ACCENT = "#FFC24B";

export function RankingView({ room }: { room: UseRoom }) {
  const g = room.game as RankingPublic | null;
  const left = useCountdown(g && g.phase !== "final" ? g.deadline : null, room.serverNow);

  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (!g) return;
    if (g.phase === "reveal" && prev.current !== "reveal") playSound((g.gained?.[room.you] ?? 0) >= 400 ? "correct" : "reveal");
    if (g.phase === "final" && prev.current !== "final") playSound("fanfare");
    prev.current = g.phase;
  }, [g, room.you]);

  if (!g) return null;
  if (g.phase === "final") return <RankingFinal room={room} g={g} />;

  return (
    <SocialStage gameId="ranking">
      <SocialHeader gameId="ranking" round={g.round} total={g.totalRounds} label={g.mode === "table" ? "Comme la table" : "Le bon ordre"} left={left} seconds={Math.round(g.phaseMs / 1000)} />
      <div style={{ textAlign: "center", margin: "0 0 14px" }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: K.faint }}>{g.mode === "table" ? "Classe comme le ferait la table" : "Classe"}</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "clamp(22px, 4.4vw, 30px)", lineHeight: 1.2 }}>{g.title}</div>
      </div>
      {g.phase === "order" ? <OrderBoard key={g.round} room={room} g={g} /> : <Reveal room={room} g={g} />}
    </SocialStage>
  );
}

function EndLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: ACCENT, textAlign: "center", margin: "6px 0" }}>{children}</div>;
}

function OrderBoard({ room, g }: { room: UseRoom; g: RankingPublic }) {
  const [order, setOrder] = useState<number[]>(() => g.yourOrder ?? g.shuffled);
  const [picked, setPicked] = useState<number | null>(null);
  const [dirty, setDirty] = useState(g.yourOrder == null);
  const submitted = g.submittedIds.includes(room.you);
  const playing = g.players.some((p) => p.id === room.you);

  const move = (pos: number, delta: number) => {
    const to = pos + delta;
    if (to < 0 || to >= order.length) return;
    const next = order.slice();
    [next[pos], next[to]] = [next[to], next[pos]];
    setOrder(next);
    setDirty(true);
    setPicked(null);
    playSound("click");
  };
  const tap = (pos: number) => {
    if (picked == null) return setPicked(pos);
    if (picked === pos) return setPicked(null);
    const next = order.slice();
    [next[picked], next[pos]] = [next[pos], next[picked]];
    setOrder(next);
    setDirty(true);
    setPicked(null);
    playSound("click");
  };
  const send = () => {
    room.gameAction({ kind: "order", order });
    setDirty(false);
    playSound("vote");
  };

  // Envoi automatique juste avant la fin si le joueur n'a pas validé sa dernière version.
  const latest = useRef({ order, dirty });
  latest.current = { order, dirty };
  useEffect(() => {
    if (g.deadline == null || !playing) return;
    const id = window.setInterval(() => {
      if (g.deadline! - room.serverNow() > 700) return;
      window.clearInterval(id);
      if (latest.current.dirty) room.gameAction({ kind: "order", order: latest.current.order });
    }, 150);
    return () => window.clearInterval(id);
  }, [g.deadline, playing, room]);

  return (
    <section style={{ maxWidth: 520, margin: "0 auto" }}>
      <EndLabel>▲ {g.top}</EndLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {order.map((item, pos) => {
          const sel = picked === pos;
          return (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px 10px 14px", borderRadius: 16, border: `1px solid ${sel ? ACCENT : K.line}`, background: sel ? hexA(ACCENT, 0.14) : "rgba(28,22,54,.7)", transition: "background .15s, border-color .15s" }}>
              <span style={{ width: 26, height: 26, display: "grid", placeItems: "center", borderRadius: 999, background: hexA(ACCENT, 0.18), color: ACCENT, fontFamily: DISPLAY, fontWeight: 800, fontSize: 14, flex: "none" }}>{pos + 1}</span>
              <button onClick={() => tap(pos)} disabled={!playing} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", color: K.text, fontFamily: DISPLAY, fontWeight: 700, fontSize: 17, cursor: "pointer", padding: "4px 0" }}>
                {g.items[item]?.label}
              </button>
              <div style={{ display: "flex", gap: 4, flex: "none" }}>
                <button aria-label="Monter" onClick={() => move(pos, -1)} disabled={!playing || pos === 0} style={arrow(pos === 0)}>▲</button>
                <button aria-label="Descendre" onClick={() => move(pos, 1)} disabled={!playing || pos === order.length - 1} style={arrow(pos === order.length - 1)}>▼</button>
              </div>
            </div>
          );
        })}
      </div>
      <EndLabel>▼ {g.bottom}</EndLabel>
      {playing ? (
        <button className={`arc ${submitted && !dirty ? "arc-sec" : "arc-p"} arc-block`} style={{ marginTop: 10 }} onClick={send} disabled={submitted && !dirty}>
          {submitted ? (dirty ? "Mettre à jour mon classement" : "Classement envoyé ✓") : "Valider mon classement"}
        </button>
      ) : (
        <p style={{ textAlign: "center", color: K.muted }}>Tu regardes cette manche.</p>
      )}
      <p style={{ textAlign: "center", color: K.faint, fontSize: 13, margin: "8px 0 0" }}>Astuce : touche deux éléments pour les échanger.</p>
      <StatusBar>
        <span><b style={{ color: K.text }}>{g.submittedIds.length}</b>/{g.players.length} ont validé</span>
        <HostSkip room={room} label="Révéler" />
      </StatusBar>
    </section>
  );
}

function arrow(disabled: boolean): React.CSSProperties {
  return { width: 36, height: 36, borderRadius: 10, border: `1px solid ${K.line}`, background: K.raised, color: disabled ? K.faint : K.text, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1, fontSize: 13 };
}

function Reveal({ room, g }: { room: UseRoom; g: RankingPublic }) {
  const expected = g.expected ?? [];
  const mine = g.orders?.[room.you] ?? null;
  const ranked = g.players
    .filter((p) => g.gained && g.gained[p.id] != null)
    .sort((a, b) => (g.gained![b.id] ?? 0) - (g.gained![a.id] ?? 0));
  return (
    <section style={{ maxWidth: 560, margin: "0 auto" }}>
      <EndLabel>▲ {g.top}</EndLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {expected.map((item, pos) => {
          const myPos = mine ? mine.indexOf(item) : -1;
          const d = myPos < 0 ? null : Math.abs(myPos - pos);
          const badge = d == null ? null : d === 0 ? { t: "✓ pile", c: K.mint } : d === 1 ? { t: "à 1 place", c: K.gold } : { t: `à ${d} places`, c: K.faint };
          return (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 16, border: `1px solid ${d === 0 ? hexA(K.mint, 0.6) : K.line}`, background: d === 0 ? hexA(K.mint, 0.1) : "rgba(28,22,54,.7)", animation: `sk-rise .35s ease-out ${(pos * 0.12).toFixed(2)}s both` }}>
              <span style={{ width: 26, height: 26, display: "grid", placeItems: "center", borderRadius: 999, background: hexA(ACCENT, 0.18), color: ACCENT, fontFamily: DISPLAY, fontWeight: 800, fontSize: 14, flex: "none" }}>{pos + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 17 }}>{g.items[item]?.label}</div>
                {g.items[item]?.value && <div style={{ fontFamily: MONO, fontSize: 12, color: K.muted }}>{g.items[item].value}</div>}
              </div>
              {badge && <span style={{ fontFamily: MONO, fontSize: 11, color: badge.c, whiteSpace: "nowrap" }}>{badge.t}</span>}
            </div>
          );
        })}
      </div>
      <EndLabel>▼ {g.bottom}</EndLabel>
      {g.mode === "table" && <p style={{ textAlign: "center", color: K.faint, fontSize: 13, margin: "0 0 8px" }}>Le classement moyen de la table.</p>}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 10 }}>
        {ranked.length === 0 && <span style={{ color: K.faint }}>Personne n&apos;a marqué cette manche.</span>}
        {ranked.map((p) => (
          <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14 }}>
            <Avatar name={p.name} color={p.color} avatar={p.avatar} size={22} /> {p.name}{p.id === room.you ? " (toi)" : ""} <Gain value={g.gained![p.id]} />
          </span>
        ))}
      </div>
      <StatusBar>
        <span>Bonne place <b style={{ color: K.mint }}>+100</b> · à une place <b style={{ color: K.gold }}>+50</b> · sans faute <b style={{ color: K.mint }}>+100</b></span>
        <HostSkip room={room} label={g.round >= g.totalRounds ? "Résultats" : "Suivant"} />
      </StatusBar>
    </section>
  );
}

function RankingFinal({ room, g }: { room: UseRoom; g: RankingPublic }) {
  const awards: { label: string; playerId: string; detail?: string }[] = [];
  const ace = topOf(g.perfects);
  if (ace) awards.push({ label: "Sans faute", playerId: ace, detail: plural(g.perfects![ace], "classement parfait", "classements parfaits") });
  return (
    <SocialStage gameId="ranking">
      <SocialFinal room={room} players={g.players} scores={g.scores} awards={awards} />
    </SocialStage>
  );
}
