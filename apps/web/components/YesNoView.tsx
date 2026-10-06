"use client";

// « Ni oui ni non » — vue joueur : la cible tient bon, les autres la piègent.

import { useEffect, useMemo, useRef, useState } from "react";
import type { YesNoPublic } from "@subtitles-party/shared";
import { YESNO_MSG_MAX } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { Avatar } from "@/components/Avatar";
import { playSound } from "@/lib/sound";
import { BODY, DISPLAY, Gain, HostSkip, K, MONO, SocialFinal, SocialHeader, SocialStage, StatusBar, hexA, plural, topOf, useCountdown } from "@/components/social/kit";

const ACCENT = "rgb(var(--c-orange))";

/** Idées de questions pièges, pour ceux qui sèchent. */
const TRAPS = [
  "Tu es sûr·e ?",
  "Tu t'appelles bien comme ça ?",
  "C'est ton vrai prénom ?",
  "Tu as compris la question ?",
  "Tu préfères le chocolat, c'est ça ?",
  "Attends… tu as dit quoi, là ?",
  "Tu es prêt·e pour la suite ?",
  "On est bien samedi ?",
  "Tu veux que je répète ?",
  "Tu n'aimes pas les pizzas ?",
  "C'est fini, tu as gagné ! Content·e ?",
  "Tu joues pour la première fois ?",
  "Il fait chaud ici, non ?",
  "Tu m'entends bien ?",
  "Tu as déjà dit oui, je crois…",
  "Tu es d'accord avec moi ?",
];

export function YesNoView({ room }: { room: UseRoom }) {
  const g = room.game as YesNoPublic | null;
  const left = useCountdown(g && (g.phase === "ready" || g.phase === "hot" || g.phase === "verdict" || g.phase === "result") ? g.deadline : null, room.serverNow);

  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (!g) return;
    if (g.phase === "hot" && prev.current === "ready") playSound(g.targetId === room.you ? "yourTurn" : "start");
    if (g.phase === "verdict" && prev.current === "hot") playSound("vote");
    if (g.phase === "result" && prev.current !== "result") playSound(g.result?.outcome === "caught" ? "wrong" : "correct");
    if (g.phase === "final" && prev.current !== "final") playSound("fanfare");
    prev.current = g.phase;
  }, [g, room.you]);

  if (!g) return null;
  if (g.phase === "final") return <YesNoFinal room={room} g={g} />;

  const target = g.players.find((p) => p.id === g.targetId);
  const isTarget = g.targetId === room.you;
  const label = { ready: "Préparez-vous", hot: g.mode === "chat" ? "Par écrit" : "À voix haute", verdict: "Vote éclair", result: "Résultat" }[g.phase];
  // Pendant le vote, l'en-tête montre le chrono du vote ; le chrono de la cible est gelé.
  const seconds = g.phase === "hot" ? g.seconds : Math.round(g.phaseMs / 1000);

  return (
    <SocialStage gameId="yesno">
      <SocialHeader gameId="yesno" unit="Cible" round={g.turn} total={g.totalTurns} label={label} left={left} seconds={seconds} />

      {target && (
        <section style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center", margin: "6px 0 18px" }}>
          <span style={{ ["--a" as string]: ACCENT, borderRadius: 20, animation: g.phase === "hot" ? "sk-glow 1.2s ease-in-out infinite" : undefined }}>
            <Avatar name={target.name} color={target.color} avatar={target.avatar} size={g.phase === "hot" ? 96 : 76} />
          </span>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26 }}>
            {isTarget ? <span style={{ color: ACCENT }}>C&apos;est toi la cible !</span> : <>La cible : <span style={{ color: ACCENT }}>{target.name}</span></>}
          </div>
          {g.phase !== "result" && (
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: K.muted }}>
              Interdit de dire <b style={{ color: K.danger }}>OUI</b> ou <b style={{ color: K.danger }}>NON</b>
            </div>
          )}
        </section>
      )}

      {g.phase === "ready" && (
        <>
          <p style={{ textAlign: "center", color: K.muted, margin: 0 }}>
            {isTarget ? "Respire. Réponds à côté, reformule, gagne du temps… mais ne craque pas." : "Préparez vos questions pièges : il faut lui faire dire oui ou non !"}
          </p>
          <StatusBar>
            <span>Chaque seconde tenue rapporte à la cible. La faire craquer : <b style={{ color: K.mint }}>+150</b></span>
            <HostSkip room={room} label="Go !" />
          </StatusBar>
        </>
      )}

      {g.phase === "hot" && (g.mode === "voix" ? <HotVoice room={room} g={g} isTarget={isTarget} /> : <HotChat room={room} g={g} isTarget={isTarget} />)}

      {g.phase === "verdict" && <Verdict room={room} g={g} />}

      {g.phase === "result" && g.result && <Result room={room} g={g} />}
    </SocialStage>
  );
}

function TrapIdea() {
  const [i, setI] = useState(() => Math.floor(Math.random() * TRAPS.length));
  return (
    <button
      onClick={() => setI((v) => (v + 1 + Math.floor(Math.random() * (TRAPS.length - 1))) % TRAPS.length)}
      style={{ display: "block", margin: "0 auto", padding: "8px 14px", borderRadius: 14, border: `1px dashed ${K.line}`, background: "transparent", color: K.muted, fontSize: 14, cursor: "pointer", fontFamily: BODY }}
      title="Une autre idée"
    >
      Idée de piège : <i style={{ color: K.text }}>« {TRAPS[i]} »</i> ↻
    </button>
  );
}

function HotVoice({ room, g, isTarget }: { room: UseRoom; g: YesNoPublic; isTarget: boolean }) {
  return (
    <>
      {isTarget ? (
        <p style={{ textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, margin: "0 0 12px" }}>Tiens bon !</p>
      ) : (
        <>
          <button
            className="arc arc-mag arc-block"
            style={{ maxWidth: 440, margin: "0 auto 14px", display: "flex", fontSize: 24, padding: "22px 18px" }}
            onClick={() => room.gameAction({ kind: "accuse" })}
          >
            IL L&apos;A DIT !
          </button>
          <TrapIdea />
        </>
      )}
      <StatusBar>
        <span>Une fausse alerte coûte <b style={{ color: K.danger }}>−50</b> : la table vote avant de valider.</span>
        <HostSkip room={room} label="Fin du chrono" />
      </StatusBar>
    </>
  );
}

function HotChat({ room, g, isTarget }: { room: UseRoom; g: YesNoPublic; isTarget: boolean }) {
  const [draft, setDraft] = useState("");
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [g.log.length]);
  const nameOf = (id: string) => g.players.find((p) => p.id === id)?.name ?? "";
  return (
    <>
      <div ref={box} style={{ maxWidth: 560, margin: "0 auto", maxHeight: 300, minHeight: 140, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, padding: 12, borderRadius: 18, border: `1px solid ${K.line}`, background: "rgb(var(--c-ink-deep) / .6)" }}>
        {g.log.length === 0 && <p style={{ margin: "auto", color: K.faint, fontSize: 14 }}>{isTarget ? "Les questions arrivent…" : "Pose ta première question piège !"}</p>}
        {g.log.map((m) =>
          !m.from ? (
            <div key={m.id} style={{ alignSelf: "center", padding: "4px 12px", borderRadius: 999, background: hexA(K.danger, 0.16), color: "#FFB3B3", fontSize: 13, fontWeight: 700 }}>{m.text}</div>
          ) : m.from === g.targetId ? (
            <div key={m.id} style={{ alignSelf: "flex-end", maxWidth: "85%", padding: "8px 14px", borderRadius: "16px 4px 16px 16px", background: hexA(ACCENT, 0.22), border: `1px solid ${hexA(ACCENT, 0.5)}`, fontFamily: DISPLAY, fontWeight: 700 }}>{m.text}</div>
          ) : (
            <div key={m.id} style={{ alignSelf: "flex-start", maxWidth: "85%", padding: "6px 12px", borderRadius: "4px 14px 14px 14px", background: K.raised, fontSize: 15 }}>
              <span style={{ color: K.faint, fontSize: 12 }}>{m.from === room.you ? "toi" : nameOf(m.from)} · </span>{m.text}
            </div>
          ),
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = draft.trim();
          if (!t) return;
          room.gameAction({ kind: "say", text: t });
          setDraft("");
        }}
        style={{ display: "flex", gap: 10, maxWidth: 560, margin: "12px auto 0" }}
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, YESNO_MSG_MAX))}
          placeholder={isTarget ? "Ta réponse (attention !)" : "Ta question piège…"}
          aria-label={isTarget ? "Ta réponse" : "Ta question"}
          style={{ flex: 1, minWidth: 0, padding: "14px 16px", borderRadius: 14, border: `1px solid ${hexA(isTarget ? K.danger : ACCENT, 0.55)}`, background: K.ink, color: K.text, fontSize: 17, fontFamily: BODY, outline: "none" }}
        />
        <button type="submit" className="arc arc-p" disabled={!draft.trim()} style={{ opacity: draft.trim() ? 1 : 0.5 }}>Envoyer</button>
      </form>
      {!isTarget && <div style={{ marginTop: 12 }}><TrapIdea /></div>}
      <StatusBar>
        <span>Le jeu repère seul un oui / non (ouais, nan… compris).</span>
        <HostSkip room={room} label="Fin du chrono" />
      </StatusBar>
    </>
  );
}

function Verdict({ room, g }: { room: UseRoom; g: YesNoPublic }) {
  const accuser = g.players.find((p) => p.id === g.accuserId);
  const target = g.players.find((p) => p.id === g.targetId);
  const canVote = room.you !== g.targetId && room.you !== g.accuserId && g.order.includes(room.you);
  const voted = g.yourVote != null;
  const frozen = Math.ceil(g.remainingMs / 1000);
  return (
    <section style={{ textAlign: "center" }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, marginBottom: 6 }}>
        {accuser?.name} affirme que {target?.name} a craqué !
      </div>
      <p style={{ margin: "0 0 14px", color: K.muted }}>Chrono de la cible gelé à {frozen} s.</p>
      {canVote ? (
        voted ? (
          <p style={{ color: K.mint }}>Vote enregistré…</p>
        ) : (
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="arc arc-mag" onClick={() => room.gameAction({ kind: "verdict", said: true })}>Il l&apos;a dit !</button>
            <button className="arc arc-sec" onClick={() => room.gameAction({ kind: "verdict", said: false })}>Fausse alerte</button>
          </div>
        )
      ) : (
        <p style={{ color: K.muted }}>{room.you === g.targetId ? "La table délibère… croise les doigts." : "La table vote…"}</p>
      )}
      <StatusBar>
        <span><b style={{ color: K.text }}>{g.votedIds.length}</b> vote{g.votedIds.length > 1 ? "s" : ""} · égalité = la cible est sauvée</span>
        <HostSkip room={room} label="Trancher" />
      </StatusBar>
    </section>
  );
}

function Result({ room, g }: { room: UseRoom; g: YesNoPublic }) {
  const r = g.result!;
  const catcher = g.players.find((p) => p.id === r.catcherId);
  const target = g.players.find((p) => p.id === r.targetId);
  const secs = Math.floor(r.survivedMs / 1000);
  const caught = r.outcome === "caught";
  const gains = useMemo(() => Object.entries(r.gained).filter(([, v]) => v), [r.gained]);
  return (
    <section style={{ textAlign: "center" }}>
      <div style={{ padding: "20px 18px", borderRadius: 24, border: `1px solid ${hexA(caught ? K.danger : K.mint, 0.5)}`, background: `linear-gradient(160deg, ${hexA(caught ? K.danger : K.mint, 0.14)}, rgb(var(--c-ink-surface) / .75) 60%)`, animation: "sk-pop .45s ease-out both" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 28, color: caught ? K.danger : K.mint }}>
          {caught ? `Craqué au bout de ${secs} s !` : `${target?.name} a tenu ${g.seconds} s !`}
        </div>
        {caught && (
          <div style={{ marginTop: 6, color: K.muted }}>
            {r.word ? <>Le mot fatal : <b style={{ color: K.text }}>« {r.word} »</b>. </> : null}
            {catcher ? <>Bien joué <b style={{ color: K.text }}>{catcher.name}</b> !</> : null}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 14 }}>
          {gains.map(([id, v]) => {
            const p = g.players.find((x) => x.id === id);
            return p ? <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14 }}><Avatar name={p.name} color={p.color} avatar={p.avatar} size={22} /> {p.name} <Gain value={v} /></span> : null;
          })}
        </div>
      </div>
      <StatusBar>
        <span>{g.turn < g.totalTurns ? "Prochaine cible dans un instant…" : "Dernière cible ! Le classement arrive…"}</span>
        <HostSkip room={room} label="Suivant" />
      </StatusBar>
    </section>
  );
}

function YesNoFinal({ room, g }: { room: UseRoom; g: YesNoPublic }) {
  const awards: { label: string; playerId: string; detail?: string }[] = [];
  const wall = topOf(g.survivals);
  if (wall) awards.push({ label: "La muraille", playerId: wall, detail: `a tenu ${plural(g.survivals![wall], "fois", "fois")}` });
  const trap = topOf(g.catches);
  if (trap) awards.push({ label: "Le piégeur", playerId: trap, detail: plural(g.catches![trap], "victime") });
  return (
    <SocialStage gameId="yesno">
      <SocialFinal room={room} players={g.players} scores={g.scores} awards={awards} />
    </SocialStage>
  );
}
