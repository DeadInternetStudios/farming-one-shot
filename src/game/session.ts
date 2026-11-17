import Phaser from 'phaser';
import { newGame } from './state';
import type { GameState } from './state';
import { farmMap } from '../world/maps/farm';
import type { MapDef } from '../world/mapkit';

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

  private build(id: string): MapDef {
    if (id === 'farm') return farmMap(this.state.seed);
    throw new Error('Unknown map ' + id);
  }
}

export const session = new Session();
