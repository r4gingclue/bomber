import { RENDER_H, RENDER_SCALE, RENDER_W } from './game/consts';
import { Loop } from './core/loop';
import { Input } from './core/input';
import { AudioSys } from './core/audio';
import { mulberry32 } from './core/rng';
import { World } from './game/world';
import { StateMachine } from './game/state';
import { drawCards, type UpgradeCard } from './game/upgrades';
import { makeSheet } from './render/sprites';
import { Renderer } from './render/renderer';
import { aimFromStick } from './game/aim';
import { clientToWorld, fitViewport, type Insets } from './render/viewport';
import { GRAPHICS_MANIFEST, loadAssets } from './render/assets';
import { renderFatalBootError } from './render/fatal';
import { uiLayout, type UiLayout } from './render/ui-layout';
import { reducedMotionFlag } from './render/motion';
import { screenCanvasSize } from './render/screen-canvas';
import { QualityMonitor } from './render/quality';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiCanvas = document.getElementById('ui') as HTMLCanvasElement;
canvas.width = RENDER_W;
canvas.height = RENDER_H;
const ctx = canvas.getContext('2d')!;
const uiCtx = uiCanvas.getContext('2d')!;
ctx.scale(RENDER_SCALE, RENDER_SCALE);

function safeInsets(): Insets {
  const css = getComputedStyle(document.documentElement);
  const n = (name: string) => Number.parseFloat(css.getPropertyValue(name)) || 0;
  return { top: n('--sat'), right: n('--sar'), bottom: n('--sab'), left: n('--sal') };
}

let viewport = fitViewport(innerWidth, innerHeight, safeInsets());
let screenLayout: UiLayout = uiLayout(innerWidth, innerHeight, safeInsets(), true);
let input: Input | null = null;
const debugParams = (import.meta as { env?: { DEV?: boolean } }).env?.DEV
  ? new URLSearchParams(window.location.search)
  : null;
const debugTouchUi = debugParams?.has('touch-ui') ?? false;
const debugReducedMotion = debugParams?.has('reduced-motion') ?? false;
const debugDamageFlash = debugParams?.has('damage-flash') ?? false;
const debugPixelRatio = Number(debugParams?.get('dpr')) || 0;
function resize(): void {
  viewport = fitViewport(innerWidth, innerHeight, safeInsets());
  Object.assign(canvas.style, {
    position: 'fixed',
    left: `${viewport.x}px`,
    top: `${viewport.y}px`,
    width: `${viewport.width}px`,
    height: `${viewport.height}px`,
  });
  const pixelRatio = debugPixelRatio || window.devicePixelRatio || 1;
  const uiSize = screenCanvasSize(innerWidth, innerHeight, pixelRatio);
  uiCanvas.width = uiSize.backingWidth;
  uiCanvas.height = uiSize.backingHeight;
  Object.assign(uiCanvas.style, {
    width: `${uiSize.cssWidth}px`,
    height: `${uiSize.cssHeight}px`,
  });
  uiCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  screenLayout = uiLayout(innerWidth, innerHeight, safeInsets(), true);
  input?.setTouchControls({ move: screenLayout.move, fire: screenLayout.fire, drop: screenLayout.drop });
}
window.addEventListener('resize', resize);
resize();

async function boot(): Promise<void> {
  const assets = await loadAssets(GRAPHICS_MANIFEST);
  const activeInput = new Input();
  input = activeInput;
  const audio = new AudioSys();
  const state = new StateMachine();
  const renderer = new Renderer(ctx, uiCtx, makeSheet(), assets);
  const motion = reducedMotionFlag(window.matchMedia('(prefers-reduced-motion: reduce)'));
  const quality = new QualityMonitor();

  let world = new World(mulberry32(Date.now() >>> 0));
  let cards: UpgradeCard[] = [];
  let elapsed = 0;
  let introT = 0;

  activeInput.setTouchControls({ move: screenLayout.move, fire: screenLayout.fire, drop: screenLayout.drop });
  activeInput.attach(uiCanvas);
  activeInput.onGesture = () => audio.resume();
  activeInput.toCanvas = (clientX, clientY) => clientToWorld(clientX, clientY, viewport);
  activeInput.isGamePoint = (clientX, clientY) =>
    clientX >= viewport.x && clientX <= viewport.x + viewport.width
      && clientY >= viewport.y && clientY <= viewport.y + viewport.height;
  activeInput.onTap = (clientX, clientY) => {
    if (state.phase === 'menu') startRun();
    else if (state.phase === 'gameover') {
      state.toMenu();
      audio.handle('ui');
    } else if (state.phase === 'upgrade') {
      cards.forEach((_, i) => {
        const r = screenLayout.cards[i];
        if (clientX >= r.x && clientX <= r.x + r.w && clientY >= r.y && clientY <= r.y + r.h) pickCard(i);
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
      if (activeInput.consumeConfirm()) {
        if (state.phase === 'gameover') { state.toMenu(); audio.handle('ui'); }
        else startRun();
      }
      activeInput.poll(); // drain queued edges
      return;
    }
    if (state.phase === 'upgrade') {
      const k = activeInput.consumeCardKey();
      if (k >= 0) pickCard(k);
      activeInput.poll();
      return;
    }
    if (state.phase === 'actIntro') {
      introT -= dt;
      activeInput.poll();
      if (introT <= 0) {
        state.introDone();
        world.startWave();
      }
      return;
    }
    // playing
    const intent = activeInput.poll();
    const stickDir = activeInput.aimStickDir();
    if (stickDir) {
      intent.aim = aimFromStick(world.player.x, world.player.y, stickDir.dx, stickDir.dy);
    } else {
      const m = activeInput.aimCanvasPoint();
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
    () => {
      const renderStart = performance.now();
      renderer.draw(
        world,
        state.phase,
        cards,
        elapsed,
        activeInput.touchSeen || debugTouchUi,
        quality.tier,
        screenLayout,
        motion.value || debugReducedMotion,
        debugDamageFlash,
      );
      quality.sample(performance.now() - renderStart);
    },
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
