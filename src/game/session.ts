import Phaser from 'phaser';
import { newGame } from './state';
import type { GameState } from './state';
import { buildMap, isDaily } from '../world/maps/registry';
import type { MapDef } from '../world/mapkit';
import { locationFromMap } from './state';
import type { LocationState } from './state';

/** The running game: its state, the current map, and a bus the scenes talk through. */
class Session {
  state: GameState = newGame(1);
  readonly events = new Phaser.Events.EventEmitter();
  /** How many pop-ups are holding the world still. */
  private holds = 0;
  get paused(): boolean {
    return this.holds > 0;
  }
  hold(): void {
    this.holds += 1;
  }
  release(): void {
    this.holds = Math.max(0, this.holds - 1);
  }
  private maps = new Map<string, MapDef>();

  reset(seed = 1): void {
    this.state = newGame(seed);
    this.maps.clear();
  }

  load(state: GameState): void {
    this.state = state;
    this.maps.clear();
  }

  map(id: string): MapDef {
    let m = this.maps.get(id);
    if (!m) {
      m = this.build(id);
      this.maps.set(id, m);
    }
    return m;
  }

  /** What has changed on a map since the world began. Made the first time anyone looks. */
  location(id: string): LocationState {
    let l = this.state.locations[id];
    if (!l) {
      l = locationFromMap(this.map(id).objects);
      this.state.locations[id] = l;
    }
    return l;
  }

  /** Forget maps and state that change with the day: the mine, and anything built overnight. */
  newMorning(): void {
    for (const id of [...this.maps.keys()]) {
      if (isDaily(id)) {
        this.maps.delete(id);
        delete this.state.locations[id];
      }
    }
    this.maps.delete('farm');
  }

  private build(id: string): MapDef {
    return buildMap(id, this.state);
  }
}

export const session = new Session();
