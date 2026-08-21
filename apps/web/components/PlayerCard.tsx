import type { Player } from "@subtitles-party/shared";
import { Avatar } from "@/components/Avatar";

export function PlayerCard({ player, isYou }: { player: Player; isYou: boolean }) {
  return (
    <div
      className={`animate-pop flex items-center gap-3 rounded-xl border p-3 transition-colors ${
        player.isReady
          ? "border-mint/40 bg-mint/[0.06]"
          : "border-ink-border bg-ink-surface"
      } ${player.isConnected ? "" : "opacity-45"}`}
    >
      <div className="relative">
        <Avatar name={player.name} color={player.color} avatar={player.avatar} size={44} />
        <span
          className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-ink-surface ${
            player.isConnected ? "bg-mint" : "bg-text-faint"
          }`}
          title={player.isConnected ? "En ligne" : "Hors ligne"}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{player.name}</span>
          {isYou && <span className="text-xs text-text-faint">(toi)</span>}
          {player.isHost && (
            <span className="text-gold" title="Hôte" aria-label="Hôte">
              ♛
            </span>
          )}
        </div>
        <div className="text-xs text-text-muted">
          {player.isConnected ? (player.isReady ? "Prêt" : "En attente") : "Déconnecté"}
        </div>
      </div>

      {player.isReady && player.isConnected && (
        <span className="text-mint" aria-hidden>
          ✓
        </span>
      )}
    </div>
  );
}
