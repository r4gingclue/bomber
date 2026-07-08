import { describe, it, expect } from 'vitest';
import { StateMachine } from './state';

describe('StateMachine', () => {
  it('follows menu → playing → upgrade → playing', () => {
    const m = new StateMachine();
    expect(m.phase).toBe('menu');
    m.start();
    expect(m.phase).toBe('playing');
    m.waveCleared();
    expect(m.phase).toBe('upgrade');
    m.cardPicked();
    expect(m.phase).toBe('playing');
  });
  it('death only ends a live run, restart returns to menu', () => {
    const m = new StateMachine();
    m.died();
    expect(m.phase).toBe('menu'); // ignored
    m.start();
    m.died();
    expect(m.phase).toBe('gameover');
    m.toMenu();
    expect(m.phase).toBe('menu');
  });
  it('ignores illegal transitions', () => {
    const m = new StateMachine();
    m.waveCleared();
    m.cardPicked();
    expect(m.phase).toBe('menu');
    m.start();
    m.start();
    expect(m.phase).toBe('playing');
  });
});
