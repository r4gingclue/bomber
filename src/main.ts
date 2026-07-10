import { VIEW_W, VIEW_H } from './game/consts';
import { Loop } from './core/loop';
import { Input } from './core/input';
import { AudioSys } from './core/audio';
import { mulberry32 } from './core/rng';
import { World } from './game/world';
import { StateMachine } from './game/state';
import { drawCards, type UpgradeCard } from './game/upgrades';
import { makeSheet } from './render/sprites';
import { Renderer, cardRect } from './render/renderer';

const canvas = document.getElementById('game') as HTMLCanvasElement;
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d')!;

const input = new Input();
const audio = new AudioSys();
const state = new StateMachine();
const renderer = new Renderer(ctx, makeSheet());

let world = new World(mulberry32(Date.now() >>> 0));
let cards: UpgradeCard[] = [];
let elapsed = 0;

// --- scaling: integer scale, letterbox via CSS size
let scale = 1;
function resize(): void {
  scale = Math.max(1, Math.floor(Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H)));
  canvas.style.width = `${VIEW_W * scale}px`;
  canvas.style.height = `${VIEW_H * scale}px`;
}
window.addEventListener('resize', resize);
resize();

input.attach(canvas);
input.onGesture = () => audio.resume();
input.toCanvas = (x, y) => {
  const r = canvas.getBoundingClientRect();
  return [(x - r.left) / scale, (y - r.top) / scale];
};
input.onTap = (cx, cy) => {
  if (state.phase === 'menu') startRun();
  else if (state.phase === 'gameover') {
    state.toMenu();
    audio.handle('ui');
  } else if (state.phase === 'upgrade') {
    cards.forEach((_, i) => {
      const r = cardRect(i);
      if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) pickCard(i);
    });
  }
};

function startRun(): void {
  world = new World(mulberry32(Date.now() >>> 0));
  world.startWave();
  state.start();
  audio.handle('ui');
}

function pickCard(i: number): void {
  const card = cards[i];
  if (!card) return;
  card.apply(world.stats);
  world.owned.add(card.id);
  world.player.hp = Math.min(world.stats.maxHp, world.player.hp + 15); // small heal per wave
  state.cardPicked();
  world.startWave();
  audio.handle('ui');
}

window.addEventListener('keydown', e => {
  if (e.code === 'KeyM') audio.toggleMute();
});

function update(dt: number): void {
  elapsed += dt;
  if (state.phase === 'menu' || state.phase === 'gameover') {
    if (input.consumeConfirm()) {
      if (state.phase === 'gameover') { state.toMenu(); audio.handle('ui'); }
      else startRun();
    }
    input.poll(); // drain queued edges
    return;
  }
  if (state.phase === 'upgrade') {
    const k = input.consumeCardKey();
    if (k >= 0) pickCard(k);
    input.poll();
    return;
  }
  // playing
  world.update(dt, input.poll());
  for (const ev of world.events) audio.handle(ev);
  world.events.length = 0;
  if (world.player.hp <= 0) {
    state.died();
    return;
  }
  if (world.cleared) {
    state.waveCleared();
    cards = drawCards(mulberry32((Date.now() ^ world.wave * 7919) >>> 0), world.owned);
    audio.handle('ui');
  }
}

const loop = new Loop(
  dt => update(dt),
  () => renderer.draw(world, state.phase, cards, elapsed),
);
loop.start();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) loop.stop();
  else loop.start();
});

