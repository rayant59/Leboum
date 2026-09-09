"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { canStart, sanitizeName, DRAW_THEMES } from "@subtitles-party/shared";
import { getPlayerName, setPlayerName } from "@/lib/identity";
import { useRoom } from "@/lib/useRoom";
import { BoumBackdrop } from "@/components/BoumBackdrop";
import { useGameSounds } from "@/lib/sound";
import { GameView } from "@/components/GameView";
import { DrawGameView } from "@/components/DrawGameView";
import { FakeArtistView } from "@/components/FakeArtistView";
import { RelayView } from "@/components/RelayView";
import { DoublageView } from "@/components/DoublageView";
import { UI } from "./uiAssets";
import { QuizView } from "@/components/QuizView";
import { RecoView } from "@/components/RecoView";
import { BombeView } from "@/components/BombeView";
import { MimicView } from "@/components/MimicView";
import { Avatar } from "@/components/Avatar";
import { ProfileModal } from "@/components/ProfileModal";
import { SubtitleStrip } from "@/components/SubtitleStrip";
import { MODE_ICONS } from "./modeIcons";

type GameId = "draw" | "mimic" | "quiz" | "reco" | "pixel" | "bombe";

/** Un mode de jeu tel qu'exposé dans la salle d'attente.
 *  `img` : illustration dédiée (modes de Dessin) ; sinon on retombe sur la
 *  vignette du jeu. `min` : nombre de joueurs requis (mode grisé en dessous). */
interface ModeDef { id: string; c: string; nm: string; ds: string; img?: string; min?: number }

/** Catalogue des modes par jeu — seule source de vérité de la grille de modes.
 *  Défaut = premier de la liste (`classic` partout). Le moteur retombe sur le
 *  mode classique pour tout mode qu'il ne sait pas encore jouer. */
const MODE_SETS: Record<GameId, ModeDef[]> = {
  draw: [
    { id: "classic", c: "#FFC24B", nm: "Classique", ds: "Un dessine, les autres devinent. Le plus rapide marque le plus.", img: MODE_ICONS.classique },
    { id: "blind", c: "#4CC9F0", nm: "Aveugle", ds: "Tu dessines sans voir ton trait 😅. Plus de temps pour compenser.", img: MODE_ICONS.aveugle },
    { id: "constraints", c: "#8B7DF6", nm: "Contraintes", ds: "Chaque dessin impose une règle absurde (une couleur, sans lever le crayon…).", img: MODE_ICONS.contraintes },
    { id: "coop", c: "#46E0B0", nm: "Coopératif", ds: "En équipe : tous vos points sont mis en commun pour un score collectif.", img: MODE_ICONS.coop },
    { id: "fakeartist", c: "#FF6B6B", nm: "Faux-artiste", ds: "Un imposteur ignore le mot ; démasquez-le au vote.", img: MODE_ICONS.fakeartist },
    { id: "relay", c: "#4CC9F0", nm: "Relais", ds: "Deux joueurs se relaient au crayon, rotation auto.", img: MODE_ICONS.relais },
  ],
  mimic: [
    { id: "classic", c: "#46E0B0", nm: "Classique", ds: "Chacun imite le son, puis tout le monde vote pour la meilleure prise." },
    { id: "chain", c: "#FFC24B", nm: "Téléphone arabe", ds: "Chaque joueur imite l'imitation du précédent. Le résultat final vaut le détour.", min: 3 },
    { id: "duel", c: "#FF6B6B", nm: "Duel", ds: "Deux joueurs s'affrontent sur le même son, le reste du salon tranche.", min: 3 },
  ],
  quiz: [
    { id: "classic", c: "#8B7DF6", nm: "Classique", ds: "Une question, quatre réponses, les points au bout." },
    { id: "speed", c: "#FFC24B", nm: "Vitesse", ds: "Plus tu réponds vite, plus tu marques. Une erreur coûte cher." },
    { id: "survival", c: "#FF6B6B", nm: "Survie", ds: "Trois vies chacun : une mauvaise réponse et tu en perds une." },
    { id: "teams", c: "#46E0B0", nm: "Équipes", ds: "Deux camps, une seule réponse par équipe : mettez-vous d'accord.", min: 4 },
  ],
  reco: [
    { id: "classic", c: "#4CC9F0", nm: "Classique", ds: "Une image, tout le monde cherche la bonne réponse en même temps." },
    { id: "zoom", c: "#FFC24B", nm: "Zoom arrière", ds: "On part d'un détail : l'image se dézoome jusqu'à ce que quelqu'un trouve." },
    { id: "theme", c: "#8B7DF6", nm: "Thème imposé", ds: "Toute la manche sur une seule catégorie : cinéma, lieux, personnalités…" },
  ],
  pixel: [
    { id: "classic", c: "#46E0B0", nm: "Classique", ds: "L'image se dévoile pixel par pixel, premier trouvé premier servi." },
    { id: "rush", c: "#FF6B4D", nm: "Rush", ds: "Révélation deux fois plus rapide, mais les points doublent." },
    { id: "coop", c: "#4CC9F0", nm: "Coopératif", ds: "Score commun : trouvez un maximum d'images avant la fin du chrono." },
  ],
  bombe: [
    { id: "classic", c: "#FF6B4D", nm: "Classique", ds: "Une syllabe, un mot, la bombe tourne jusqu'à l'explosion." },
    { id: "hardcore", c: "#FF6B6B", nm: "Hardcore", ds: "Chrono partagé de 15 s : chaque bonne réponse rend 2 s, jamais moins de 5 s." },
    { id: "coop", c: "#46E0B0", nm: "Coopératif", ds: "Tenez ensemble le plus longtemps possible face à la bombe." },
  ],
};

/** Réglage « Temps par tour » exposé dans la salle d'attente : libellé, presets
 *  et défaut par jeu (saisie libre 5–300 s via « Perso »). */
const TIMES: Record<GameId, { title: string; sub: string; opts: number[]; def: number }> = {
  draw: { title: "Temps de dessin", sub: "Durée de chaque tour de dessin", opts: [45, 60, 80, 120], def: 80 },
  mimic: { title: "Temps d'imitation", sub: "Durée d'enregistrement par joueur", opts: [10, 15, 20, 30], def: 15 },
  quiz: { title: "Temps par question", sub: "Délai pour répondre", opts: [10, 15, 20, 30], def: 15 },
  reco: { title: "Temps par image", sub: "Délai pour trouver la bonne réponse", opts: [15, 20, 30, 45], def: 20 },
  pixel: { title: "Temps de révélation", sub: "Durée avant l'image complète", opts: [20, 30, 45, 60], def: 30 },
  bombe: { title: "Temps par joueur", sub: "Mèche avant l'explosion", opts: [5, 7, 10, 15], def: 7 },
};

const GAME_META: Record<string, { label: string; img: string; tint: string }> = {
  subtitles: { label: "Sous-titres", img: "/games/subtitles.png", tint: "#FFC24B" },
  draw: { label: "Boum Dessin", img: "/games/draw.png", tint: "#FF4D8D" },
  mimic: { label: "Mimic Boum", img: "/games/mimic.png", tint: "#46E0B0" },
  quiz: { label: "Ça te parle ?", img: "/games/quiz.png", tint: "#8B7DF6" },
  reco: { label: "Œil de Boum", img: "/games/reco.png", tint: "#4CC9F0" },
  pixel: { label: "Pixel Panic", img: "/games/pixel.png", tint: "#46E0B0" },
  bombe: { label: "Boum Rush", img: "/games/bombe.png", tint: "#FF6B4D" },
};

export default function LobbyPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();

  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [themesOpen, setThemesOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameId>("draw");
  // Modèle unifié (SPEC §1) : nombre de manches partagé + mémoire du mode et du
  // temps CHOISIS PAR JEU. Changer de jeu restaure ses réglages, jamais ceux des
  // autres. Le moteur retombe sur « classique » pour un mode qu'il ne joue pas.
  const [rounds, setRounds] = useState(3);
  const [modeByGame, setModeByGame] = useState<Partial<Record<GameId, string>>>({});
  const [timeByGame, setTimeByGame] = useState<Partial<Record<GameId, number>>>({});
  const [drawThemes, setDrawThemes] = useState<string[]>([]);

  // Mode/temps effectifs pour le jeu sélectionné (avec repli sur le défaut).
  const modeOf = (g: GameId) => {
    const set = MODE_SETS[g];
    const picked = modeByGame[g];
    return set.some((m) => m.id === picked) ? (picked as string) : set[0].id;
  };
  const timeOf = (g: GameId) => timeByGame[g] ?? TIMES[g].def;
  const curMode = modeOf(selectedGame);
  const turnSeconds = timeOf(selectedGame);
  const setMode = (g: GameId, id: string) => setModeByGame((p) => ({ ...p, [g]: id }));
  const setTime = (g: GameId, v: number) => setTimeByGame((p) => ({ ...p, [g]: v }));
  /** Jeu réellement lancé : les modes Faux-artiste / Relais de Boum Dessin
   *  routent vers leur propre moteur ; les autres modes gardent leur jeu. */
  const launchId = selectedGame === "draw" && (curMode === "fakeartist" || curMode === "relay") ? curMode : selectedGame;
  useEffect(() => setName(getPlayerName()), []);
  useEffect(() => setShareUrl(window.location.href), []);

  // Autorisation de créer le salon, posée par l'accueil dans sessionStorage.
  // On NE peut PAS se fier à window.location au montage : lors d'une navigation
  // Next, le composant se rend avant que l'URL soit commitée.
  const wantsCreate = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      if (sessionStorage.getItem(`boum:create:${code}`) === "1") return true;
    } catch {
      /* sessionStorage indisponible */
    }
    return new URLSearchParams(window.location.search).get("create") === "1";
  }, [code]);
  const room = useRoom(code, wantsCreate);
  useGameSounds(room);
  // Message de connexion : ton doux et rassurant, jamais alarmant.
  // On l'affiche après ~2,5 s tant que la socket n'est pas ouverte (un
  // hébergement gratuit peut mettre quelques secondes à se réveiller).
  const [connWaking, setConnWaking] = useState(false);
  useEffect(() => {
    if (room.status === "open") {
      setConnWaking(false);
      return;
    }
    const t1 = window.setTimeout(() => setConnWaking(true), 2500);
    return () => window.clearTimeout(t1);
  }, [room.status]);

  // Join as soon as we're connected and have a name. Idempotent server-side:
  // a repeat join with the same id is treated as a reconnect.
  const prevStatus = useRef<string>("");
  useEffect(() => {
    if (room.status === "open" && name && prevStatus.current !== "open") {
      room.join(name);
    }
    prevStatus.current = room.status;
  }, [room.status, name, room]);

  // Host broadcasts the currently-selected game so guests see what's coming.
  // Kept above any early return so hook order stays stable every render.
  useEffect(() => {
    const st = room.state;
    const meNow = st && room.you ? st.players[room.you] : undefined;
    if (meNow?.isHost) room.selectGame(selectedGame);
  }, [room, room.state, room.you, selectedGame]);

  // SPEC §4 : un changement de jeu de l'hôte dé-« prête » automatiquement les
  // invités (ils doivent reconfirmer sur la nouvelle partie).
  const prevPending = useRef<string | null>(null);
  useEffect(() => {
    const st = room.state;
    const meNow = st && room.you ? st.players[room.you] : undefined;
    const host = meNow?.isHost ?? false;
    const pending = room.pendingGame ?? null;
    if (!host && meNow?.isReady && pending && prevPending.current !== null && pending !== prevPending.current) {
      room.setReady(false);
    }
    prevPending.current = pending;
  }, [room, room.pendingGame, room.state, room.you]);

  // --- name gate (direct link without a stored pseudo) ----------------------
  if (!name) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
        <div className="panel animate-pop p-6">
          <div className="mb-5 flex justify-center">
            <SubtitleStrip>Boum</SubtitleStrip>
          </div>
          <p className="eyebrow mb-2 text-center">Salle {code}</p>
          <h1 className="mb-1 text-center font-display text-2xl font-bold">Rejoins la partie</h1>
          <p className="mb-5 text-center text-sm text-text-muted">Choisis un pseudo pour entrer.</p>
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") enter();
            }}
            maxLength={20}
            placeholder="Ton pseudo"
            className="mb-3 w-full rounded-xl border border-ink-border bg-ink-deep px-4 py-3 text-center text-lg focus:border-gold"
          />
          <button
            onClick={enter}
            className="w-full rounded-xl bg-gold px-4 py-3 font-display font-bold text-ink-deep transition-transform hover:-translate-y-0.5"
          >
            Entrer
          </button>
        </div>
      </main>
    );
  }

  function enter() {
    const clean = sanitizeName(nameDraft);
    if (!clean) return;
    setPlayerName(clean);
    setName(clean);
  }

  const state = room.state;
  const me = state && room.you ? state.players[room.you] : undefined;
  const isHost = me?.isHost ?? false;

  const players = state ? state.playerOrder.map((id) => state.players[id]).filter(Boolean) : [];
  const readyCount = players.filter((p) => p.isConnected && p.isReady).length;
  const maxPlayers = state?.config.maxPlayers ?? 8;
  const startable = !!state && canStart(state, launchId);

  async function copyLink() {
    const url = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // http on a LAN IP is not a secure context → Clipboard API is missing.
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Couldn't copy automatically — the link stays visible for a manual copy.
    }
  }

  /** Traduit le modèle unifié (jeu + mode + manches + temps) en payload de
   *  démarrage propre à chaque moteur. Un mode que le back ne joue pas encore
   *  est transmis tel quel : le moteur retombe alors sur « classique ». */
  function startSelectedGame() {
    const mode = curMode;
    const t = turnSeconds;
    switch (selectedGame) {
      case "draw":
        if (mode === "fakeartist") return room.startGame("fakeartist", { totalRounds: rounds });
        if (mode === "relay") return room.startGame("relay", { totalRounds: rounds });
        return room.startGame("draw", { totalRounds: rounds, mode, themes: drawThemes, seconds: t });
      case "mimic":
        return room.startGame("mimic", { totalRounds: rounds, recordSeconds: t, mode });
      case "quiz":
        return room.startGame("quiz", { totalQuestions: rounds, secondsPerQuestion: t, types: "all", mode });
      case "reco":
        return room.startGame("reco", { totalQuestions: rounds, secondsPerQuestion: t, category: "all", mode });
      case "pixel":
        return room.startGame("pixel", { totalQuestions: rounds, secondsPerQuestion: t, category: "all", mode });
      case "bombe":
        return room.startGame("bombe", { lives: 3, minSeconds: t, maxSeconds: t + 3, minLetters: 2, maxLetters: 3, mode });
    }
  }

  // --- game hand-off: render the game module once the room is in_game -------
  if (state?.phase === "in_game") {
    if (!room.game) {
      return (
        <main className="grid min-h-dvh place-items-center px-5 text-center">
          <div className="animate-pop">
            <div className="mb-4 flex justify-center">
              <SubtitleStrip>silence, ça tourne…</SubtitleStrip>
            </div>
            <p className="text-text-muted">La partie démarre…</p>
          </div>
        </main>
      );
    }
    if (room.gameId === "fakeartist") return <FakeArtistView room={room} />;
    if (room.gameId === "relay") return <RelayView room={room} />;
    if (room.gameId === "doublage") return <DoublageView room={room} />;
    if (room.gameId === "mimic") return <MimicView room={room} />;
    if (room.gameId === "quiz") return <QuizView room={room} />;
    if (room.gameId === "reco") return <RecoView room={room} />;
    if (room.gameId === "pixel") return <RecoView room={room} pixel />;
    if (room.gameId === "bombe") return <BombeView room={room} />;
    return room.gameId === "draw" ? <DrawGameView room={room} /> : <GameView room={room} />;
  }

  const online = room.status === "open";

  return (
    <>
      <BoumBackdrop />
      <main className="relative z-[1] mx-auto max-w-2xl px-5 py-7" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* brand + connection */}
      <header className="mb-6 flex items-center justify-end">
        <span className="flex items-center gap-2 text-xs text-text-muted">
          <span className={`h-2 w-2 rounded-full ${online ? "bg-mint" : "bg-gold animate-bulb"}`} />
          {online ? "Connecté" : "Connexion…"}
        </span>
      </header>

      {!online && connWaking && (
        <div className="mb-6 rounded-xl border border-gold/40 bg-gold/[0.06] p-4 text-sm">
          <p className="mb-1 flex items-center gap-2 font-semibold text-gold">
            <span className="h-2 w-2 shrink-0 rounded-full bg-gold animate-bulb" />
            Connexion au serveur…
          </p>
          <p className="text-text-muted">
            Le serveur peut mettre quelques secondes à se réveiller. La partie s'ouvre dès qu'il répond.
          </p>
        </div>
      )}

      {/* hero: the room code + invite — carte fidèle à la maquette */}
      <section
        className="mb-8 rounded-2xl border p-6 text-center"
        style={{ borderColor: "#332A5A", backgroundImage: "linear-gradient(180deg, rgba(37,28,69,0.72), rgba(28,22,54,0.72))", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07), 0 1px 0 rgba(255,255,255,0.02), 0 22px 44px -26px rgba(0,0,0,0.95)", backdropFilter: "blur(6px)" }}
      >
        <p style={{ margin: "0 0 12px", fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".16em", color: "#6E6796" }}>Code de la salle</p>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{ display: "inline-flex", gap: 6, padding: 10, borderRadius: 12, background: "rgba(14,11,26,0.8)", boxShadow: "inset 0 2px 10px rgba(0,0,0,0.55)" }}>
            {[...code].map((c, i) => (
              <span
                key={i}
                style={{ display: "grid", placeItems: "center", width: 44, height: 56, borderRadius: 8, border: "1px solid rgba(255,194,75,0.4)", background: "#0E0B1A", fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 700, color: "#FFC24B", boxShadow: "0 0 20px rgba(255,194,75,0.18), inset 0 1px 0 rgba(255,255,255,0.06)", animation: `tilePop 0.5s cubic-bezier(0.34,1.56,0.64,1) ${(0.12 + i * 0.09).toFixed(2)}s both` }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={copyLink}
          title="Copier le lien d'invitation"
          aria-label="Copier le lien d'invitation"
          className="lb-copy"
          style={{
            display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "12px 20px 12px 14px", borderRadius: 999,
            fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 14.5, lineHeight: 1,
            border: `1px solid ${copied ? "rgba(70,224,176,.6)" : "rgba(255,194,75,.55)"}`,
            background: copied ? "linear-gradient(180deg, rgba(70,224,176,.22), rgba(70,224,176,.08))" : "linear-gradient(180deg, rgba(255,194,75,.20), rgba(255,194,75,.06))",
            color: copied ? "#8BF0CE" : "#FFD98A",
            boxShadow: copied ? "0 5px 0 #17624a, 0 12px 22px -12px rgba(70,224,176,.55), inset 0 1px 0 rgba(255,255,255,.18)" : "0 5px 0 #8f620c, 0 12px 22px -12px rgba(255,194,75,.55), inset 0 1px 0 rgba(255,255,255,.18)",
          }}
        >
          <span style={{ display: "grid", placeItems: "center", width: 28, height: 28, flex: "none", borderRadius: "50%", background: copied ? "rgba(70,224,176,.18)" : "rgba(255,194,75,.16)" }}>
            {copied ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"><path d="M10.5 13.5a4.5 4.5 0 0 0 6.4 0l2.1-2.1a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M13.5 10.5a4.5 4.5 0 0 0-6.4 0L5 12.6a4.5 4.5 0 0 0 6.4 6.4l1-1" /></svg>
            )}
          </span>
          <span>{copied ? "Lien copié" : "Copier le lien d'invitation"}</span>
        </button>
      </section>

      {/* players */}
      <section className="mb-8">
        <div className="cfg-head">
          <span className="cfg-ic"><img src={UI.groupViolet} alt="" width={22} height={22} className="select-none" draggable={false} aria-hidden /></span>
          <div>
            <h2 className="cfg-tt">Joueurs <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14, color: "#6E6796" }}>{players.length}/{maxPlayers}</span></h2>
            <span className="cfg-sub">En attente dans le salon</span>
          </div>
          <span className={`pl-readypill${readyCount > 0 ? " some" : ""}`}><span className="d" />{readyCount} prêt{readyCount > 1 ? "s" : ""}</span>
        </div>

        <div className="pl-list">
          {players.map((p) => {
            const isYou = p.id === room.you;
            return (
              <div key={p.id} className={`pl-card${isYou ? " you" : ""}${p.isConnected ? "" : " off"}`}>
                {isYou ? (
                  <button
                    onClick={() => setProfileOpen(true)}
                    className="group relative rounded-[15px]"
                    title="Modifier ton profil"
                    aria-label="Modifier ton profil"
                  >
                    <Avatar name={p.name} color={p.color} avatar={p.avatar} size={48} />
                    <span className={`pl-dot${p.isConnected ? "" : " off"}`} />
                    <span className="absolute inset-0 grid place-items-center rounded-[15px] bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    </span>
                  </button>
                ) : (
                  <div className="relative">
                    <Avatar name={p.name} color={p.color} avatar={p.avatar} size={48} />
                    <span className={`pl-dot${p.isConnected ? "" : " off"}`} title={p.isConnected ? "En ligne" : "Hors ligne"} />
                  </div>
                )}
                <div className="pl-info">
                  <div className="pl-name">
                    <span className="nm">{p.name}</span>
                    {isYou && <span className="pl-youtag">(toi)</span>}
                    {p.isHost && (
                      <span className="pl-host"><img src={UI.crownGold} alt="" width={14} height={14} className="select-none" draggable={false} aria-hidden />Hôte</span>
                    )}
                  </div>
                  <span className="pl-pstatus">
                    <svg className="s-ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    {p.isConnected ? (p.isReady ? "Prêt" : "En attente") : "Déconnecté"}
                  </span>
                </div>
                <span className={`pl-badge ${p.isReady && p.isConnected ? "ok" : "wait"}`}>
                  {p.isReady && p.isConnected ? "Prêt" : "Pas prêt"}
                </span>
              </div>
            );
          })}
        </div>

        {maxPlayers - players.length > 0 && (
          <button className="pl-invite" onClick={copyLink} title="Copier le lien d'invitation">
            <span className="pl-seats">
              {Array.from({ length: Math.min(maxPlayers - players.length, 7) }).map((_, i) => (
                <span key={i} className="pl-seat" style={{ animationDelay: `${(i * 0.18).toFixed(2)}s` }}><span className="d" /></span>
              ))}
            </span>
            <span className="pl-invite-txt">
              <span className="t">{maxPlayers - players.length} place{maxPlayers - players.length > 1 ? "s" : ""} libre{maxPlayers - players.length > 1 ? "s" : ""}</span>
              <span className="s">Partage le code pour les remplir</span>
            </span>
            <span className="pl-invite-cta"><img src={UI.addPlayer} alt="" width={15} height={15} className="select-none" draggable={false} aria-hidden />{copied ? "Lien copié ✓" : "Inviter"}</span>
          </button>
        )}
      </section>

      {/* guests: read-only preview of the game the host will launch */}
      {!isHost && (
        <section className="mb-8">
          <p className="eyebrow mb-2 px-1">Jeu choisi par l'hôte</p>
          {room.pendingGame && GAME_META[room.pendingGame] ? (
            <div className="flex items-center gap-3 rounded-2xl border p-3" style={{ borderColor: `${GAME_META[room.pendingGame].tint}55`, background: `${GAME_META[room.pendingGame].tint}0f` }}>
              <img src={GAME_META[room.pendingGame].img} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" draggable={false} />
              <div className="min-w-0">
                <p className="font-display text-lg font-bold">{GAME_META[room.pendingGame].label}</p>
                <p className="text-xs text-text-faint">L'hôte lancera cette partie. Prépare-toi et mets-toi « prêt » !</p>
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-ink-border p-3 text-sm text-text-faint">L'hôte n'a pas encore choisi de jeu…</p>
          )}
        </section>
      )}

      {/* game picker (host) */}
      {isHost && (
        <section className="mb-8">
          <p className="eyebrow mb-2 px-1">Jeu</p>
          <div className="game-picker-grid">
            {(
              [
                { id: "draw", img: "/games/draw.png", label: "Boum Dessin", players: "2–8", desc: "Dessine le mot secret, les autres devinent — avec ses variantes.", tint: "#FF4D8D", tintBg: "rgba(255,77,141,0.12)", tintBorder: "rgba(255,77,141,0.32)", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 5.6l3.9 3.9" /><path d="M4 20l1.3-4.4L15.7 5.2a1.9 1.9 0 0 1 2.7 0l.4.4a1.9 1.9 0 0 1 0 2.7L8.4 18.7 4 20Z" /></svg> },
                { id: "mimic", img: "/games/mimic.png", label: "Mimic Boum", players: "2–8", desc: "Imite un son avec ta voix — une seule prise. Les autres votent pour la meilleure imitation !", tint: "#46E0B0", tintBg: "rgba(70,224,176,0.12)", tintBorder: "rgba(70,224,176,0.32)", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0" /><path d="M12 17v3.2" /><path d="M9 20.2h6" /></svg> },
                { id: "quiz", img: "/games/quiz.png", label: "Ça te parle ?", players: "2–8", desc: "Répondez à des questions et montrez votre culture !", tint: "#8B7DF6", tintBg: "rgba(139,125,246,0.14)", tintBorder: "rgba(139,125,246,0.4)", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4" /><circle cx="12" cy="17.5" r="0.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="9" /></svg> },
                { id: "reco", img: "/games/reco.png", label: "Œil de Boum", players: "1–12", desc: "Devinez le personnage, le film, le lieu et bien plus.", tint: "#4CC9F0", tintBg: "rgba(76,201,240,0.14)", tintBorder: "rgba(76,201,240,0.4)", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="2.5" /><circle cx="9" cy="10" r="2" /><path d="M4 17l4.5-4 3 2.5L15 12l5 4.5" /></svg> },
                { id: "pixel", img: "/games/pixel.png", label: "Pixel Panic", players: "1–12", desc: "Une image se dévoile pixel par pixel — devine le plus vite possible !", tint: "#46E0B0", tintBg: "rgba(70,224,176,0.12)", tintBorder: "rgba(70,224,176,0.32)", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="6" height="6"/><rect x="15" y="3" width="6" height="6"/><rect x="9" y="9" width="6" height="6"/><rect x="3" y="15" width="6" height="6"/><rect x="15" y="15" width="6" height="6"/></svg> },
                { id: "bombe", img: "/games/bombe.png", label: "Boum Rush", players: "2–12", desc: "Trouve vite un mot avec la syllabe avant que la bombe explose !", tint: "#FF6B4D", tintBg: "rgba(255,107,77,0.14)", tintBorder: "rgba(255,107,77,0.4)", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="14" r="7" /><path d="M16 9l2-2" /><path d="M18 7l1 .3M19 5.5l.3-1M20.5 6.8l1-.3" /></svg> },
              ] as const
            ).map((c) => {
              const sel = selectedGame === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedGame(c.id)}
                  className="lb-gamecard group relative flex flex-col overflow-hidden rounded-2xl border p-4 text-left"
                  style={{
                    borderColor: sel ? c.tint : "#332A5A",
                    background: sel ? `linear-gradient(160deg, ${c.tintBg}, rgba(28,22,54,0.6) 60%)` : "rgba(28,22,54,0.55)",
                    boxShadow: sel
                      ? `inset 0 1px 0 ${c.tint}59, 0 0 0 1px ${c.tint}66, 0 6px 0 -1px rgba(0,0,0,.4), 0 18px 34px -18px ${c.tint}aa`
                      : "inset 0 1px 0 rgba(255,255,255,.05), 0 5px 0 -1px rgba(0,0,0,.35), 0 16px 28px -22px rgba(0,0,0,.9)",
                  }}
                >
                  {/* decorative sparkles */}
                  <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" className="pointer-events-none absolute" style={{ top: "26%", left: "58%", color: sel ? c.tint : "#6E6796", opacity: sel ? 0.55 : 0.3 }}><path fill="currentColor" d="M12 2l1.5 8.5L22 12l-8.5 1.5L12 22l-1.5-8.5L2 12l8.5-1.5z" /></svg>
                  <svg aria-hidden width="9" height="9" viewBox="0 0 24 24" className="pointer-events-none absolute" style={{ top: "62%", left: "84%", color: sel ? c.tint : "#6E6796", opacity: sel ? 0.5 : 0.25 }}><path fill="currentColor" d="M12 2l1.5 8.5L22 12l-8.5 1.5L12 22l-1.5-8.5L2 12l8.5-1.5z" /></svg>
                  <div className="mb-2.5 flex items-start justify-between">
                    <span
                      className="inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl transition-transform group-hover:scale-105"
                      style={{ border: `1px solid ${sel ? c.tintBorder : "#332A5A"}`, boxShadow: sel ? `0 0 16px -4px ${c.tint}` : "none" }}
                    >
                      <img src={c.img} alt="" className="h-full w-full object-cover" draggable={false} />
                    </span>
                    <span className="rounded-full border px-2.5 py-0.5 text-[11px] tabular-nums" style={{ borderColor: sel ? `${c.tint}66` : "#332A5A", color: sel ? c.tint : "#8078a8" }}>
                      {c.players}
                    </span>
                  </div>
                  <div className="font-display text-base font-bold text-text">{c.label}</div>
                  <p className="mt-1 text-sm leading-snug text-text-muted">{c.desc}</p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* settings — réservé à l'hôte : les invités voient seulement la carte
          « Jeu choisi par l'hôte » plus haut, jamais le choix des modes/réglages. */}
      {isHost && (
      <section className="mb-8">
        <p className="eyebrow mb-2 px-1">Réglages</p>
        <div className="space-y-8">
          {/* MODE DE JEU — grille propre au jeu sélectionné (SPEC §4) */}
          <div className="cfg-grp">
            <div className="cfg-head">
              <span className="cfg-ic-img"><img src="/ui/modejeu.png" alt="" draggable={false} /></span>
              <div><h2 className="cfg-tt">Mode de jeu</h2><span className="cfg-sub">{`Pour « ${GAME_META[selectedGame].label} » — ${MODE_SETS[selectedGame].length} modes`}</span></div>
            </div>
            <div className="cfg-modes">
              {MODE_SETS[selectedGame].map((m) => {
                const on = curMode === m.id;
                const locked = m.min != null && players.length < m.min;
                return (
                  <button
                    key={m.id}
                    onClick={() => !locked && setMode(selectedGame, m.id)}
                    disabled={!isHost || locked}
                    className={`cfg-mode${on ? " on" : ""}`}
                    style={{ ["--c" as any]: m.c, opacity: locked ? 0.55 : undefined }}
                    title={locked ? `${m.min} joueurs minimum` : undefined}
                  >
                    <span className="cfg-check"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg></span>
                    <span className="cfg-mic" style={{ padding: 0, overflow: "hidden" }}><img src={m.img ?? GAME_META[selectedGame].img} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} /></span>
                    <span><span className="cfg-mnm">{m.nm}</span><p className="cfg-mds">{locked ? `${m.min} joueurs minimum` : m.ds}</p></span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MANCHES — nombre partagé, jamais modifié par un mode (SPEC §1) */}
          <div className="cfg-grp">
            <div className="cfg-head">
              <span className="cfg-ic-img"><img src="/ui/manche.png" alt="" draggable={false} /></span>
              <div><h2 className="cfg-tt">Manches</h2><span className="cfg-sub">Réglage de la partie</span></div>
            </div>
            <div className="cfg-rounds">
              <div className="cfg-rlab"><b>Nombre de manches</b>La partie s'arrête au bout du compte</div>
              <div className="cfg-stepper">
                <button className="cfg-sbtn" onClick={() => setRounds((r) => Math.max(2, r - 1))} disabled={!isHost} aria-label="Moins"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 12h14" /></svg></button>
                <div className="cfg-sval"><div className="cfg-svaln">{rounds}</div><div className="cfg-svalu">manches</div></div>
                <button className="cfg-sbtn" onClick={() => setRounds((r) => Math.min(8, r + 1))} disabled={!isHost} aria-label="Plus"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
              </div>
            </div>
          </div>

          {/* TEMPS PAR TOUR — presets + saisie libre 5–300 s, mémoire par jeu (SPEC §3) */}
          {(() => {
            const tCfg = TIMES[selectedGame];
            const custom = !tCfg.opts.includes(turnSeconds);
            const hardcoreLocked = selectedGame === "bombe" && curMode === "hardcore";
            const timeLocked = !isHost || hardcoreLocked;
            const hint = hardcoreLocked
              ? "Imposé en Hardcore : chrono partagé de 15 s, +2 s par bonne réponse."
              : selectedGame === "draw" && curMode === "blind"
                ? `Mode Aveugle : +25 % de temps automatiquement (${Math.round(turnSeconds * 1.25)}s).`
                : selectedGame === "pixel" && curMode === "rush"
                  ? `Mode Rush : révélation deux fois plus rapide (~${Math.round(turnSeconds / 2)}s réels).`
                  : `S'applique à « ${GAME_META[selectedGame].label} ». Chaque jeu garde son propre réglage.`;
            return (
              <div className="cfg-grp">
                <div className="cfg-time" style={{ opacity: hardcoreLocked ? 0.55 : undefined }}>
                  <div className="cfg-time-head">
                    <div className="cfg-rlab"><b>{tCfg.title}</b>{tCfg.sub}</div>
                    <div className="cfg-time-val"><span className="n">{hardcoreLocked ? 15 : turnSeconds}</span><span className="u">sec</span></div>
                  </div>
                  <div className="cfg-time-opts">
                    {tCfg.opts.map((v) => (
                      <button
                        key={v}
                        onClick={() => setTime(selectedGame, v)}
                        disabled={timeLocked}
                        className={`cfg-timebtn${!hardcoreLocked && v === turnSeconds ? " on" : ""}`}
                      >
                        {v}s
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        const raw = window.prompt("Temps par tour, en secondes (5 – 300)", String(turnSeconds));
                        if (raw == null) return;
                        const n = Math.max(5, Math.min(300, Math.round(Number(raw) || 0)));
                        if (n) setTime(selectedGame, n);
                      }}
                      disabled={timeLocked}
                      className={`cfg-timebtn perso${!hardcoreLocked && custom ? " on" : ""}`}
                    >
                      Perso
                    </button>
                  </div>
                  <div className="cfg-time-hint">{hint}</div>
                </div>
              </div>
            );
          })()}

          {/* THÈMES — Boum Dessin uniquement, hors Faux-artiste / Relais */}
          {selectedGame === "draw" && curMode !== "fakeartist" && curMode !== "relay" && (() => {
            const selCount = drawThemes.length === 0 ? DRAW_THEMES.length : drawThemes.length;
            const allOn = drawThemes.length === 0;
            return (
              <div className="cfg-grp">
                <button
                  onClick={() => setThemesOpen((o) => !o)}
                  className="cfg-collapse"
                  aria-expanded={themesOpen}
                >
                  <span className="cfg-ic"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5V5a2 2 0 0 1 2-2h6.5a2 2 0 0 1 1.4.6l7.5 7.5a2 2 0 0 1 0 2.8l-6.6 6.6a2 2 0 0 1-2.8 0L3.6 12.9A2 2 0 0 1 3 11.5Z" /><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" /></svg></span>
                  <div className="min-w-0 flex-1"><h2 className="cfg-tt">Thèmes</h2><span className="cfg-sub">{themesOpen ? "Ce qui peut tomber" : `${selCount} sur ${DRAW_THEMES.length} sélectionnés`}</span></div>
                  <span className={`cfg-choose${themesOpen ? "" : " pulse"}`}>
                    {themesOpen ? "Fermer" : "Choisir"}
                    <svg className="chev" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: themesOpen ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
                  </span>
                </button>
                {themesOpen && (
                  <div className="mt-3">
                    <div className="cfg-themesbar">
                      <button className="cfg-toggleall" onClick={() => setDrawThemes([])} disabled={!isHost}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg>
                        Tout sélectionner
                      </button>
                      <span className="cfg-selnote"><b>{selCount}</b> thèmes sur {DRAW_THEMES.length}</span>
                    </div>
                    <div className="cfg-tags">
                      {DRAW_THEMES.map((t) => {
                        const on = allOn || drawThemes.includes(t);
                        return (
                          <button
                            key={t}
                            disabled={!isHost}
                            onClick={() =>
                              setDrawThemes((prev) => {
                                const base = prev.length === 0 ? [...DRAW_THEMES] : prev;
                                const next = base.includes(t) ? base.filter((x) => x !== t) : [...base, t];
                                return next.length === DRAW_THEMES.length ? [] : next;
                              })
                            }
                            className={`cfg-tag${on ? " on" : ""}`}
                          >
                            {on && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg>}
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </section>
      )}

      {room.error && (
        <p className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {room.error.message}
        </p>
      )}

      {/* action dock */}
      <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] flex gap-3 rounded-2xl border border-ink-border/80 bg-[rgba(20,16,42,0.85)] p-3 backdrop-blur-md">
        <button
          onClick={() => me && room.setReady(!me.isReady)}
          disabled={!me}
          className={`arc arc-block ${me?.isReady ? "arc-sec" : "arc-ready"} disabled:opacity-40`}
        >
          {me?.isReady ? (
            "Pas prêt"
          ) : (
            <>
              <img src={UI.flagReady} alt="" width={20} height={20} className="select-none" draggable={false} aria-hidden />
              Je suis prêt
            </>
          )}
        </button>
        {isHost &&
          (startable ? (
            <button
              onClick={() => startSelectedGame()}
              className="arc arc-p arc-block"
            >
              Lancer la partie
            </button>
          ) : (
            <button disabled className="arc arc-dis arc-block">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              En attente des joueurs
            </button>
          ))}
      </div>

      {profileOpen && me && (
        <ProfileModal
          name={me.name}
          color={me.color}
          avatar={me.avatar}
          onSetName={(n) => room.setName(n)}
          onSetAvatar={(a) => room.setAvatar(a)}
          onClose={() => setProfileOpen(false)}
        />
      )}
      </main>
    </>
  );
}
