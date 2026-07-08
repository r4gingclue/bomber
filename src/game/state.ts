export type Phase = 'menu' | 'playing' | 'upgrade' | 'gameover';

export class StateMachine {
  phase: Phase = 'menu';

  start(): void {
    if (this.phase === 'menu') this.phase = 'playing';
  }
  waveCleared(): void {
    if (this.phase === 'playing') this.phase = 'upgrade';
  }
  cardPicked(): void {
    if (this.phase === 'upgrade') this.phase = 'playing';
  }
  died(): void {
    if (this.phase === 'playing') this.phase = 'gameover';
  }
  toMenu(): void {
    if (this.phase === 'gameover') this.phase = 'menu';
  }
}
