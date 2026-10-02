"use client";

// « La Plus Drôle » — écriture → lecture anonyme → vote → résultats → final.

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { FunnyPublic } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { useAutoSubmit } from "@/lib/useAutoSubmit";
import { Avatar } from "@/components/Avatar";
import { playSound } from "@/lib/sound";
import { BODY, DISPLAY, Gain, HostSkip, K, MONO, PromptCard, SocialFinal, SocialHeader, SocialStage, StatusBar, hexA, topOf, nbsp, useCountdown } from "@/components/social/kit";

const ACCENT = "#FF4D8D";

/** Affiche la phrase avec le trou souligné (ou rempli par une réponse). */
function PromptText({ prompt, fill }: { prompt: string; fill?: string | null }) {
  const [before, after = ""] = nbsp(prompt).split("___");
  const hole: ReactNode = fill ? (
    <span style={{ color: ACCENT }}>{fill}</span>
  ) : (
    <span aria-label="trou" style={{ display: "inline-block", minWidth: 90, borderBottom: `4px solid ${ACCENT}`, transform: "translateY(-4px)" }}>&nbsp;</span>
  );
  return <>{before}{hole}{after}</>;
}

export function FunnyView({ room }: { room: UseRoom }) {
  const g = room.game as FunnyPublic | null;
  const left = useCountdown(g && g.phase !== "final" ? g.deadline : null, room.serverNow);
  const [draft, setDraft] = useState("");
  const roundKey = g ? `${g.round}` : "0";

  // Nouvelle manche : brouillon vide.
  useEffect(() => setDraft(""), [roundKey]);

  // Sons de phase.
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (!g) return;
    if (prev.current && prev.current !== g.phase) {
      if (g.phase === "reveal") playSound("reveal");
      if (g.phase === "vote") playSound("yourTurn");
      if (g.phase === "results") playSound("chime");
      if (g.phase === "final") playSound("fanfare");
    }
    prev.current = g.phase;
  }, [g]);

  const me = g?.players.find((p) => p.id === room.you);
  const submit = (text: string) => {
    const t = text.trim();
    if (!t) return;
    room.gameAction({ kind: "answer", text: t });
    playSound("click");
  };
  // Le brouillon non validé part tout seul juste avant la fin du chrono.
  useAutoSubmit({ key: roundKey, active: !!g && g.phase === "write" && !!me && draft.trim() !== (g.yourAnswer ?? ""), deadline: g?.deadline ?? null, now: room.serverNow, text: draft, submit });

  if (!g) return null;

  if (g.phase === "final") {
    const awards: { label: string; playerId: string; detail?: string }[] = [];
    const pen = topOf(g.votesReceived);
    if (pen) awards.push({ label: "Plume d'or", playerId: pen, detail: `${g.votesReceived![pen]} votes` });
    const champ = topOf(g.roundWins);
    if (champ && champ !== pen) awards.push({ label: "Roi des manches", playerId: champ, detail: `${g.roundWins![champ]} manches` });
    return (
      <SocialStage gameId="funny">
        <SocialFinal room={room} players={g.players} scores={g.scores} awards={awards} />
        {g.best && g.best.length > 0 && (
          <section style={{ maxWidth: 600, margin: "26px auto 0" }}>
            <h3 style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: K.faint, textAlign: "center", marginBottom: 10 }}>Le best-of des réponses</h3>
            <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {g.best.map((b, i) => {
                const p = g.players.find((x) => x.id === b.authorId);
                return (
                  <li key={i} style={{ padding: "12px 14px", borderRadius: 16, border: `1px solid ${K.line}`, background: "rgba(28,22,54,.6)" }}>
                    <div style={{ fontSize: 13, color: K.muted, marginBottom: 4 }}><PromptText prompt={b.prompt} /></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {p && <Avatar name={p.name} color={p.color} avatar={p.avatar} size={26} />}
                      <span style={{ flex: 1, fontFamily: DISPLAY, fontWeight: 700, fontSize: 16 }}>« {b.text} »</span>
                      <span style={{ fontFamily: MONO, fontSize: 12, color: ACCENT }}>{b.votes} vote{b.votes > 1 ? "s" : ""}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </SocialStage>
    );
  }

  const phaseLabel = { write: "Écris ta réponse", reveal: "Lecture", vote: "Vote", results: "Résultats" }[g.phase];

  return (
    <SocialStage gameId="funny">
      <SocialHeader gameId="funny" round={g.round} total={g.totalRounds} label={phaseLabel} left={left} seconds={g.phaseSeconds} />
      <PromptCard eyebrow="Complète la phrase" accent={ACCENT}>
        <PromptText prompt={g.prompt} fill={g.phase === "write" ? (g.yourAnswer ?? null) : g.phase === "results" ? (g.results?.find((r) => r.winner)?.text ?? null) : null} />
      </PromptCard>

      {g.phase === "write" && (
        me ? (
          <form
            onSubmit={(e) => { e.preventDefault(); submit(draft); }}
            style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 620, margin: "0 auto" }}
          >
            <div style={{ position: "relative" }}>
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, g.maxChars))}
                maxLength={g.maxChars}
                placeholder="Ta réponse la plus drôle…"
                aria-label="Ta réponse"
                style={{ width: "100%", boxSizing: "border-box", padding: "16px 64px 16px 18px", borderRadius: 16, border: `1px solid ${hexA(ACCENT, 0.5)}`, background: K.ink, color: K.text, fontSize: 18, fontFamily: BODY, outline: "none" }}
              />
              <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontFamily: MONO, fontSize: 12, color: draft.length > g.maxChars - 10 ? K.danger : K.faint }}>{g.maxChars - draft.length}</span>
            </div>
            <button type="submit" className="arc arc-mag arc-block" disabled={!draft.trim()} style={{ opacity: draft.trim() ? 1 : 0.5 }}>
              {g.yourAnswer ? "Modifier ma réponse" : "Envoyer"}
            </button>
            {g.yourAnswer && <p style={{ margin: 0, textAlign: "center", color: K.mint, fontSize: 14 }}>Réponse envoyée ! Tu peux encore la modifier tant que le chrono tourne.</p>}
          </form>
        ) : (
          <p style={{ textAlign: "center", color: K.muted }}>Tu regardes cette manche — tu joueras à la suivante.</p>
        )
      )}

      {(g.phase === "reveal" || g.phase === "vote") && g.answers && (
        <>
          <p style={{ textAlign: "center", margin: "0 0 14px", color: K.muted, fontSize: 14 }}>
            {g.phase === "reveal"
              ? "Lisez bien… le vote arrive !"
              : !me ? "Le vote est en cours." : g.yourVote ? "Vote enregistré ! On attend les autres…" : "Touche la réponse la plus drôle (pas la tienne)."}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {g.answers.map((a, i) => {
              const mine = a.token === g.yourToken;
              const picked = g.yourVote === a.token;
              const canVote = g.phase === "vote" && !!me && !g.yourVote && !mine;
              return (
                <button
                  key={a.token}
                  className="sk-card"
                  disabled={!canVote}
                  onClick={() => { playSound("vote"); room.gameAction({ kind: "vote", token: a.token }); }}
                  style={{ position: "relative", textAlign: "left", padding: "18px 16px", borderRadius: 18, border: `1px solid ${picked ? ACCENT : K.line}`, background: picked ? `linear-gradient(160deg, ${hexA(ACCENT, 0.22)}, rgba(28,22,54,.85))` : "rgba(28,22,54,.72)", color: K.text, cursor: canVote ? "pointer" : "default", fontFamily: DISPLAY, fontWeight: 700, fontSize: 18, lineHeight: 1.3, animation: `sk-rise .35s ease-out ${(i * 0.12).toFixed(2)}s both`, opacity: g.phase === "vote" && mine ? 0.6 : 1 }}
                >
                  « {a.text} »
                  {mine && <span style={{ display: "block", marginTop: 8, fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: K.faint }}>Ta réponse</span>}
                </button>
              );
            })}
          </div>
          <StatusBar>
            {g.phase === "vote" ? <span><b style={{ color: K.text }}>{g.votedIds.length}</b> vote{g.votedIds.length > 1 ? "s" : ""}</span> : <span>{g.answers.length} réponses</span>}
            <HostSkip room={room} label={g.phase === "reveal" ? "Passer au vote" : "Résultats"} />
          </StatusBar>
        </>
      )}

      {g.phase === "write" && (
        <StatusBar>
          <span><b style={{ color: K.text }}>{g.submittedIds.length}</b>/{g.players.length} ont répondu</span>
          <HostSkip room={room} label="Fin de l'écriture" />
        </StatusBar>
      )}

      {g.phase === "results" && g.results && (
        <>
          {g.results.length === 0 ? (
            <p style={{ textAlign: "center", color: K.muted }}>Personne n'a répondu cette fois…</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {g.results.map((r, i) => {
                const p = g.players.find((x) => x.id === r.authorId);
                return (
                  <div key={r.token} style={{ ["--a" as string]: ACCENT, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 18, border: `1px solid ${r.winner ? ACCENT : K.line}`, background: r.winner ? `linear-gradient(90deg, ${hexA(ACCENT, 0.18)}, rgba(28,22,54,.7))` : "rgba(28,22,54,.6)", animation: `sk-rise .35s ease-out ${(i * 0.1).toFixed(2)}s both${r.winner ? ", sk-glow 2.4s ease-in-out infinite" : ""}` }}>
                    {p && <Avatar name={p.name} color={p.color} avatar={p.avatar} size={40} />}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 17, lineHeight: 1.3 }}>« {r.text} »</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, fontSize: 13, color: K.muted }}>
                        {p?.name ?? "?"}{r.authorId === room.you ? " (toi)" : ""} <Gain value={r.gained} />
                        <span style={{ display: "inline-flex", gap: 3 }}>
                          {r.voters.map((v) => { const vp = g.players.find((x) => x.id === v); return vp ? <Avatar key={v} name={vp.name} color={vp.color} avatar={vp.avatar} size={18} /> : null; })}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, color: r.winner ? ACCENT : K.muted }}>{r.votes}</span>
                  </div>
                );
              })}
            </div>
          )}
          <StatusBar>
            <span>+100 par vote · la plus drôle : <b style={{ color: ACCENT }}>+50</b></span>
            <HostSkip room={room} label={g.round >= g.totalRounds ? "Classement" : "Manche suivante"} />
          </StatusBar>
        </>
      )}
    </SocialStage>
  );
}

