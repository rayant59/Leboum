"use client";

import { Avatar } from "@/components/Avatar";

export interface RankRow {
  id: string;
  name: string;
  color: string;
  avatar?: string | null;
  score: number;
}

const GOLD = "#FFC24B", SILVER = "#C7CEDD", BRONZE = "#CD7F32";

function Medal({ rank }: { rank: number }) {
  const c = rank === 0 ? GOLD : rank === 1 ? SILVER : rank === 2 ? BRONZE : "#6E6796";
  const fillA = rank === 0 ? "rgba(255,194,75,.2)" : rank === 1 ? "rgba(199,206,221,.18)" : rank === 2 ? "rgba(205,127,50,.18)" : "rgba(110,103,150,.12)";
  const fillB = rank === 0 ? "rgba(255,194,75,.14)" : rank === 1 ? "rgba(199,206,221,.1)" : rank === 2 ? "rgba(205,127,50,.12)" : "rgba(110,103,150,.08)";
  return (
    <svg className="shrink-0" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2h8l-2.5 6h-3z" fill={fillA} />
      <circle cx="12" cy="15" r="6" fill={fillB} />
      {rank === 0 ? (
        <path d="M12 12.4l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" fill={c} stroke="none" />
      ) : (
        <text x="12" y="18" fontFamily="'Bricolage Grotesque',sans-serif" fontSize="8" fontWeight="800" fill={c} stroke="none" textAnchor="middle">{rank + 1}</text>
      )}
    </svg>
  );
}

export function ResultsScreen({
  ranking,
  you,
  stats,
  isHost,
  onReturn,
  onReplay,
}: {
  ranking: RankRow[];
  you: string | null;
  stats: { fastest: string | null; brain: string | null; streak: string | null } | null;
  isHost: boolean;
  onReturn: () => void;
  onReplay: () => void;
}) {
  const winner = ranking[0];
  return (
    <div className="animate-pop">
      {/* hero */}
      <div className="pb-1 pt-3 text-center">
        <div className="flex items-center justify-center gap-4">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 6px 18px rgba(255,194,75,.55))" }}>
            <path d="M6 4h12v5a6 6 0 0 1-12 0V4Z" fill="rgba(255,194,75,.16)" />
            <path d="M6 6H3.5v1.5a3 3 0 0 0 3 3" />
            <path d="M18 6h2.5v1.5a3 3 0 0 1-3 3" />
            <path d="M9.5 15.2 9 19h6l-.5-3.8" />
            <path d="M7.5 21h9" />
          </svg>
          <h1 className="font-display text-4xl font-extrabold text-gold" style={{ animation: "goldGlow 3s ease-in-out infinite" }}>Victoire !</h1>
        </div>
        {winner && (
          <p className="mt-2.5 text-base text-text-muted">
            <b className="text-text">{winner.name}{winner.id === you ? " (toi)" : ""}</b> remporte la partie
          </p>
        )}
      </div>

      {/* board */}
      <div className="mx-auto mt-5 flex max-w-md flex-col gap-3">
        {ranking.map((r, i) => (
          <div
            key={r.id}
            className="flex items-center gap-4 rounded-[18px] border p-4"
            style={{
              borderColor: i === 0 ? "rgba(255,194,75,.5)" : "#332A5A",
              backgroundImage: "linear-gradient(180deg, rgba(37,28,69,.7), rgba(28,22,54,.7))",
              boxShadow: i === 0 ? "0 0 0 1px rgba(255,194,75,.35), 0 14px 34px -18px rgba(255,194,75,.5)" : "inset 0 1px 0 rgba(255,255,255,.05), 0 12px 30px -20px rgba(0,0,0,.85)",
              animation: `revealPop 0.5s cubic-bezier(0.34,1.56,0.64,1) ${(0.1 + i * 0.1).toFixed(2)}s both`,
            }}
          >
            <Medal rank={i} />
            <Avatar name={r.name} color={r.color} avatar={r.avatar} size={34} />
            <span className="flex-1 truncate font-display text-lg font-bold">{r.name}{r.id === you ? " (toi)" : ""}</span>
            <span className="font-mono text-xl font-bold tabular-nums text-gold">{r.score.toLocaleString("fr-FR")}</span>
          </div>
        ))}
      </div>

      {/* super-stats */}
      {stats && (stats.fastest || stats.brain || stats.streak) && (
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {stats.fastest && (
            <span className="inline-flex items-center gap-2 rounded-full border border-ink-border bg-ink-surface/50 px-4 py-2.5 text-sm text-text-muted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill={GOLD}><path d="M13 2 4 14h6l-1 8 10-13h-6l1-7z" /></svg>
              Plus rapide : <b className="text-text">{stats.fastest}</b>
            </span>
          )}
          {stats.brain && (
            <span className="inline-flex items-center gap-2 rounded-full border border-ink-border bg-ink-surface/50 px-4 py-2.5 text-sm text-text-muted">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FF4D8D" strokeWidth="1.7" strokeLinejoin="round"><path d="M9.5 4a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.5A3 3 0 0 0 7 18a2.5 2.5 0 0 0 5 .2V4.5A2 2 0 0 0 9.5 4Z" fill="rgba(255,77,141,.16)" /><path d="M14.5 4a3 3 0 0 1 3 3 3 3 0 0 1 1.5 5.5A3 3 0 0 1 17 18a2.5 2.5 0 0 1-5 .2" fill="rgba(255,77,141,.16)" /></svg>
              Le cerveau : <b className="text-text">{stats.brain}</b>
            </span>
          )}
          {stats.streak && (
            <span className="inline-flex items-center gap-2 rounded-full border border-ink-border bg-ink-surface/50 px-4 py-2.5 text-sm text-text-muted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B7DF6" strokeWidth="1.7" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="3" fill="rgba(139,125,246,.16)" /><circle cx="9" cy="9" r="1.4" fill="#8B7DF6" stroke="none" /><circle cx="15" cy="15" r="1.4" fill="#8B7DF6" stroke="none" /><circle cx="15" cy="9" r="1.4" fill="#8B7DF6" stroke="none" /><circle cx="9" cy="15" r="1.4" fill="#8B7DF6" stroke="none" /></svg>
              Meilleure série : <b className="text-text">{stats.streak}</b>
            </span>
          )}
        </div>
      )}

      {/* actions */}
      {isHost && (
        <div className="mt-6 flex justify-center gap-3.5">
          <button onClick={onReturn} className="arc arc-sec">Retour au salon</button>
          <button onClick={onReplay} className="arc arc-p">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 1 2.6 6.3" /><path d="M3 20v-5h5" /></svg>
            Rejouer
          </button>
        </div>
      )}
    </div>
  );
}
