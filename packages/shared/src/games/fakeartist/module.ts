import type { GameModule } from "../../platform/types";
import { createFakeArtist, projectFakeArtist, reduceFakeArtist } from "./engine";
import type {
  FakeArtistClientAction,
  FakeArtistPublic,
  FakeArtistSettings,
  FakeArtistState,
} from "./types";

export const FAKE_ARTIST_GAME_ID = "fakeartist" as const;

function sanitize(input: unknown): FakeArtistSettings {
  const totalRounds = Math.min(8, Math.max(2, Math.round(Number((input as FakeArtistSettings)?.totalRounds) || 3)));
  return { totalRounds };
}

export const fakeArtistModule: GameModule<
  FakeArtistState,
  FakeArtistPublic,
  FakeArtistSettings,
  FakeArtistClientAction
> = {
  id: FAKE_ARTIST_GAME_ID,
  meta: { name: "Faux-artiste", minPlayers: 3, maxPlayers: 12 },
  defaultSettings: () => ({ totalRounds: 3 }),
  sanitizeSettings: sanitize,
  createState: createFakeArtist,
  reduce: reduceFakeArtist,
  project: projectFakeArtist,
  deadline: (s) => s.deadline,
  isOver: (s) => s.phase === "scoreboard",
};
