import { describe, expect, it } from 'vitest';
import { GamepadInput, type GamepadLike } from './gamepad';

function pad(
  axes: number[] = [0, 0, 0, 0],
  pressed: number[] = [],
  index = 0,
): GamepadLike {
  return {
    id: 'Standard Controller',
    index,
    connected: true,
    mapping: 'standard',
    axes,
    buttons: Array.from({ length: 18 }, (_, button) => ({
      pressed: pressed.includes(button),
      value: pressed.includes(button) ? 1 : 0,
    })),
  };
}

describe('GamepadInput', () => {
  it('reports the first connected standard controller', () => {
    const input = new GamepadInput(() => [null, pad([0, 0, 0, 0], [], 1)]);

    expect(input.poll()).toMatchObject({ connected: true, index: 1 });
  });

  it('maps left and right sticks with a deadzone', () => {
    const input = new GamepadInput(() => [pad([0.75, -0.5, -0.8, 0.6])]);

    expect(input.poll()).toMatchObject({
      move: { x: 0.75, y: -0.5 },
      aim: { x: -0.8, y: 0.6 },
    });

    const centered = new GamepadInput(() => [pad([0.1, -0.15, 0.19, 0])]);
    expect(centered.poll()).toMatchObject({
      move: { x: 0, y: 0 },
      aim: { x: 0, y: 0 },
    });
  });

  it('uses the D-pad when the left stick is centered', () => {
    const input = new GamepadInput(() => [pad([0, 0, 0, 0], [12, 15])]);

    expect(input.poll().move).toEqual({ x: 1, y: -1 });
  });

  it('keeps cannon fire held while A or the right trigger is held', () => {
    let current = pad([0, 0, 0, 0], [0]);
    const input = new GamepadInput(() => [current]);

    expect(input.poll().fire).toBe(true);
    expect(input.poll().fire).toBe(true);
    current = pad();
    expect(input.poll().fire).toBe(false);
  });

  it('emits drop and missile only on new button presses', () => {
    let current = pad();
    const input = new GamepadInput(() => [current]);
    input.poll();
    current = pad([0, 0, 0, 0], [1, 2]);

    expect(input.poll()).toMatchObject({ dropPressed: true, missilePressed: true });
    expect(input.poll()).toMatchObject({ dropPressed: false, missilePressed: false });
  });

  it('maps A/Start to confirm and face buttons to upgrade cards on press', () => {
    let current = pad();
    const input = new GamepadInput(() => [current]);
    input.poll();
    current = pad([0, 0, 0, 0], [0, 9]);

    expect(input.poll()).toMatchObject({ confirmPressed: true, cardPressed: 0 });
    expect(input.poll()).toMatchObject({ confirmPressed: false, cardPressed: -1 });
  });

  it('maps D-pad and shoulder press edges to upgrade focus actions', () => {
    let current = pad();
    const input = new GamepadInput(() => [current]);
    input.poll();

    current = pad([0, 0, 0, 0], [14]);
    expect(input.poll().upgradeAction).toBe('left');
    expect(input.poll().upgradeAction).toBeNull();

    current = pad();
    input.poll();
    current = pad([0, 0, 0, 0], [15]);
    expect(input.poll().upgradeAction).toBe('right');

    current = pad();
    input.poll();
    current = pad([0, 0, 0, 0], [12]);
    expect(input.poll().upgradeAction).toBe('up');

    current = pad();
    input.poll();
    current = pad([0, 0, 0, 0], [13]);
    expect(input.poll().upgradeAction).toBe('down');

    current = pad();
    input.poll();
    current = pad([0, 0, 0, 0], [4]);
    expect(input.poll().upgradeAction).toBe('left');

    current = pad();
    input.poll();
    current = pad([0, 0, 0, 0], [5]);
    expect(input.poll().upgradeAction).toBe('right');
  });

  it('maps A, B, and Start press edges to semantic upgrade commands', () => {
    let current = pad();
    const input = new GamepadInput(() => [current]);
    input.poll();

    current = pad([0, 0, 0, 0], [0]);
    expect(input.poll().upgradeAction).toBe('select');
    expect(input.poll().upgradeAction).toBeNull();

    current = pad();
    input.poll();
    current = pad([0, 0, 0, 0], [1]);
    expect(input.poll().upgradeAction).toBe('refund');

    current = pad();
    input.poll();
    current = pad([0, 0, 0, 0], [9]);
    expect(input.poll().upgradeAction).toBe('continue');
  });

  it('returns neutral input after disconnection', () => {
    let pads: (GamepadLike | null)[] = [pad([1, 1, 1, 1], [0])];
    const input = new GamepadInput(() => pads);
    input.poll();
    pads = [];

    expect(input.poll()).toEqual({
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
      upgradeAction: null,
    });
  });
});
