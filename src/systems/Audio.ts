import Phaser from 'phaser';
import { AUDIO_FILES, SFX_NAMES, TRACK_NAMES } from '../gen/audio';
import type { BedName, TrackName } from '../gen/audio';
import { session } from '../game/session';
import { settings } from '../game/settings';
import { NEXT_TRACKS, bedLevels, listeningTo, musicLevel, trackFor } from '../game/soundtrack';

type Voice = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

/** One looping sound that fades up and down. */
interface Strand {
  name: string;
  voice: Voice;
  level: number;
  volume: number;
}

/** Tunes needed in the first minute are loaded with the game; the rest arrive while you play. */
const FIRST_TRACKS: readonly TrackName[] = ['title', 'farm', 'home'];
/** Decoded tunes are big (about 20 MB each), so only a few are kept. */
const MAX_TUNES_LOADED = 5;
const TUNE_FADE_IN = 1.8;
const TUNE_FADE_OUT = 1.4;
const BED_FADE = 1.6;
/** The same little sound is not repeated faster than this, in milliseconds. */
const MIN_GAP: Readonly<Record<string, number>> = { tick: 45, blip: 25, mine: 60, chop: 60, hoe: 80, water: 120, cut: 50 };
/** How far, in cents, a sound may wander so that repeats do not sound like a machine. */
const WANDER: Readonly<Record<string, number>> = { hoe: 90, chop: 90, mine: 80, cut: 80, plant: 70, place: 60, pickup: 60, tick: 30, water: 50, eat: 50, coin: 50, buy: 40, cast: 40, 'water-dry': 40 };
const MAX_VOICES = 14;

const sfxNames: ReadonlySet<string> = new Set(SFX_NAMES);
const approach = (v: number, to: number, step: number): number => (v < to ? Math.min(to, v + step) : Math.max(to, v - step));
/** A fade that starts and ends gently. */
const smooth = (u: number): number => u * u * (3 - 2 * u);

/** Queue the sounds that are needed from the first frame. */
export function queueFirstAudio(load: Phaser.Loader.LoaderPlugin): void {
  for (const f of AUDIO_FILES) {
    const [kind, name] = f.key.split('/') as [string, string];
    if (kind === 'music' && !(FIRST_TRACKS as readonly string[]).includes(name)) continue;
    load.audio(f.key, [...f.urls]);
  }
}

/**
 * Everything you hear: effects the game asks for, the tune that fits where you are and what time it is,
 * and the quiet background sounds (rain, wind, crickets, birds, water, the cave).
 */
class AudioManager {
  private game: Phaser.Game | null = null;
  private loader: Phaser.Loader.LoaderPlugin | null = null;
  private tune: Strand | null = null;
  private leaving: Strand[] = [];
  private beds = new Map<BedName, Strand>();
  private overrideTune: TrackName | null = null;
  private sleeping = false;
  private asleep = 0;
  private lastPlayed = new Map<string, number>();
  private played: Record<string, number> = {};
  private lastUsed = new Map<string, number>();
  private pending = new Set<string>();
  private failed = new Set<string>();
  private voices = 0;
  private sincePrefetch = 0;

  /** Start listening to the game. Does nothing when the page is muted. */
  start(game: Phaser.Game): void {
    if (this.game || game.sound instanceof Phaser.Sound.NoAudioSoundManager) return;
    this.game = game;
    session.events.on('sfx', (name: string, pitch?: number) => this.sfx(name, pitch));
    session.events.on('sleeping', (on: boolean) => {
      this.sleeping = on;
      this.sfx(on ? 'sleep' : 'morning');
    });
    session.events.on('settings', () => this.sfx('tick'));
    game.events.on(Phaser.Core.Events.POST_STEP, (_time: number, delta: number) => this.update(Math.min(delta / 1000, 0.1)));
  }

  /** Give the manager a scene whose loader can fetch tunes while the game runs. */
  attach(loader: Phaser.Loader.LoaderPlugin): void {
    this.loader = loader;
    loader.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => this.pending.delete(key));
    loader.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      this.pending.delete(file.key);
      this.failed.add(file.key);
    });
  }

  /** Play this tune instead of the one that fits the place (the title screen), or null to go back. */
  override(track: TrackName | null): void {
    this.overrideTune = track;
  }

  sfx(name: string, pitch = 1): void {
    const game = this.game;
    if (!game || settings.sfx <= 0) return;
    if (!sfxNames.has(name)) {
      console.warn(`no sound called ${name}`);
      return;
    }
    const key = `sfx/${name}`;
    if (!this.has(key) || this.voices >= MAX_VOICES) return;
    const now = performance.now();
    if (now - (this.lastPlayed.get(name) ?? -1e9) < (MIN_GAP[name] ?? 30)) return;
    this.lastPlayed.set(name, now);
    this.played[name] = (this.played[name] ?? 0) + 1;
    const wander = WANDER[name] ?? 0;
    const voice = game.sound.add(key) as Voice;
    this.voices += 1;
    voice.once('complete', () => {
      this.voices -= 1;
      voice.destroy();
    });
    voice.play({ volume: settings.sfx, rate: name === 'blip' ? pitch : 1, detune: wander ? (Math.random() * 2 - 1) * wander : 0 });
  }

  /** What is playing, for the test harness. */
  debug(): {
    tune: { name: string; volume: number } | null; leaving: string[]; beds: Record<string, number>; loaded: string[]; pending: string[]; failed: string[];
    played: Record<string, number>; context: string; sleeping: boolean;
  } {
    const manager = this.game?.sound as Phaser.Sound.WebAudioSoundManager | undefined;
    const beds: Record<string, number> = {};
    for (const [name, s] of this.beds) beds[name] = Math.round(s.volume * 1000) / 1000;
    return {
      tune: this.tune ? { name: this.tune.name, volume: Math.round(this.tune.volume * 1000) / 1000 } : null,
      leaving: this.leaving.map((s) => s.name),
      beds,
      loaded: AUDIO_FILES.filter((f) => this.has(f.key)).map((f) => f.key),
      pending: [...this.pending],
      failed: [...this.failed],
      played: { ...this.played },
      context: manager?.context?.state ?? 'none',
      sleeping: this.sleeping,
    };
  }

  // ------------------------------------------------------------- every frame

  private update(dt: number): void {
    const game = this.game;
    if (!game) return;
    const st = session.state;
    const heard = listeningTo(st, session.map(st.player.loc));
    this.asleep = approach(this.asleep, this.sleeping ? 1 : 0, dt / (this.sleeping ? 0.8 : 2.5));
    const calm = 1 - this.asleep;

    this.steerTune(this.overrideTune ?? trackFor(heard));
    const tuneVolume = settings.music * musicLevel(heard) * calm;
    if (this.tune) this.fade(this.tune, 1, dt / TUNE_FADE_IN, tuneVolume);
    for (const s of this.leaving) this.fade(s, 0, dt / TUNE_FADE_OUT, tuneVolume);
    this.leaving = this.leaving.filter((s) => {
      if (s.level > 0.001) return true;
      s.voice.stop();
      s.voice.destroy();
      return false;
    });

    const levels = bedLevels(heard);
    for (const name of Object.keys(levels) as BedName[]) this.steerBed(name, levels[name] * calm, dt);

    this.sincePrefetch += dt;
    if (this.sincePrefetch > 0.5) {
      this.sincePrefetch = 0;
      this.prefetch();
    }
  }

  private fade(s: Strand, to: number, step: number, volume: number): void {
    s.level = approach(s.level, to, step);
    s.volume = smooth(s.level) * volume;
    s.voice.setVolume(s.volume);
  }

  private steerTune(want: TrackName): void {
    if (this.tune?.name === want) return;
    const key = `music/${want}`;
    if (!this.has(key)) {
      this.fetch(key);
      return;
    }
    if (this.tune) this.leaving.push(this.tune);
    const voice = this.game!.sound.add(key, { loop: true, volume: 0 }) as Voice;
    voice.play();
    this.tune = { name: want, voice, level: 0, volume: 0 };
    this.lastUsed.set(want, performance.now());
    this.trim();
  }

  private steerBed(name: BedName, target: number, dt: number): void {
    let s = this.beds.get(name);
    if (!s) {
      const key = `bed/${name}`;
      if (target <= 0.001 || !this.has(key)) return;
      const voice = this.game!.sound.add(key, { loop: true, volume: 0 }) as Voice;
      voice.play();
      s = { name, voice, level: 0, volume: 0 };
      this.beds.set(name, s);
    }
    this.fade(s, target, dt / BED_FADE, settings.sfx);
    if (target <= 0.001 && s.level <= 0.001) {
      s.voice.stop();
      s.voice.destroy();
      this.beds.delete(name);
    }
  }

  // ------------------------------------------------------------- loading

  private has(key: string): boolean {
    return this.game?.cache.audio.exists(key) ?? false;
  }

  /** Ask for one more file, quietly, while the game runs. */
  private fetch(key: string): void {
    const loader = this.loader;
    if (!loader || this.pending.has(key) || this.failed.has(key)) return;
    const file = AUDIO_FILES.find((f) => f.key === key);
    if (!file) return;
    this.pending.add(key);
    loader.audio(key, [...file.urls]);
    if (loader.isReady()) loader.start();
  }

  /** While one tune plays, fetch the ones you are likely to need next, one at a time. */
  private prefetch(): void {
    if (!this.tune || this.pending.size > 0) return;
    for (const next of NEXT_TRACKS[this.tune.name as TrackName]) {
      const key = `music/${next}`;
      if (!this.has(key) && !this.failed.has(key)) {
        this.fetch(key);
        return;
      }
    }
  }

  /** Let go of tunes you have not heard for a while. */
  private trim(): void {
    const game = this.game;
    if (!game || !this.tune) return;
    const loaded = TRACK_NAMES.filter((n) => this.has(`music/${n}`));
    if (loaded.length <= MAX_TUNES_LOADED) return;
    const keep = new Set<string>([this.tune.name, ...this.leaving.map((s) => s.name), ...NEXT_TRACKS[this.tune.name as TrackName]]);
    const spare = loaded.filter((n) => !keep.has(n)).sort((a, b) => (this.lastUsed.get(a) ?? 0) - (this.lastUsed.get(b) ?? 0));
    for (let n = loaded.length; n > MAX_TUNES_LOADED && spare.length > 0; n--) game.cache.audio.remove(`music/${spare.shift()}`);
  }
}

export const audio = new AudioManager();
