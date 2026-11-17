import Phaser from 'phaser';
import { newGame } from './state';
import type { GameState } from './state';
import { buildMap } from '../world/maps/registry';
import type { MapDef } from '../world/mapkit';
import { locationFromMap } from './state';
import type { LocationState } from './state';

/** The running game: its state, the current map, and a bus the scenes talk through. */
class Session {
  state: GameState = newGame(1);
  readonly events = new Phaser.Events.EventEmitter();
  /** True while a pop-up or the night is holding the world still. */
  paused = false;
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

  private build(id: string): MapDef {
    return buildMap(id, this.state.seed);
  }
}

export const session = new Session();
