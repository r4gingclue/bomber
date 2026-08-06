export type Phase = 'menu' | 'playing' | 'results' | 'upgrade' | 'actIntro' | 'gameover';

export class StateMachine {
  phase: Phase = 'menu';

  start(): void {
    if (this.phase === 'menu') this.phase = 'playing';
  }
  waveCleared(): void {
    if (this.phase === 'playing') this.phase = 'results';
  }
  resultsAccepted(): void {
    if (this.phase === 'results') this.phase = 'upgrade';
  }
  upgradesConfirmed(actComplete: boolean): void {
    if (this.phase === 'upgrade') this.phase = actComplete ? 'actIntro' : 'playing';
  }
  died(): void {
    if (this.phase === 'playing') this.phase = 'gameover';
  }
  toMenu(): void {
    if (this.phase === 'gameover') this.phase = 'menu';
  }
  introDone(): void {
    if (this.phase === 'actIntro') this.phase = 'playing';
  }
}
