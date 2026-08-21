"use client";

import {
  ROUNDS_MAX,
  ROUNDS_MIN,
  SPEED_PRESETS,
  type GameSettings,
  type GameSpeed,
} from "@subtitles-party/shared";

const SPEEDS: GameSpeed[] = ["fast", "normal", "relaxed"];

export function GameSettingsPanel({
  settings,
  isHost,
  onChange,
}: {
  settings: GameSettings;
  isHost: boolean;
  onChange: (s: GameSettings) => void;
}) {
  const setRounds = (n: number) =>
    onChange({ ...settings, totalRounds: Math.min(ROUNDS_MAX, Math.max(ROUNDS_MIN, n)) });

  if (!isHost) {
    return (
      <div className="panel px-4 py-3 text-sm text-text-muted">
        <span className="font-medium text-text">Réglages</span> · {settings.totalRounds} manches ·
        rythme {SPEED_PRESETS[settings.speed].label.toLowerCase()}
        <span className="mt-1 block text-xs text-text-faint">
          Seul l'hôte peut les modifier.
        </span>
      </div>
    );
  }

  return (
    <div className="panel space-y-4 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Nombre de manches</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRounds(settings.totalRounds - 1)}
            disabled={settings.totalRounds <= ROUNDS_MIN}
            className="grid h-8 w-8 place-items-center rounded-lg border border-ink-border font-display text-lg disabled:opacity-30"
            aria-label="Moins de manches"
          >
            −
          </button>
          <span className="w-6 text-center font-display text-lg font-bold tabular-nums">
            {settings.totalRounds}
          </span>
          <button
            onClick={() => setRounds(settings.totalRounds + 1)}
            disabled={settings.totalRounds >= ROUNDS_MAX}
            className="grid h-8 w-8 place-items-center rounded-lg border border-ink-border font-display text-lg disabled:opacity-30"
            aria-label="Plus de manches"
          >
            +
          </button>
        </div>
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium">Rythme</span>
        <div className="grid grid-cols-3 gap-2">
          {SPEEDS.map((sp) => {
            const active = settings.speed === sp;
            return (
              <button
                key={sp}
                onClick={() => onChange({ ...settings, speed: sp })}
                className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-ink-border text-text-muted hover:border-gold/50"
                }`}
              >
                {SPEED_PRESETS[sp].label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
