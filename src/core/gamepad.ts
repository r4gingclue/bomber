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
  cardPressed: number;
}

type GamepadProvider = () => readonly (GamepadLike | null)[];

const DEADZONE = 0.2;
const axis = (value = 0) => Math.abs(value) >= DEADZONE ? value : 0;

export class GamepadInput {
  private previousButtons = new Set<number>();
  private activeIndex = -1;

  constructor(private readonly getGamepads: GamepadProvider = browserGamepads) {}

  poll(): GamepadState {
    const pad = this.getGamepads().find(candidate =>
      candidate?.connected && candidate.mapping === 'standard',
    );
    if (!pad) {
      this.previousButtons.clear();
      this.activeIndex = -1;
      return neutralState();
    }
    if (pad.index !== this.activeIndex) {
      this.previousButtons.clear();
      this.activeIndex = pad.index;
    }

    const pressed = new Set<number>();
    pad.buttons.forEach((button, index) => {
      if (button.pressed || button.value >= 0.5) pressed.add(index);
    });
    const newlyPressed = (button: number) =>
      pressed.has(button) && !this.previousButtons.has(button);

    let moveX = axis(pad.axes[0]);
    let moveY = axis(pad.axes[1]);
    if (moveX === 0) moveX = Number(pressed.has(15)) - Number(pressed.has(14));
    if (moveY === 0) moveY = Number(pressed.has(13)) - Number(pressed.has(12));

    const cardPressed = [0, 1, 2].findIndex(newlyPressed);
    const state: GamepadState = {
      connected: true,
      index: pad.index,
      move: { x: moveX, y: moveY },
      aim: { x: axis(pad.axes[2]), y: axis(pad.axes[3]) },
      fire: pressed.has(0) || pressed.has(7),
      dropPressed: newlyPressed(1) || newlyPressed(6),
      missilePressed: newlyPressed(2) || newlyPressed(5),
      sfxPressed: newlyPressed(3),
      confirmPressed: newlyPressed(0) || newlyPressed(9),
      cardPressed,
    };
    this.previousButtons = pressed;
    return state;
  }
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
    cardPressed: -1,
  };
}
