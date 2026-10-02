// Registre unique des Game Modes hébergés par le serveur générique.
// Ajouter un jeu ici suffit pour que le serveur sache l'héberger.
import type { AnyGameModule } from "./types";
import { drawModule } from "../games/draw/module";
import { fakeArtistModule } from "../games/fakeartist/module";
import { relayModule } from "../games/relay/module";
import { doublageModule } from "../games/doublage/module";
import { quizModule } from "../games/quiz/module";
import { recoModule } from "../games/reconnaissance/module";
import { pixelModule } from "../games/pixel/module";
import { bombeModule } from "../games/bombe/module";
import { mimicModule } from "../games/mimic/module";
import { whoisModule } from "../games/whois/module";
import { funnyModule } from "../games/funny/module";
import { imposterModule } from "../games/imposter/module";

export const ALL_GAME_MODULES: AnyGameModule[] = [
  drawModule,
  fakeArtistModule,
  relayModule,
  doublageModule,
  quizModule,
  recoModule,
  pixelModule,
  bombeModule,
  mimicModule,
  whoisModule,
  funnyModule,
  imposterModule,
];

export const GAME_REGISTRY: Record<string, AnyGameModule> = Object.fromEntries(ALL_GAME_MODULES.map((m) => [m.id, m]));
