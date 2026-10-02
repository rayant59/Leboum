"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { effectiveMaxPlayers, passActive, canStart, isEffectivelyReady, minReadyFor, sanitizeName, DRAW_THEMES, GAME_CATALOG, gameInfo, listedGames } from "@subtitles-party/shared";
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
import { WhoisView } from "@/components/WhoisView";
import { FunnyView } from "@/components/FunnyView";
import { ImposterView } from "@/components/ImposterView";
import { GameIntro } from "@/components/GameIntro";
import { HostQuitButton } from "@/components/HostQuitButton";
import { SupportButton } from "@/components/SupportButton";
import { PassCard, usePassConfig } from "@/components/PassCard";
import { Avatar } from "@/components/Avatar";
import { ProfileModal } from "@/components/ProfileModal";
import { SubtitleStrip } from "@/components/SubtitleStrip";
import { MODE_ICONS } from "./modeIcons";
import { SoireeBuilder, SoireeFinal, SoireeHud, SoireeLobbyCard, type BuilderItem } from "@/components/Soiree";

type GameId = "draw" | "mimic" | "quiz" | "reco" | "pixel" | "bombe" | "whois" | "funny" | "imposter";

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
    { id: "fakeartist", c: "#FF6B6B", nm: "Faux-artiste", ds: "Un imposteur reçoit un mot voisin sans le savoir ; démasquez-le au vote.", img: MODE_ICONS.fakeartist, min: 3 },
    { id: "relay", c: "#4CC9F0", nm: "Relais", ds: "Deux joueurs se relaient au crayon, rotation auto.", img: MODE_ICONS.relais, min: 3 },
  ],
  mimic: [
    { id: "classic", c: "#46E0B0", nm: "Classique", ds: "Chacun imite le son, puis tout le monde vote pour la meilleure prise." },
    { id: "chain", c: "#FFC24B", nm: "Téléphone arabe", ds: "Chaque joueur imite l'imitation du précédent. Le résultat final vaut le détour.", min: 3 },
    { id: "duel", c: "#FF6B6B", nm: "Duel", ds: "Deux joueurs s'affrontent sur le même son, le reste du salon tranche.", min: 3 },
  ],
  quiz: [
    { id: "classic", c: "#8B7DF6", nm: "Classique", ds: "Une question, tu tapes ta réponse, les points au bout." },
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
  whois: [
    { id: "mix", c: "#FFC24B", nm: "Grand mélange", ds: "Toutes les catégories : drôle, perso, absurde, amis, compét', soirée." },
    { id: "drole", c: "#FF4D8D", nm: "Drôle", ds: "Les questions qui font rire (et un peu rougir)." },
    { id: "personnalite", c: "#8B7DF6", nm: "Personnalité", ds: "Qui est le plus têtu, le plus organisé, le plus sensible ?" },
    { id: "absurde", c: "#4CC9F0", nm: "Situations absurdes", ds: "Île déserte, oies agressives et extraterrestres." },
    { id: "amis", c: "#46E0B0", nm: "Entre amis", ds: "Retards, potins, groupes WhatsApp : la vérité éclate." },
    { id: "competition", c: "#FF6B4D", nm: "Compétition", ds: "Mauvais perdants et tricheurs au Monopoly." },
    { id: "soiree", c: "#FFC24B", nm: "Soirée", ds: "Piste de danse, karaoké et derniers à partir." },
  ],
  funny: [
    { id: "classic", c: "#FF4D8D", nm: "Classique", ds: "Le temps de soigner sa vanne : une phrase, une réponse, un vote." },
    { id: "express", c: "#FFC24B", nm: "Express", ds: "30 secondes pour écrire : la première idée est souvent la meilleure." },
  ],
  imposter: [
    { id: "classique", c: "#FF5C7A", nm: "Classique", ds: "L'imposteur sait qu'il l'est et ne connaît que la catégorie. Démasqué, il peut encore deviner le mot." },
    { id: "infiltre", c: "#8B7DF6", nm: "Infiltré", ds: "L'imposteur reçoit un mot voisin… et ne sait même pas que c'est lui." },
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
  mimic: { title: "Temps d'imitation", sub: "Durée d'enregistrement par joueur", opts: [10, 15, 20, 25], def: 15 }, // le moteur plafonne à 25 s
  quiz: { title: "Temps par question", sub: "Délai pour répondre", opts: [10, 15, 20, 30], def: 15 },
  reco: { title: "Temps par image", sub: "Délai pour trouver la bonne réponse", opts: [15, 20, 30, 45], def: 20 },
  pixel: { title: "Temps de révélation", sub: "Durée avant l'image complète", opts: [20, 30, 45, 60], def: 30 },
  whois: { title: "Temps de vote", sub: "Délai pour désigner quelqu'un", opts: [10, 15, 20, 30], def: 20 },
  funny: { title: "Temps d'écriture", sub: "Pour trouver ta meilleure réponse", opts: [30, 45, 60, 90], def: 60 },
  imposter: { title: "Temps par indice", sub: "Pour donner ton indice quand c'est ton tour", opts: [20, 30, 45, 60], def: 30 },
  bombe: { title: "Temps par joueur", sub: "Mèche avant l'explosion", opts: [5, 7, 10, 15], def: 7 },
};

/** Réglage « nombre de tours » exposé dans la salle d'attente. Selon le jeu on
 *  compte en MANCHES (dessin, mimic, bombe) ou en QUESTIONS/IMAGES (quiz, reco,
 *  pixel). Chaque jeu garde son propre défaut et ses propres bornes — le quiz,
 *  par exemple, va jusqu'à 20 questions (le moteur borne totalQuestions à 3–20). */
const ROUNDS: Record<GameId, { headTitle: string; rowTitle: string; rowSub: string; unit: string; min: number; max: number; def: number }> = {
  draw:  { headTitle: "Manches",   rowTitle: "Nombre de manches",   rowSub: "La partie s'arrête au bout du compte", unit: "manches",   min: 2, max: 8,  def: 3 },
  mimic: { headTitle: "Manches",   rowTitle: "Nombre de manches",   rowSub: "La partie s'arrête au bout du compte", unit: "manches",   min: 2, max: 8,  def: 3 },
  quiz:  { headTitle: "Questions", rowTitle: "Nombre de questions", rowSub: "Autant de questions posées dans la partie", unit: "questions", min: 5, max: 20, def: 10 },
  reco:  { headTitle: "Images",    rowTitle: "Nombre d'images",     rowSub: "Autant d'images à reconnaître dans la partie", unit: "images", min: 5, max: 20, def: 10 },
  pixel: { headTitle: "Images",    rowTitle: "Nombre d'images",     rowSub: "Autant d'images à deviner dans la partie", unit: "images", min: 5, max: 20, def: 10 },
  whois: { headTitle: "Questions", rowTitle: "Nombre de questions", rowSub: "Autant de « Qui de nous ? » dans la partie", unit: "questions", min: 5, max: 20, def: 10 },
  funny: { headTitle: "Manches", rowTitle: "Nombre de manches", rowSub: "Une phrase à compléter par manche", unit: "manches", min: 3, max: 10, def: 5 },
  imposter: { headTitle: "Manches", rowTitle: "Nombre de manches", rowSub: "Un nouvel imposteur à chaque manche", unit: "manches", min: 1, max: 8, def: 3 },
  bombe: { headTitle: "Manches",   rowTitle: "Nombre de manches",   rowSub: "La partie s'arrête au bout du compte", unit: "manches",   min: 2, max: 8,  def: 3 },
};

/** Nom / vignette / couleur d'un jeu : lus dans le catalogue commun. */
const GAME_META: Record<string, { label: string; img: string; tint: string }> = Object.fromEntries(
  Object.values(GAME_CATALOG).map((g) => [g.id, { label: g.name, img: g.img, tint: g.accent }]),
);

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
  const [roundsByGame, setRoundsByGame] = useState<Partial<Record<GameId, number>>>({});
  const [modeByGame, setModeByGame] = useState<Partial<Record<GameId, string>>>({});
  const [timeByGame, setTimeByGame] = useState<Partial<Record<GameId, number>>>({});
  const [drawThemes, setDrawThemes] = useState<string[]>([]);
  // Soirée LeBoum : programme préparé par l'hôte (gardé dans son navigateur).
  const [soireeItems, setSoireeItemsState] = useState<BuilderItem[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("lb:soireeItems");
      if (raw) setSoireeItemsState((JSON.parse(raw) as BuilderItem[]).filter((i) => i && typeof i.gameId === "string").slice(0, 12));
    } catch { /* ignore */ }
  }, []);
  const setSoireeItems = (fn: (prev: BuilderItem[]) => BuilderItem[]) =>
    setSoireeItemsState((prev) => {
      const next = fn(prev).slice(0, 12);
      try { localStorage.setItem("lb:soireeItems", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  // Pass Soirée : questions perso du quiz (gardées dans le navigateur de l'hôte).
  const [roomQuestions, setRoomQuestions] = useState("");
  useEffect(() => {
    try { setRoomQuestions(localStorage.getItem("lb:roomQuestions") ?? ""); } catch { /* ignore */ }
  }, []);
  const saveRoomQuestions = (v: string) => {
    setRoomQuestions(v);
    try { localStorage.setItem("lb:roomQuestions", v); } catch { /* ignore */ }
  };

  // Mode/temps effectifs pour le jeu sélectionné (avec repli sur le défaut).
  const modeOf = (g: GameId) => {
    const set = MODE_SETS[g];
    const picked = modeByGame[g];
    return set.some((m) => m.id === picked) ? (picked as string) : set[0].id;
  };
  const timeOf = (g: GameId) => timeByGame[g] ?? TIMES[g].def;
  // Nombre de tours effectif (borné aux limites du jeu), avec repli sur son défaut.
  const roundsOf = (g: GameId) => {
    const cfg = ROUNDS[g];
    const v = roundsByGame[g] ?? cfg.def;
    return Math.max(cfg.min, Math.min(cfg.max, v));
  };
  const curMode = modeOf(selectedGame);
  const turnSeconds = timeOf(selectedGame);
  const curRounds = roundsOf(selectedGame);
  const setMode = (g: GameId, id: string) => setModeByGame((p) => ({ ...p, [g]: id }));
  const setTime = (g: GameId, v: number) => setTimeByGame((p) => ({ ...p, [g]: v }));
  const bumpRounds = (g: GameId, delta: number) =>
    setRoundsByGame((p) => {
      const cfg = ROUNDS[g];
      const cur = p[g] ?? cfg.def;
      return { ...p, [g]: Math.max(cfg.min, Math.min(cfg.max, cur + delta)) };
    });
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
  // ⚠ Le pseudo peut arriver APRÈS l'ouverture de la socket (ami qui ouvre le
  // lien d'invitation sans pseudo enregistré → écran « Rejoins la partie ») :
  // on rejoint donc à chaque (re)connexion ET dès que le pseudo est saisi.
  const joinedWith = useRef<string | null>(null);
  useEffect(() => {
    if (room.status !== "open") {
      joinedWith.current = null; // socket perdue → re-join à la reconnexion
      return;
    }
    if (name && joinedWith.current !== name) {
      joinedWith.current = name;
      room.join(name);
    }
  }, [room.status, name, room]);

  // Pass Soirée : retour de la page de paiement (?pass=…) → on demande au
  // serveur de vérifier le paiement et d'activer le pass, une seule fois.
  const passCfg = usePassConfig();
  const redeemed = useRef(false);
  useEffect(() => {
    if (redeemed.current || room.status !== "open" || !room.you || !room.state?.players[room.you]) return;
    const id = new URLSearchParams(window.location.search).get("pass");
    if (!id) return;
    redeemed.current = true;
    room.redeemPass(id);
    const url = new URL(window.location.href);
    url.searchParams.delete("pass");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [room, room.status, room.you, room.state]);

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

  // --- écran d'annonce « prochain jeu » entre les jeux ----------------------
  // Affiché brièvement à chaque démarrage de jeu (changement de gameId), côté
  // client uniquement : aucune modification du moteur/serveur.
  const [introGame, setIntroGame] = useState<string | null>(null);
  const [introKey, setIntroKey] = useState<string | null>(null);
  // Clé du jeu en cours (null hors partie). On la compare PENDANT le rendu —
  // pas dans un useEffect — pour armer l'intro dès la toute première frame :
  // un effet ne s'exécute qu'après le premier paint, ce qui laissait apparaître
  // le jeu ~1 s avant que l'overlay du décompte ne le recouvre.
  const gameKey = room.state?.phase === "in_game" && room.gameId ? `${room.gameId}#${room.gameRun}` : null;
  // On n'annonce un jeu que si on l'a vu démarrer depuis le salon : après un
  // rechargement en pleine partie, l'annonce masquerait le jeu déjà en cours.
  const sawLobby = useRef(false);
  if (room.state?.phase === "lobby") sawLobby.current = true;
  if (gameKey !== introKey) {
    setIntroKey(gameKey);
    setIntroGame(gameKey && sawLobby.current ? gameKey.split("#")[0] : null); // nouveau jeu → intro ; retour au lobby → on la cache
  }
  // Auto-disparition après 4,2 s (le clic sur l'overlay la ferme aussi).
  useEffect(() => {
    if (!introGame) return;
    const t = window.setTimeout(() => setIntroGame(null), 4200);
    return () => window.clearTimeout(t);
  }, [introGame]);

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

  // Lien vers un salon qui n'existe plus (fermé, code mal tapé) : écran dédié
  // plutôt qu'un faux salon vide bloqué sur « Connexion… ».
  if (room.error?.code === "room_not_found" && !room.state) {
    return (
      <>
        <BoumBackdrop />
        <main className="relative z-[1] mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
          <div className="panel animate-pop p-6 text-center">
            <p className="eyebrow mb-2">Salle {code}</p>
            <h1 className="mb-2 font-display text-2xl font-bold">Ce salon n'existe pas</h1>
            <p className="mb-5 text-sm text-text-muted">Il a peut-être été fermé, ou le code est mal tapé. Demande un nouveau lien à tes amis, ou crée ton propre salon.</p>
            <a href="/" className="block w-full rounded-xl bg-gold px-4 py-3 font-display font-bold text-ink-deep transition-transform hover:-translate-y-0.5">
              Retour à l'accueil
            </a>
          </div>
        </main>
      </>
    );
  }

  const state = room.state;
  const me = state && room.you ? state.players[room.you] : undefined;
  const isHost = me?.isHost ?? false;

  const players = state ? state.playerOrder.map((id) => state.players[id]).filter(Boolean) : [];
  const readyCount = state ? players.filter((p) => isEffectivelyReady(state, p.id)).length : 0;
  const connectedCount = players.filter((p) => p.isConnected).length;
  const neededReady = state ? minReadyFor(state, launchId) : 2;
  const missingReady = Math.max(0, neededReady - readyCount);
  const maxPlayers = state ? effectiveMaxPlayers(state, room.serverNow()) : 8;
  const hasPass = !!state && passActive(state, room.serverNow());
  // Limite propre au jeu (Mimic Boum : 8 voix), même avec le Pass Soirée.
  const gameMaxPlayers = gameInfo(launchId).maxPlayers;
  const tooManyForGame = connectedCount > gameMaxPlayers;
  const startable = !!state && canStart(state, launchId) && !tooManyForGame;
  // Soirée : le 1er jeu du programme fixe l'exigence de « prêts » ; on demande au
  // moins 2 joueurs (une soirée en solo n'a pas de sens).
  const firstSoireeGame = soireeItems[0]?.gameId ?? null;
  const soireeNeeded = state && firstSoireeGame ? Math.max(2, minReadyFor(state, firstSoireeGame)) : 2;
  const missingSoireeReady = Math.max(0, soireeNeeded - readyCount);
  const soireeStartable = !!state && soireeItems.length > 0 && connectedCount >= 2 && missingSoireeReady === 0 && state.phase === "lobby";

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

  /** « Inviter » : feuille de partage native (mobile), sinon copie du lien. */
  async function inviteFriends() {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Boum", text: `Rejoins ma partie Boum ! Code : ${code}`, url });
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return; // partage annulé
      }
    }
    await copyLink();
  }

  /** Traduit le modèle unifié (jeu + mode + manches + temps) en payload de
   *  démarrage propre à chaque moteur. Un mode que le back ne joue pas encore
   *  est transmis tel quel : le moteur retombe alors sur « classique ». */
  function buildLaunch(): BuilderItem {
    const mode = curMode;
    const t = turnSeconds;
    const modeName = MODE_SETS[selectedGame].find((m) => m.id === mode)?.nm ?? "Classique";
    const detail = `${modeName} · ${curRounds} ${ROUNDS[selectedGame].unit} · ${selectedGame === "bombe" && mode === "hardcore" ? 15 : t}s`;
    switch (selectedGame) {
      case "draw":
        if (mode === "fakeartist") return { gameId: "fakeartist", settings: { totalRounds: curRounds }, detail: `${curRounds} manches` };
        if (mode === "relay") return { gameId: "relay", settings: { totalRounds: curRounds }, detail: `${curRounds} manches` };
        return { gameId: "draw", settings: { totalRounds: curRounds, mode, themes: drawThemes, seconds: t }, detail };
      case "mimic":
        return { gameId: "mimic", settings: { totalRounds: curRounds, recordSeconds: t, mode }, detail };
      case "quiz":
        return { gameId: "quiz", settings: { totalQuestions: curRounds, secondsPerQuestion: t, types: "all", mode, ...(hasPass && roomQuestions.trim() ? { roomQuestions } : {}) }, detail };
      case "reco":
        return { gameId: "reco", settings: { totalQuestions: curRounds, secondsPerQuestion: t, category: "all", mode }, detail };
      case "pixel":
        return { gameId: "pixel", settings: { totalQuestions: curRounds, secondsPerQuestion: t, category: "all", mode }, detail };
      case "whois":
        return { gameId: "whois", settings: { totalRounds: curRounds, seconds: t, mode }, detail };
      case "funny":
        return { gameId: "funny", settings: { totalRounds: curRounds, seconds: mode === "express" ? 30 : t }, detail: mode === "express" ? `Express · ${curRounds} manches · 30s` : detail };
      case "imposter":
        return { gameId: "imposter", settings: { totalRounds: curRounds, seconds: t, mode }, detail };
      case "bombe":
        return { gameId: "bombe", settings: { lives: 3, minSeconds: t, maxSeconds: t + 3, minLetters: 2, maxLetters: 3, mode }, detail: `${modeName} · 3 vies` };
    }
  }
  function startSelectedGame() {
    const l = buildLaunch();
    room.startGame(l.gameId, l.settings);
  }

  // --- game hand-off: render the game module once the room is in_game -------
  if (state?.phase === "in_game") {
    if (!room.game) {
      return (
        <>
          <BoumBackdrop />
          <main className="relative z-[1] grid min-h-dvh place-items-center px-5 text-center">
            <style>{`@keyframes lb-dot{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-7px);opacity:1}}@keyframes lb-clap{0%,72%,100%{transform:rotate(0)}82%{transform:rotate(-22deg)}92%{transform:rotate(0)}}@keyframes lb-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
            <div className="animate-pop" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
              <div style={{ position: "relative", width: 120, height: 108, animation: "lb-float 4s ease-in-out infinite" }}>
                <div style={{ position: "absolute", bottom: 0, width: 120, height: 80, borderRadius: 10, background: "linear-gradient(180deg, #251C45, #1C1636)", border: "1px solid #332A5A", boxShadow: "0 18px 40px -18px rgba(0,0,0,.9)" }} />
                <div style={{ position: "absolute", bottom: 26, left: 14, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 14, color: "#FFC24B" }}>BOUM</div>
                <div style={{ position: "absolute", top: 0, left: 0, width: 120, height: 26, transformOrigin: "6px 22px", animation: "lb-clap 2.6s ease-in-out infinite" }}>
                  <div style={{ width: 120, height: 22, borderRadius: 8, background: "#0E0B1A", border: "1px solid #332A5A", overflow: "hidden" }}>
                    <span style={{ display: "block", width: "100%", height: "100%", background: "repeating-linear-gradient(115deg,#F3EEFF 0 13px,#0E0B1A 13px 26px)" }} />
                  </div>
                </div>
              </div>
              <div className="flex justify-center"><SubtitleStrip>silence, ça tourne…</SubtitleStrip></div>
              <div style={{ display: "flex", gap: 9 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#FFC24B", animation: "lb-dot 1.2s ease-in-out infinite" }} />
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#FFC24B", animation: "lb-dot 1.2s ease-in-out .16s infinite" }} />
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#FFC24B", animation: "lb-dot 1.2s ease-in-out .32s infinite" }} />
              </div>
            </div>
          </main>
        </>
      );
    }
    const gameEl =
      room.gameId === "fakeartist" ? <FakeArtistView room={room} /> :
      room.gameId === "relay" ? <RelayView room={room} /> :
      room.gameId === "doublage" ? <DoublageView room={room} /> :
      room.gameId === "mimic" ? <MimicView room={room} /> :
      room.gameId === "quiz" ? <QuizView room={room} /> :
      room.gameId === "reco" ? <RecoView room={room} /> :
      room.gameId === "pixel" ? <RecoView room={room} pixel /> :
      room.gameId === "bombe" ? <BombeView room={room} /> :
      room.gameId === "whois" ? <WhoisView room={room} /> :
      room.gameId === "funny" ? <FunnyView room={room} /> :
      room.gameId === "imposter" ? <ImposterView room={room} /> :
      room.gameId === "draw" ? <DrawGameView room={room} /> :
      <GameView room={room} />;
    // Fin de partie : fournie par le moteur (`isOver`), plus de table dupliquée.
    const gameOver = room.gameOver;
    return (
      <>
        {gameEl}
        {isHost && !gameOver && !introGame && <HostQuitButton onQuit={() => room.returnLobby()} />}
        {gameOver && !room.soiree && <SupportButton floating />}
        {room.soiree && !room.soiree.finished && !introGame && (
          <SoireeHud soiree={room.soiree} you={room.you} isHost={isHost} gameOver={gameOver} onNext={() => room.soireeNext()} />
        )}
        {introGame && (
          <GameIntro gameId={introGame} players={players} onDone={() => setIntroGame(null)} />
        )}
      </>
    );
  }

  const online = room.status === "open";

  // Fin de soirée : grand classement pour toute la tablée.
  if (room.soiree?.finished && room.soiree.records.length > 0) {
    return (
      <>
        <BoumBackdrop />
        <main className="relative z-[1]">
          <SoireeFinal soiree={room.soiree} you={room.you} isHost={isHost} onRematch={() => room.soireeRematch()} onEnd={() => room.soireeEnd()} />
        </main>
      </>
    );
  }
  const soireeLive = !!room.soiree && !room.soiree.finished;

  return (
    <>
      <BoumBackdrop />
      <main className={`relative z-[1] mx-auto max-w-2xl px-5 py-7${isHost ? " lobby-split" : ""}`} style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Colonne gauche (écran large, hôte) : code, joueurs. Sur téléphone ces
          enveloppes sont neutres (display: contents) : rien ne bouge. */}
      <div className="lobby-left">
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
          <span className={`pl-readypill${readyCount > 0 ? " some" : ""}`}><span className="d" />{readyCount}/{connectedCount} prêt{readyCount > 1 ? "s" : ""}</span>
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
                    {!p.isConnected ? "Déconnecté" : p.isHost ? "Choisit le jeu" : p.isReady ? "Prêt" : "En attente"}
                  </span>
                </div>
                {!p.isHost && (
                  <span className={`pl-badge ${p.isReady && p.isConnected ? "ok" : "wait"}`}>
                    {p.isReady && p.isConnected ? "Prêt" : "Pas prêt"}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {maxPlayers - players.length > 0 && (
          <button className="pl-invite" onClick={inviteFriends} title="Inviter des amis">
            <span className="pl-seats">
              {Array.from({ length: Math.min(maxPlayers - players.length, 7) }).map((_, i) => (
                <span key={i} className="pl-seat" style={{ animationDelay: `${(i * 0.18).toFixed(2)}s` }}><span className="d" /></span>
              ))}
            </span>
            <span className="pl-invite-txt">
              <span className="t">{maxPlayers - players.length} place{maxPlayers - players.length > 1 ? "s" : ""} libre{maxPlayers - players.length > 1 ? "s" : ""}</span>
              <span className="s">Envoie le lien à tes amis pour les remplir</span>
            </span>
            <span className="pl-invite-cta"><img src={UI.addPlayer} alt="" width={15} height={15} className="select-none" draggable={false} aria-hidden />{copied ? "Lien copié ✓" : "Inviter"}</span>
          </button>
        )}
      </section>

      {soireeLive && room.soiree && (
        <SoireeLobbyCard soiree={room.soiree} you={room.you} isHost={isHost} onNext={() => room.soireeNext()} onEnd={() => room.soireeEnd()} />
      )}

      {/* guests: read-only preview of the game the host will launch */}
      {!isHost && !soireeLive && (
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

      {state && <PassCard state={state} serverNow={room.serverNow} cfg={passCfg} />}

      </div>

      {/* Colonne droite (écran large, hôte) : choix du jeu + réglages */}
      <div className="lobby-right">
      {isHost && !soireeLive && (
        <SoireeBuilder
          items={soireeItems}
          selectedName={(() => { const l = buildLaunch(); return gameInfo(l.gameId).name; })()}
          onAdd={() => { const l = buildLaunch(); setSoireeItems((p) => [...p, l]); }}
          onRemove={(i) => setSoireeItems((p) => p.filter((_, j) => j !== i))}
          onMoveUp={(i) => setSoireeItems((p) => { if (i <= 0) return p; const n = p.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}
          onClear={() => setSoireeItems(() => [])}
          onLaunch={() => room.startSoiree(soireeItems.map((i) => ({ gameId: i.gameId, settings: i.settings })))}
          launchDisabled={!soireeStartable}
          launchHint={connectedCount < 2 ? "Invite au moins un ami pour lancer une soirée." : missingSoireeReady > 0 ? `Encore ${missingSoireeReady} joueur${missingSoireeReady > 1 ? "s" : ""} prêt${missingSoireeReady > 1 ? "s" : ""}.` : null}
        />
      )}

      {/* game picker (host) */}
      {isHost && (
        <section className="mb-8">
          <p className="eyebrow mb-2 px-1">Jeu</p>
          <div className="game-picker-grid">
            {listedGames()
              .filter((g): g is typeof g & { id: GameId } => g.id in MODE_SETS)
              .map((g) => ({ id: g.id, img: g.img, label: g.name, desc: g.tagline, tint: g.accent, tintBg: `${g.accent}1f`, tintBorder: `${g.accent}66`, min: g.minPlayers, max: g.maxPlayers }))
              .map((c) => {
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
                  <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" className="pointer-events-none absolute" style={{ top: 30, left: 92, color: sel ? c.tint : "#6E6796", opacity: sel ? 0.55 : 0.3 }}><path fill="currentColor" d="M12 2l1.5 8.5L22 12l-8.5 1.5L12 22l-1.5-8.5L2 12l8.5-1.5z" /></svg>
                  <svg aria-hidden width="9" height="9" viewBox="0 0 24 24" className="pointer-events-none absolute" style={{ top: 56, right: 22, color: sel ? c.tint : "#6E6796", opacity: sel ? 0.5 : 0.25 }}><path fill="currentColor" d="M12 2l1.5 8.5L22 12l-8.5 1.5L12 22l-1.5-8.5L2 12l8.5-1.5z" /></svg>
                  <div className="mb-2.5 flex items-start justify-between">
                    <span
                      className="inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl transition-transform group-hover:scale-105"
                      style={{ border: `1px solid ${sel ? c.tintBorder : "#332A5A"}`, boxShadow: sel ? `0 0 16px -4px ${c.tint}` : "none" }}
                    >
                      <img src={c.img} alt="" className="h-full w-full object-cover" draggable={false} />
                    </span>
                    <span className="rounded-full border px-2.5 py-0.5 text-[11px] tabular-nums" style={{ borderColor: sel ? `${c.tint}66` : "#332A5A", color: sel ? c.tint : "#8078a8" }}>
                      {`${c.min}–${Math.min(c.max, maxPlayers)}`}
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

          {/* NOMBRE DE TOURS — libellé et bornes propres à chaque jeu (manches, questions, images) */}
          <div className="cfg-grp">
            <div className="cfg-head">
              <span className="cfg-ic-img"><img src="/ui/manche.png" alt="" draggable={false} /></span>
              <div><h2 className="cfg-tt">{ROUNDS[selectedGame].headTitle}</h2><span className="cfg-sub">Réglage de la partie</span></div>
            </div>
            <div className="cfg-rounds">
              <div className="cfg-rlab"><b>{ROUNDS[selectedGame].rowTitle}</b>{ROUNDS[selectedGame].rowSub}</div>
              <div className="cfg-stepper">
                <button className="cfg-sbtn" onClick={() => bumpRounds(selectedGame, -1)} disabled={!isHost || curRounds <= ROUNDS[selectedGame].min} aria-label="Moins"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 12h14" /></svg></button>
                <div className="cfg-sval"><div className="cfg-svaln">{curRounds}</div><div className="cfg-svalu">{ROUNDS[selectedGame].unit}</div></div>
                <button className="cfg-sbtn" onClick={() => bumpRounds(selectedGame, 1)} disabled={!isHost || curRounds >= ROUNDS[selectedGame].max} aria-label="Plus"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
              </div>
            </div>
          </div>

          {/* TEMPS PAR TOUR — presets + saisie libre 5–300 s, mémoire par jeu (SPEC §3) */}
          {(() => {
            const tCfg = TIMES[selectedGame];
            const custom = !tCfg.opts.includes(turnSeconds);
            const hardcoreLocked = (selectedGame === "bombe" && curMode === "hardcore") || (selectedGame === "funny" && curMode === "express");
            const timeLocked = !isHost || hardcoreLocked;
            const hint = selectedGame === "funny" && curMode === "express"
              ? "Imposé en Express : 30 secondes pour écrire."
              : hardcoreLocked
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
                    <div className="cfg-time-val"><span className="n">{hardcoreLocked ? (selectedGame === "funny" ? 30 : 15) : turnSeconds}</span><span className="u">sec</span></div>
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
          {/* PASS SOIRÉE — questions écrites par l'hôte pour « Ça te parle ? » */}
          {selectedGame === "quiz" && isHost && (
            <div className="cfg-grp">
              <div className="cfg-head">
                <div className="min-w-0 flex-1">
                  <h2 className="cfg-tt">Tes questions {!hasPass && <span style={{ fontSize: 12, color: "#FFC24B" }}>· Pass Soirée</span>}</h2>
                  <span className="cfg-sub">{hasPass ? "Jouées en priorité, la banque complète" : "Personnalise le quiz pour ta bande"}</span>
                </div>
              </div>
              {hasPass ? (
                <>
                  <textarea
                    value={roomQuestions}
                    onChange={(e) => saveRoomQuestions(e.target.value.slice(0, 6000))}
                    rows={5}
                    spellCheck={false}
                    placeholder={"Une question par ligne, la réponse après « = » :\nLe surnom de Karim au lycée ? = Le Boss | boss\nLa ville de nos dernières vacances ? = Marseille"}
                    style={{ width: "100%", boxSizing: "border-box", borderRadius: 14, border: "1px solid #332A5A", background: "#0E0B1A", color: "#F3EEFF", padding: "12px 14px", fontSize: 14, lineHeight: 1.5, resize: "vertical" }}
                  />
                  <span className="cfg-sub" style={{ textTransform: "none", letterSpacing: 0 }}>
                    {(() => { const n = roomQuestions.split(/\r?\n/).filter((l) => l.includes("=") && l.split("=")[1]?.trim()).length; return `${n} question${n > 1 ? "s" : ""} prête${n > 1 ? "s" : ""} · « | » pour accepter plusieurs réponses`; })()}
                  </span>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 14, color: "#A79FC7" }}>
                  Les private jokes de ta bande dans le quiz : débloque-les avec le Pass Soirée{passCfg?.enabled ? " (juste au-dessus)" : " (bientôt disponible)"}.
                </p>
              )}
            </div>
          )}

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

      </div>
      {room.error && (
        <p className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {room.error.message}
        </p>
      )}

      {/* action dock — l'hôte lance directement (il compte comme prêt),
          les invités basculent « prêt / pas prêt ». z-20 : au-dessus des cartes. */}
      <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 mt-2 flex gap-3 rounded-2xl border border-ink-border/80 bg-[rgba(20,16,42,0.92)] p-3 backdrop-blur-md">
        {isHost ? (
          startable ? (
            <button onClick={() => startSelectedGame()} className="arc arc-p arc-block">
              Lancer la partie
            </button>
          ) : (
            <button disabled className="arc arc-dis arc-block">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              {tooManyForGame
                ? `${gameInfo(launchId).name} : ${gameMaxPlayers} joueurs maximum`
                : connectedCount < neededReady
                ? `Il faut au moins ${neededReady} joueurs — invite tes potes`
                : missingReady > 0
                ? `Encore ${missingReady} joueur${missingReady > 1 ? "s" : ""} prêt${missingReady > 1 ? "s" : ""}`
                : "En attente des joueurs"}
            </button>
          )
        ) : (
          <button
            onClick={() => me && room.setReady(!me.isReady)}
            disabled={!me}
            className={`arc arc-block ${me?.isReady ? "arc-sec" : "arc-ready"} disabled:opacity-40`}
          >
            {me?.isReady ? (
              "Pas prêt finalement"
            ) : (
              <>
                <img src={UI.flagReady} alt="" width={20} height={20} className="select-none" draggable={false} aria-hidden />
                Je suis prêt
              </>
            )}
          </button>
        )}
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
