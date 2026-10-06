"use client";

// « Qui de nous ? » — vue joueur : question → vote → révélation → final.

import { useEffect, useRef } from "react";
import type { WhoisPublic } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { Avatar } from "@/components/Avatar";
import { playSound } from "@/lib/sound";
import { DISPLAY, Gain, nbsp, HostSkip, K, MONO, PlayerGrid, plural, PromptCard, SocialFinal, SocialHeader, SocialStage, StatusBar, hexA, topOf, useCountdown } from "@/components/social/kit";

const ACCENT = "rgb(var(--c-gold))";

export function WhoisView({ room }: { room: UseRoom }) {
  const g = room.game as WhoisPublic | null;
  const left = useCountdown(g?.phase === "question" ? g.deadline : null, room.serverNow);

  // Sons : vote envoyé, révélation.
  const prevPhase = useRef<string | null>(null);
  useEffect(() => {
    if (!g) return;
    if (prevPhase.current === "question" && g.phase === "reveal") playSound("reveal");
    if (g.phase === "final" && prevPhase.current !== "final") playSound("fanfare");
    prevPhase.current = g.phase;
  }, [g]);

  if (!g) return null;

  if (g.phase === "final") {
    const awards: { label: string; playerId: string; detail?: string }[] = [];
    const star = topOf(g.timesElected);
    if (star) awards.push({ label: "La vedette", playerId: star, detail: `élu·e ${g.timesElected![star]} fois` });
    const mind = topOf(g.majorityVotes);
    if (mind) awards.push({ label: "Télépathe", playerId: mind, detail: `${plural(g.majorityVotes![mind], "vote")} dans le mille` });
    return (
      <SocialStage gameId="whois">
        <SocialFinal room={room} players={g.players} scores={g.scores} awards={awards} />
        {g.history && g.history.length > 0 && (
          <section style={{ maxWidth: 560, margin: "26px auto 0" }}>
            <h3 style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: K.faint, textAlign: "center", marginBottom: 10 }}>Le best-of</h3>
            <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {g.history.map((h, i) => (
                <li key={i} style={{ padding: "10px 14px", borderRadius: 14, border: `1px solid ${K.line}`, background: "rgb(var(--c-ink-surface) / .55)", fontSize: 14, color: K.muted }}>
                  Qui de nous {h.question}{" "}
                  <b style={{ color: K.text }}>{h.elected.length ? h.elected.map((id) => g.players.find((p) => p.id === id)?.name ?? "?").join(" & ") : "personne"}</b>
                </li>
              ))}
            </ol>
          </section>
        )}
      </SocialStage>
    );
  }

  const me = g.players.find((p) => p.id === room.you);
  const voted = g.yourVote != null;
  const revealed = g.phase === "reveal";
  const tally = g.tally ?? {};
  const maxVotes = Math.max(1, ...Object.values(tally));
  const playersSorted = revealed ? g.players.slice().sort((a, b) => (tally[b.id] ?? 0) - (tally[a.id] ?? 0)) : g.players;

  return (
    <SocialStage gameId="whois">
      <SocialHeader gameId="whois" round={g.round} total={g.totalRounds} label={g.categoryLabel} left={left} seconds={g.seconds} />
      <PromptCard eyebrow="Qui de nous…" accent={ACCENT}>
        {nbsp(g.question?.text ?? "")}
      </PromptCard>

      {!revealed ? (
        <>
          <p style={{ textAlign: "center", margin: "0 0 14px", color: K.muted, fontSize: 14 }}>
            {!me ? "Tu regardes cette manche." : voted ? "Vote enregistré ! On attend les autres…" : "Vote pour la personne qui correspond le mieux. Pas toi !"}
          </p>
          <PlayerGrid
            players={g.players}
            you={room.you}
            accent={ACCENT}
            selected={g.yourVote}
            disabledIds={me && !voted ? [room.you] : g.players.map((p) => p.id)}
            onPick={me && !voted ? (id) => { playSound("vote"); room.gameAction({ kind: "vote", targetId: id }); } : undefined}
            badge={(p) => (g.votedIds.includes(p.id) ? <span title="A voté" style={{ display: "grid", placeItems: "center", width: 22, height: 22, borderRadius: 999, background: hexA(K.mint, 0.2), color: K.mint, fontSize: 12, fontWeight: 800 }}>✓</span> : null)}
          />
          <StatusBar>
            <span><b style={{ color: K.text }}>{g.votedIds.length}</b>/{g.players.length} ont voté</span>
            <HostSkip room={room} label="Révéler" />
          </StatusBar>
        </>
      ) : (
        <>
          <p style={{ textAlign: "center", margin: "0 0 14px", fontFamily: DISPLAY, fontWeight: 800, fontSize: 20 }}>
            {g.elected.length === 0
              ? "Personne n'a voté cette fois…"
              : g.elected.length === 1
                ? <>La table a parlé : <span style={{ color: ACCENT }}>{nameOf(g, g.elected[0])}</span> !</>
                : <>Égalité : <span style={{ color: ACCENT }}>{g.elected.map((id) => nameOf(g, id)).join(" & ")}</span></>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {playersSorted.map((p, i) => {
              const n = tally[p.id] ?? 0;
              const elected = g.elected.includes(p.id);
              const voters = Object.entries(g.votes ?? {}).filter(([, t]) => t === p.id).map(([v]) => g.players.find((x) => x.id === v)).filter(Boolean);
              return (
                <div key={p.id} style={{ ["--a" as string]: ACCENT, position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 18, border: `1px solid ${elected ? ACCENT : K.line}`, background: elected ? `linear-gradient(90deg, ${hexA(ACCENT, 0.18)}, rgb(var(--c-ink-surface) / .7))` : "rgb(var(--c-ink-surface) / .6)", animation: `sk-rise .35s ease-out ${(i * 0.08).toFixed(2)}s both${elected ? ", sk-glow 2.4s ease-in-out infinite" : ""}` }}>
                  <Avatar name={p.name} color={p.color} avatar={p.avatar} size={42} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: DISPLAY, fontWeight: 700, fontSize: 16 }}>
                      {p.name}{p.id === room.you ? <span style={{ color: K.faint, fontWeight: 500 }}>(toi)</span> : null}
                      <Gain value={g.gained?.[p.id] ?? 0} />
                    </div>
                    <div style={{ marginTop: 6, height: 8, borderRadius: 999, background: K.raised, overflow: "hidden" }}>
                      <div style={{ width: `${(n / maxVotes) * 100}%`, height: "100%", borderRadius: 999, background: elected ? ACCENT : K.violet, transition: "width .8s cubic-bezier(.2,.9,.3,1)" }} />
                    </div>
                    {voters.length > 0 && (
                      <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                        {voters.map((v) => v && <Avatar key={v.id} name={v.name} color={v.color} avatar={v.avatar} size={20} />)}
                      </div>
                    )}
                  </div>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, color: elected ? ACCENT : K.muted }}>{n}</span>
                </div>
              );
            })}
          </div>
          <StatusBar>
            <span>Voter comme la majorité : <b style={{ color: K.mint }}>+100</b> · être élu·e : <b style={{ color: ACCENT }}>+50</b></span>
            <HostSkip room={room} label="Question suivante" />
          </StatusBar>
        </>
      )}
    </SocialStage>
  );
}

function nameOf(g: WhoisPublic, id: string) {
  return g.players.find((p) => p.id === id)?.name ?? "?";
}

