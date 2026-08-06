import type { UpgradeAction } from './upgrade-navigation';

export interface GamepadButtonLike {
  pressed: boolean;
  value: number;
}

export interface GamepadLike {
  id: string;
  index: number;
  connected: boolean;
  mapping: string;
  axes: readonly number[];
  buttons: readonly GamepadButtonLike[];
}

export interface GamepadState {
  connected: boolean;
  index: number;
  move: { x: number; y: number };
  aim: { x: number; y: number };
  fire: boolean;
  dropPressed: boolean;
  missilePressed: boolean;
  sfxPressed: boolean;
  confirmPressed: boolean;
  upgradeAction: UpgradeAction | null;
}

type GamepadProvider = () => readonly (GamepadLike | null)[];

const DEADZONE = 0.2;
const GAMEPLAY_UI_ALIAS_BUTTONS = new Set([0, 1, 5, 12, 13, 14, 15]);
const axis = (value = 0) => Math.abs(value) >= DEADZONE ? value : 0;

export class GamepadInput {
  private previousButtons = new Set<number>();
  private gameplayAliasesLatched = new Set<number>();
  private activeIndex = -1;

  constructor(private readonly getGamepads: GamepadProvider = browserGamepads) {}

  poll(): GamepadState {
    const pad = this.getGamepads().find(candidate =>
      candidate?.connected && candidate.mapping === 'standard',
    );
    if (!pad) {
      this.previousButtons.clear();
      this.gameplayAliasesLatched.clear();
      this.activeIndex = -1;
      return neutralState();
    }
    if (pad.index !== this.activeIndex) {
      this.previousButtons.clear();
      this.gameplayAliasesLatched.clear();
      this.activeIndex = pad.index;
    }

    const pressed = new Set<number>();
    pad.buttons.forEach((button, index) => {
      if (button.pressed || button.value >= 0.5) pressed.add(index);
    });
    const newlyPressed = (button: number) =>
      pressed.has(button) && !this.previousButtons.has(button);
    for (const button of this.gameplayAliasesLatched) {
      if (!pressed.has(button)) this.gameplayAliasesLatched.delete(button);
    }
    const gameplayPressed = (button: number) =>
      pressed.has(button) && !this.gameplayAliasesLatched.has(button);
    const gameplayPressEdge = (button: number) =>
      newlyPressed(button) && !this.gameplayAliasesLatched.has(button);

    let moveX = axis(pad.axes[0]);
    let moveY = axis(pad.axes[1]);
    if (moveX === 0) moveX = Number(gameplayPressed(15)) - Number(gameplayPressed(14));
    if (moveY === 0) moveY = Number(gameplayPressed(13)) - Number(gameplayPressed(12));

    const state: GamepadState = {
      connected: true,
      index: pad.index,
      move: { x: moveX, y: moveY },
      aim: { x: axis(pad.axes[2]), y: axis(pad.axes[3]) },
      fire: gameplayPressed(0) || gameplayPressed(7),
      dropPressed: gameplayPressEdge(1) || gameplayPressEdge(6),
      missilePressed: gameplayPressEdge(2) || gameplayPressEdge(5),
      sfxPressed: newlyPressed(3),
      confirmPressed: newlyPressed(0) || newlyPressed(9),
      upgradeAction: upgradeActionFor(newlyPressed),
    };
    this.previousButtons = pressed;
    return state;
  }

  latchGameplayAliasesUntilRelease(): void {
    for (const button of this.previousButtons) {
      if (GAMEPLAY_UI_ALIAS_BUTTONS.has(button)) this.gameplayAliasesLatched.add(button);
    }
  }
}

function upgradeActionFor(newlyPressed: (button: number) => boolean): UpgradeAction | null {
  if (newlyPressed(14) || newlyPressed(4)) return 'left';
  if (newlyPressed(15) || newlyPressed(5)) return 'right';
  if (newlyPressed(12)) return 'up';
  if (newlyPressed(13)) return 'down';
  if (newlyPressed(0)) return 'select';
  if (newlyPressed(1)) return 'refund';
  if (newlyPressed(9)) return 'continue';
  return null;
}

function browserGamepads(): readonly (GamepadLike | null)[] {
  return typeof navigator !== 'undefined' && navigator.getGamepads
    ? Array.from(navigator.getGamepads())
    : [];
}

function neutralState(): GamepadState {
  return {
    connected: false,
    index: -1,
    move: { x: 0, y: 0 },
    aim: { x: 0, y: 0 },
    fire: false,
    dropPressed: false,
    missilePressed: false,
    sfxPressed: false,
    confirmPressed: false,
    upgradeAction: null,
  };
}
