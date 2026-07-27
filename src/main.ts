import { RENDER_H, RENDER_SCALE, RENDER_W } from './game/consts';
import { Loop } from './core/loop';
import { Input } from './core/input';
import { AudioSys } from './core/audio';
import { mulberry32 } from './core/rng';
import { World } from './game/world';
import { StateMachine } from './game/state';
import { drawCards, type UpgradeCard } from './game/upgrades';
import { makeSheet } from './render/sprites';
import { Renderer, cardRect } from './render/renderer';
import { aimFromStick } from './game/aim';
import { clientToWorld, fitViewport, type Insets } from './render/viewport';
import { GRAPHICS_MANIFEST, loadAssets } from './render/assets';
import { renderFatalBootError } from './render/fatal';

const canvas = document.getElementById('game') as HTMLCanvasElement;
canvas.width = RENDER_W;
canvas.height = RENDER_H;
const ctx = canvas.getContext('2d')!;
ctx.scale(RENDER_SCALE, RENDER_SCALE);

function safeInsets(): Insets {
  const css = getComputedStyle(document.documentElement);
  const n = (name: string) => Number.parseFloat(css.getPropertyValue(name)) || 0;
  return { top: n('--sat'), right: n('--sar'), bottom: n('--sab'), left: n('--sal') };
}

let viewport = fitViewport(innerWidth, innerHeight, safeInsets());
function resize(): void {
  viewport = fitViewport(innerWidth, innerHeight, safeInsets());
  Object.assign(canvas.style, {
    position: 'fixed',
    left: `${viewport.x}px`,
    top: `${viewport.y}px`,
    width: `${viewport.width}px`,
    height: `${viewport.height}px`,
  });
}
window.addEventListener('resize', resize);
resize();

async function boot(): Promise<void> {
  const assets = await loadAssets(GRAPHICS_MANIFEST);
  const input = new Input();
  const audio = new AudioSys();
  const state = new StateMachine();
  const renderer = new Renderer(ctx, makeSheet(), assets);

  let world = new World(mulberry32(Date.now() >>> 0));
  let cards: UpgradeCard[] = [];
  let elapsed = 0;
  let introT = 0;

  input.attach(canvas);
  input.onGesture = () => audio.resume();
  input.toCanvas = (clientX, clientY) => clientToWorld(clientX, clientY, viewport);
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
    // dev-only hook so playtests can inspect and drive game state
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      (window as unknown as { __world: World }).__world = world;
    }
  }

  function pickCard(i: number): void {
    const card = cards[i];
    if (!card) return;
    card.apply(world.stats);
    world.owned.add(card.id);
    world.player.hp = Math.min(world.stats.maxHp, world.player.hp + 15); // small heal per wave
    if (world.actComplete) {
      world.startAct();
      state.toActIntro();
      introT = 2;
    } else {
      state.cardPicked();
      world.startWave();
    }
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
    if (state.phase === 'actIntro') {
      introT -= dt;
      input.poll();
      if (introT <= 0) {
        state.introDone();
        world.startWave();
      }
      return;
    }
    // playing
    const intent = input.poll();
    const stickDir = input.aimStickDir();
    if (stickDir) {
      intent.aim = aimFromStick(world.player.x, world.player.y, stickDir.dx, stickDir.dy);
    } else {
      const m = input.aimCanvasPoint();
      if (m) intent.aim = { x: m.x + world.camX, y: m.y };
    }
    world.update(dt, intent);
    for (const ev of world.events) audio.handle(ev);
    world.events.length = 0;
    if (world.player.hp <= 0) {
      state.died();
      return;
    }
    if (world.cleared) {
      state.waveCleared();
      cards = drawCards(mulberry32((Date.now() ^ world.wave * 7919) >>> 0), world.owned, 3, world.act);
      audio.handle('ui');
    }
  }

  const loop = new Loop(
    dt => update(dt),
    () => renderer.draw(world, state.phase, cards, elapsed, input.touchSeen),
  );
  loop.start();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) loop.stop();
    else loop.start();
  });
}

void boot().catch(error => {
  console.error('Sea Bomber failed to start', error);
  renderFatalBootError(canvas, error);
});
