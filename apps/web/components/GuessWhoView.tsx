"use client";

// « Devine qui » — vue joueur : le Maître du secret répond oui / non, la
// table enquête et propose. Stock de questions commun + chrono.

import { useEffect, useRef, useState } from "react";
import type { GuessWhoAnswer, GuessWhoPublic, GuessWhoQuestion } from "@subtitles-party/shared";
import { GUESSWHO_TEXT_MAX } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { Avatar } from "@/components/Avatar";
import { playSound } from "@/lib/sound";
import { BODY, DISPLAY, Gain, HostSkip, K, MONO, SocialFinal, SocialHeader, SocialStage, StatusBar, hexA, plural, topOf, useCountdown } from "@/components/social/kit";

const ACCENT = "#4CC9F0";

const ANSWER: Record<GuessWhoAnswer, { label: string; color: string }> = {
  oui: { label: "Oui", color: K.mint },
  non: { label: "Non", color: K.danger },
  nsp: { label: "Je ne sais pas", color: K.gold },
  skip: { label: "Question écartée", color: K.faint },
};

export function GuessWhoView({ room }: { room: UseRoom }) {
  const g = room.game as GuessWhoPublic | null;
  const left = useCountdown(g && g.phase !== "final" ? g.deadline : null, room.serverNow);

  const prev = useRef<{ phase: string | null; answered: number; guesses: number }>({ phase: null, answered: 0, guesses: 0 });
  useEffect(() => {
    if (!g) return;
    const p = prev.current;
    const answered = g.questions.filter((q) => q.answer).length;
    if (g.phase === "ask" && p.phase === "secret") playSound("start");
    if (g.phase === "ask" && answered > p.answered) playSound("chime");
    if (g.phase === "ask" && g.guesses.length > p.guesses) playSound("wrong");
    if (g.phase === "reveal" && p.phase !== "reveal") playSound(g.finderId ? "correct" : "timeUp");
    if (g.phase === "final" && p.phase !== "final") playSound("fanfare");
    prev.current = { phase: g.phase, answered, guesses: g.guesses.length };
  }, [g]);

  if (!g) return null;
  if (g.phase === "final") return <GuessWhoFinal room={room} g={g} />;

  const master = g.players.find((p) => p.id === g.masterId);
  const isMaster = g.masterId === room.you;
  const label = { secret: "Le secret", ask: "Enquête", reveal: "Révélation" }[g.phase];

  return (
    <SocialStage gameId="guesswho">
      <SocialHeader gameId="guesswho" round={g.round} total={g.totalRounds} label={label} left={left} seconds={Math.round(g.phaseMs / 1000)} />

      {g.phase !== "reveal" && (
        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          {master && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, border: `1px solid ${K.line}`, background: "rgba(28,22,54,.7)", fontSize: 14 }}>
              <Avatar name={master.name} color={master.color} avatar={master.avatar} size={20} /> {isMaster ? "Tu es le Maître du secret" : `${master.name} garde le secret`}
            </span>
          )}
          {g.phase === "ask" && <QuestionGauge g={g} />}
        </div>
      )}

      {g.phase === "secret" && (
        <section style={{ textAlign: "center" }}>
          {isMaster ? (
            <>
              <SecretCard g={g} />
              <p style={{ color: K.muted, margin: "12px 0" }}>Réponds honnêtement : tu gagnes des points si la table trouve.</p>
              <button className="arc arc-p" style={{ minWidth: 220 }} onClick={() => room.gameAction({ kind: "ready" })}>C&apos;est parti !</button>
            </>
          ) : (
            <>
              <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 24, margin: "10px 0 6px" }}>{master?.name} découvre la personne mystère…</div>
              <p style={{ color: K.muted, margin: 0 }}>
                {g.mode === "entrenous" ? "C'est l'un d'entre vous ! Préparez vos questions." : "Une personnalité ou un personnage connu. Préparez vos questions !"}
              </p>
            </>
          )}
          <StatusBar>
            <span>Questions fermées uniquement : oui / non.</span>
            <HostSkip room={room} label="Commencer" />
          </StatusBar>
        </section>
      )}

      {g.phase === "ask" && (isMaster ? <MasterPanel room={room} g={g} /> : <GuesserPanel room={room} g={g} />)}

      {g.phase === "reveal" && <Reveal room={room} g={g} />}
    </SocialStage>
  );
}

function QuestionGauge({ g }: { g: GuessWhoPublic }) {
  const pct = (g.left / g.maxQuestions) * 100;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, border: `1px solid ${K.line}`, background: "rgba(28,22,54,.7)", fontSize: 14 }}>
      <span style={{ width: 70, height: 6, borderRadius: 999, background: K.raised, overflow: "hidden" }}>
        <span style={{ display: "block", width: `${pct}%`, height: "100%", background: g.left <= 5 ? K.danger : ACCENT, transition: "width .3s" }} />
      </span>
      <b>{g.left}</b>&nbsp;question{g.left > 1 ? "s" : ""}
    </span>
  );
}

/** Le secret, côté Maître. */
function SecretCard({ g, small = false }: { g: GuessWhoPublic; small?: boolean }) {
  const secretP = g.players.find((p) => p.id === g.secretPlayerId);
  return (
    <section style={{ maxWidth: small ? 420 : 380, margin: "0 auto", padding: small ? "10px 14px" : "22px 18px", borderRadius: 22, border: `1px solid ${hexA(ACCENT, 0.5)}`, background: `linear-gradient(160deg, ${hexA(ACCENT, 0.22)}, ${K.surface})`, textAlign: "center", display: small ? "flex" : "block", alignItems: "center", gap: 10, justifyContent: "center" }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: K.muted, marginBottom: small ? 0 : 6 }}>Personne mystère</div>
      {g.celebrity ? (
        <div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: small ? 18 : 32 }}>{g.celebrity.name}</div>
          {!small && <div style={{ color: K.muted, fontSize: 14, marginTop: 4 }}>{g.celebrity.hint}</div>}
        </div>
      ) : secretP ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginTop: small ? 0 : 6 }}>
          <Avatar name={secretP.name} color={secretP.color} avatar={secretP.avatar} size={small ? 26 : 52} />
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: small ? 18 : 28 }}>{secretP.name}</span>
        </div>
      ) : null}
    </section>
  );
}

function QuestionList({ g, you }: { g: GuessWhoPublic; you: string }) {
  const box = useRef<HTMLDivElement | null>(null);
  const items = g.questions.map((q) => ({ q, key: `q${q.id}` }));
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [g.questions.length, g.guesses.length]);
  const nameOf = (id: string) => (id === you ? "toi" : g.players.find((p) => p.id === id)?.name ?? "?");
  return (
    <div ref={box} style={{ maxWidth: 600, margin: "0 auto", maxHeight: 300, minHeight: 100, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, padding: 12, borderRadius: 18, border: `1px solid ${K.line}`, background: "rgba(14,11,26,.6)" }}>
      {items.length === 0 && g.guesses.length === 0 && <p style={{ margin: "auto", color: K.faint, fontSize: 14 }}>Aucune question pour l&apos;instant…</p>}
      {items.map(({ q, key }) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 12, background: "rgba(28,22,54,.6)" }}>
          <span style={{ flex: 1, fontSize: 15 }}><span style={{ color: K.faint, fontSize: 12 }}>{nameOf(q.askerId)} · </span>{q.text}</span>
          {q.answer ? (
            <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 14, color: ANSWER[q.answer].color, whiteSpace: "nowrap" }}>{ANSWER[q.answer].label}</span>
          ) : (
            <span style={{ fontSize: 12, color: K.faint, fontStyle: "italic" }}>en attente…</span>
          )}
        </div>
      ))}
      {g.guesses.map((x, i) => (
        <div key={`g${i}`} style={{ alignSelf: "center", padding: "4px 12px", borderRadius: 999, background: hexA(K.danger, 0.14), color: "#FFB3B3", fontSize: 13 }}>
          {nameOf(x.playerId)} a proposé « {x.text} » : raté (−1 question)
        </div>
      ))}
    </div>
  );
}

function MasterPanel({ room, g }: { room: UseRoom; g: GuessWhoPublic }) {
  const pending = g.questions.filter((q) => q.answer == null);
  const current: GuessWhoQuestion | undefined = pending[0];
  const asker = current ? g.players.find((p) => p.id === current.askerId) : null;
  return (
    <>
      <SecretCard g={g} small />
      <section style={{ maxWidth: 600, margin: "14px auto", padding: "16px 18px", borderRadius: 20, border: `1px solid ${current ? hexA(ACCENT, 0.55) : K.line}`, background: current ? hexA(ACCENT, 0.08) : "transparent", textAlign: "center", minHeight: 120 }}>
        {current ? (
          <>
            <div style={{ fontSize: 13, color: K.muted }}>{asker?.name} demande{pending.length > 1 ? ` (${pending.length - 1} en attente après)` : ""} :</div>
            <div key={current.id} style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 24, margin: "6px 0 14px", animation: "sk-pop .3s ease-out both" }}>{current.text}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {(["oui", "non", "nsp"] as const).map((a) => (
                <button key={a} className={`arc ${a === "oui" ? "arc-ready" : a === "non" ? "arc-mag" : "arc-sec"}`} onClick={() => room.gameAction({ kind: "answer", questionId: current.id, answer: a })}>
                  {ANSWER[a].label}
                </button>
              ))}
              <button onClick={() => room.gameAction({ kind: "answer", questionId: current.id, answer: "skip" })} style={{ border: `1px solid ${K.line}`, background: "transparent", color: K.muted, borderRadius: 10, padding: "6px 12px", cursor: "pointer" }}>
                Écarter (pas une question oui/non)
              </button>
            </div>
          </>
        ) : (
          <p style={{ color: K.faint, margin: "34px 0" }}>En attente d&apos;une question…</p>
        )}
      </section>
      <QuestionList g={g} you={room.you} />
      <StatusBar>
        <span>« Je ne sais pas » et « Écarter » ne consomment pas de question.</span>
        <HostSkip room={room} label="Fin de la manche" />
      </StatusBar>
    </>
  );
}

function GuesserPanel({ room, g }: { room: UseRoom; g: GuessWhoPublic }) {
  const [q, setQ] = useState("");
  const [guess, setGuess] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const myPending = g.questions.some((x) => x.askerId === room.you && x.answer == null);
  const canAsk = g.left > 0 && !myPending;
  const candidates = g.players.filter((p) => p.id !== g.masterId);
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = q.trim();
          if (!t || !canAsk) return;
          room.gameAction({ kind: "ask", text: t });
          setQ("");
        }}
        style={{ display: "flex", gap: 10, maxWidth: 600, margin: "0 auto 12px" }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, GUESSWHO_TEXT_MAX))}
          placeholder={g.left <= 0 ? "Plus de questions : il faut proposer !" : myPending ? "Attends la réponse à ta question…" : "Pose une question fermée (oui / non)…"}
          disabled={!canAsk}
          aria-label="Ta question"
          style={{ flex: 1, minWidth: 0, padding: "14px 16px", borderRadius: 14, border: `1px solid ${hexA(ACCENT, 0.55)}`, background: K.ink, color: K.text, fontSize: 17, fontFamily: BODY, outline: "none", opacity: canAsk ? 1 : 0.6 }}
        />
        <button type="submit" className="arc arc-p" disabled={!canAsk || !q.trim()} style={{ opacity: canAsk && q.trim() ? 1 : 0.5 }}>Demander</button>
      </form>
      <QuestionList g={g} you={room.you} />
      <section style={{ maxWidth: 600, margin: "16px auto 0", padding: "14px 16px", borderRadius: 18, border: `1px dashed ${hexA(K.gold, 0.5)}` }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: K.gold, marginBottom: 8, textAlign: "center" }}>Je pense que c&apos;est…</div>
        {g.mode === "celebrites" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = guess.trim();
              if (!t) return;
              room.gameAction({ kind: "guess", text: t });
              setGuess("");
            }}
            style={{ display: "flex", gap: 10 }}
          >
            <input
              value={guess}
              onChange={(e) => setGuess(e.target.value.slice(0, GUESSWHO_TEXT_MAX))}
              placeholder="Ta proposition (une erreur coûte une question)"
              aria-label="Ta proposition"
              style={{ flex: 1, minWidth: 0, padding: "12px 14px", borderRadius: 12, border: `1px solid ${hexA(K.gold, 0.5)}`, background: K.ink, color: K.text, fontSize: 16, fontFamily: BODY, outline: "none" }}
            />
            <button type="submit" className="arc arc-ready" disabled={!guess.trim()} style={{ opacity: guess.trim() ? 1 : 0.5 }}>Proposer</button>
          </form>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {candidates.map((p) => (
                <button key={p.id} className="sk-card" onClick={() => setPick(p.id)} aria-pressed={pick === p.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px 6px 6px", borderRadius: 999, border: `1px solid ${pick === p.id ? K.gold : K.line}`, background: pick === p.id ? hexA(K.gold, 0.15) : "rgba(28,22,54,.6)", color: K.text, cursor: "pointer" }}>
                  <Avatar name={p.name} color={p.color} avatar={p.avatar} size={24} /> {p.name}{p.id === room.you ? " (toi)" : ""}
                </button>
              ))}
            </div>
            <button className="arc arc-ready arc-block" style={{ marginTop: 10 }} disabled={!pick} onClick={() => { if (pick) { room.gameAction({ kind: "guess", targetId: pick }); setPick(null); } }}>
              Proposer
            </button>
          </>
        )}
      </section>
      <StatusBar>
        <span>Trouver : <b style={{ color: K.mint }}>+100</b> et <b style={{ color: K.mint }}>+10</b> par question restante</span>
        <HostSkip room={room} label="Fin de la manche" />
      </StatusBar>
    </>
  );
}

function Reveal({ room, g }: { room: UseRoom; g: GuessWhoPublic }) {
  const finder = g.players.find((p) => p.id === g.finderId);
  const secretP = g.players.find((p) => p.id === g.secretPlayerId);
  return (
    <section style={{ textAlign: "center" }}>
      <div style={{ padding: "22px 18px", borderRadius: 24, border: `1px solid ${hexA(finder ? K.mint : K.danger, 0.45)}`, background: `linear-gradient(160deg, ${hexA(finder ? K.mint : ACCENT, 0.14)}, rgba(28,22,54,.75) 60%)`, animation: "sk-pop .45s ease-out both" }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: K.faint }}>La personne mystère était…</div>
        {g.celebrity ? (
          <>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 34, color: ACCENT, marginTop: 6 }}>{g.celebrity.name}</div>
            <div style={{ color: K.muted, fontSize: 14 }}>{g.celebrity.hint}</div>
          </>
        ) : secretP ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8 }}>
            <Avatar name={secretP.name} color={secretP.color} avatar={secretP.avatar} size={52} />
            <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 30, color: ACCENT }}>{secretP.name}</span>
          </div>
        ) : null}
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, marginTop: 12, color: finder ? K.mint : K.muted }}>
          {finder ? `Trouvé par ${finder.name}${finder.id === room.you ? " (toi)" : ""} !` : "Personne n'a trouvé…"}
        </div>
        <div style={{ color: K.faint, fontSize: 13, marginTop: 2 }}>{plural(g.maxQuestions - g.left, "question utilisée", "questions utilisées")}</div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 12 }}>
          {Object.entries(g.gained ?? {}).map(([id, v]) => {
            const p = g.players.find((x) => x.id === id);
            return p ? <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14 }}><Avatar name={p.name} color={p.color} avatar={p.avatar} size={22} /> {p.name} <Gain value={v} /></span> : null;
          })}
        </div>
      </div>
      <StatusBar>
        <span>{g.round < g.totalRounds ? "Nouveau Maître du secret dans un instant…" : "Dernière manche ! Le classement arrive…"}</span>
        <HostSkip room={room} label="Suivant" />
      </StatusBar>
    </section>
  );
}

function GuessWhoFinal({ room, g }: { room: UseRoom; g: GuessWhoPublic }) {
  const awards: { label: string; playerId: string; detail?: string }[] = [];
  const sherlock = topOf(g.founds);
  if (sherlock) awards.push({ label: "Sherlock", playerId: sherlock, detail: `${plural(g.founds![sherlock], "personne")} démasquée${g.founds![sherlock] > 1 ? "s" : ""}` });
  const oracle = topOf(g.masterWins);
  if (oracle) awards.push({ label: "L'oracle", playerId: oracle, detail: `${plural(g.masterWins![oracle], "secret")} bien guidé${g.masterWins![oracle] > 1 ? "s" : ""}` });
  return (
    <SocialStage gameId="guesswho">
      <SocialFinal room={room} players={g.players} scores={g.scores} awards={awards} />
    </SocialStage>
  );
}
