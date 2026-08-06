import { describe, it, expect } from 'vitest';
import { StateMachine } from './state';

describe('StateMachine', () => {
  it('follows playing → results → upgrade → playing', () => {
    const m = new StateMachine();
    m.start();
    expect(m.phase).toBe('playing');
    m.waveCleared();
    expect(m.phase).toBe('results');
    m.resultsAccepted();
    expect(m.phase).toBe('upgrade');
    m.upgradesConfirmed(false);
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
    m.resultsAccepted();
    m.upgradesConfirmed(false);
    expect(m.phase).toBe('menu');
    m.start();
    m.start();
    expect(m.phase).toBe('playing');
    m.resultsAccepted();
    m.upgradesConfirmed(false);
    expect(m.phase).toBe('playing');
  });
  it('act intro flows upgrade → actIntro → playing', () => {
    const m = new StateMachine();
    m.start();
    m.waveCleared();
    m.resultsAccepted();
    m.upgradesConfirmed(true);
    expect(m.phase).toBe('actIntro');
    m.introDone();
    expect(m.phase).toBe('playing');
  });
  it('actIntro transitions are guarded', () => {
    const m = new StateMachine();
    m.upgradesConfirmed(true);
    expect(m.phase).toBe('menu');
    m.introDone();
    expect(m.phase).toBe('menu');
  });
});
