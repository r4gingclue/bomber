import { RENDER_H, RENDER_SCALE, RENDER_W } from './game/consts';
import { Loop } from './core/loop';
import { Input } from './core/input';
import { browserPrefersDefaultTouchUi } from './core/input-capabilities';
import { AudioSys } from './core/audio';
import { mulberry32 } from './core/rng';
import { World } from './game/world';
import { StateMachine } from './game/state';
import {
  completeWave,
  confirmUpgrades,
  createRun,
  previewUpgrades,
  type PostWaveView,
} from './game/post-wave';
import { RunProgression } from './game/run-progression';
import { UPGRADE_NODES, type UpgradeBranch, type UpgradeId } from './game/upgrade-tree';
import { Renderer } from './render/renderer';
import { aimFromStick } from './game/aim';
import { clientToWorld, fitViewport, type Insets } from './render/viewport';
import { GRAPHICS_MANIFEST, loadAssets } from './render/assets';
import { renderFatalBootError } from './render/fatal';
import { uiLayout, type UiLayout } from './render/ui-layout';
import { reducedMotionFlag } from './render/motion';
import { DevicePixelRatioMonitor, screenCanvasSize } from './render/screen-canvas';
import { QualityMonitor } from './render/quality';
import type {
  GraphicsCapture,
  GraphicsHarnessOptions,
  GraphicsHarnessScene,
  ProgressionHarnessFixture,
  ProgressionHarnessScene,
} from './testing/graphics-harness';
import type { HelicopterPose } from './render/helicopter';
import { AUDIO_MANIFEST } from './audio/manifest';
import { SoundBank } from './audio/sound-bank';
import { MusicDirector } from './audio/music-director';
import { WebAudioMusicScheduler } from './audio/web-audio-scheduler';
import { audioSettingsHit } from './render/audio-settings';
import {
  resultsControlAt,
  upgradeControlAt,
  upgradeLayout,
  type UpgradeLayout,
} from './render/upgrade-layout';
import { buildUpgradeTreeView } from './render/upgrade-view';
import { moveUpgradeFocus, type UpgradeFocus } from './core/upgrade-navigation';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiCanvas = document.getElementById('ui') as HTMLCanvasElement;
canvas.width = RENDER_W;
canvas.height = RENDER_H;
const ctx = canvas.getContext('2d')!;
const uiCtx = uiCanvas.getContext('2d')!;
ctx.scale(RENDER_SCALE, RENDER_SCALE);

function safeInsets(): Insets {
  if (harness.enabled && harness.safeInsets) return harness.safeInsets;
  const css = getComputedStyle(document.documentElement);
  const n = (name: string) => Number.parseFloat(css.getPropertyValue(name)) || 0;
  return { top: n('--sat'), right: n('--sar'), bottom: n('--sab'), left: n('--sal') };
}

let harness: GraphicsHarnessOptions = {
  enabled: false,
  touchUi: false,
  reducedMotion: false,
  damageFlash: false,
  pixelRatio: 0,
  freeze: false,
  record: false,
  snapshot: false,
};
const effectivePixelRatio = () => harness.pixelRatio || window.devicePixelRatio || 1;
let viewport = fitViewport(innerWidth, innerHeight, safeInsets());
let screenLayout: UiLayout = uiLayout(innerWidth, innerHeight, safeInsets(), true, viewport);
let screenInsets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
let input: Input | null = null;
const pixelRatioMonitor = new DevicePixelRatioMonitor(effectivePixelRatio());
function resize(): void {
  const insets = safeInsets();
  screenInsets = insets;
  viewport = fitViewport(innerWidth, innerHeight, insets);
  Object.assign(canvas.style, {
    position: 'fixed',
    left: `${viewport.x}px`,
    top: `${viewport.y}px`,
    width: `${viewport.width}px`,
    height: `${viewport.height}px`,
  });
  const pixelRatio = effectivePixelRatio();
  pixelRatioMonitor.changed(pixelRatio);
  const uiSize = screenCanvasSize(innerWidth, innerHeight, pixelRatio);
  uiCanvas.width = uiSize.backingWidth;
  uiCanvas.height = uiSize.backingHeight;
  Object.assign(uiCanvas.style, {
    width: `${uiSize.cssWidth}px`,
    height: `${uiSize.cssHeight}px`,
  });
  uiCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  screenLayout = uiLayout(innerWidth, innerHeight, insets, true, viewport);
  input?.setTouchControls({
    move: screenLayout.move,
    missile: screenLayout.missile,
    drop: screenLayout.drop,
    zoneSplitX: screenLayout.zoneSplitX,
  });
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
document.addEventListener('fullscreenchange', resize);
resize();

async function boot(): Promise<void> {
  let capture: GraphicsCapture | null = null;
  let captureOutput: HTMLTextAreaElement | null = null;
  let snapshotOutput: HTMLTextAreaElement | null = null;
  let captureComplete = false;
  let captureSnapshotHarness:
    ((
      gameCanvas: HTMLCanvasElement,
      uiCanvas: HTMLCanvasElement,
      width: number,
      height: number,
    ) => string) | null = null;
  let splitSnapshotHarness: ((snapshot: string) => string[]) | null = null;
  let stageHeavyCombatHarness: ((world: World) => void) | null = null;
  let stageVisualSceneHarness:
    ((
      world: World,
      scene: Extract<GraphicsHarnessScene, 'sea' | 'coast' | 'inland'>,
      pose?: HelicopterPose,
      facing?: 1 | -1,
    ) => void) | null = null;
  let stageProgressionSceneHarness:
    ((scene: ProgressionHarnessScene) => ProgressionHarnessFixture) | null = null;
  if (import.meta.env.DEV) {
    const graphicsHarness = await import('./testing/graphics-harness');
    harness = graphicsHarness.readGraphicsHarnessOptions(window.location.search, true);
    capture = new graphicsHarness.GraphicsCapture();
    captureSnapshotHarness = graphicsHarness.captureViewportFrame;
    splitSnapshotHarness = graphicsHarness.splitGraphicsSnapshot;
    stageHeavyCombatHarness = graphicsHarness.stageHeavyCombat;
    stageVisualSceneHarness = graphicsHarness.stageVisualScene;
    stageProgressionSceneHarness = graphicsHarness.stageProgressionScene;
    resize();
  }
  const assets = await loadAssets(GRAPHICS_MANIFEST);
  const activeInput = new Input();
  activeInput.touchSeen = browserPrefersDefaultTouchUi();
  input = activeInput;
  const audio = new AudioSys(undefined, undefined, {
    createBank: context => new SoundBank(
      AUDIO_MANIFEST,
      async url => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
        return response.arrayBuffer();
      },
      data => context.decodeAudioData(data),
    ),
    createDirector: (context, bus) => new MusicDirector(new WebAudioMusicScheduler(context, bus)),
  });
  document.addEventListener('visibilitychange', () => {
    void audio.setHidden(document.hidden);
  });
  let state = new StateMachine();
  const renderer = new Renderer(ctx, uiCtx, assets);
  const motion = reducedMotionFlag(window.matchMedia('(prefers-reduced-motion: reduce)'));
  const quality = new QualityMonitor();

  const initialRun = createRun(mulberry32(Date.now() >>> 0));
  let world = initialRun.world;
  let progression: RunProgression = initialRun.progression;
  let postWaveView: PostWaveView | null = null;
  let upgradeFocus: UpgradeFocus = { branch: 0, node: 0 };
  let elapsed = 0;
  let introT = 0;
  let harnessRestage = 0;
  let musicSampleT = 0;
  let creditsOpen = false;
  const upgradeBranches: readonly UpgradeBranch[] = ['weapons', 'ordnance', 'defense', 'flight'];

  const nodesForBranch = (branchIndex = upgradeFocus.branch) =>
    UPGRADE_NODES.filter(node => node.branch === upgradeBranches[branchIndex]);
  const focusedUpgradeId = (): UpgradeId | null =>
    nodesForBranch()[upgradeFocus.node]?.id ?? null;
  const progressionLayout = (): UpgradeLayout => upgradeLayout(
    innerWidth,
    innerHeight,
    screenInsets,
    upgradeBranches[upgradeFocus.branch],
    UPGRADE_NODES,
  );

  function discardPhaseQueues(): void {
    activeInput.discardPhaseQueues();
  }

  function focusBranch(branch: number): void {
    upgradeFocus = { branch, node: 0 };
  }

  function moveFocus(action: 'left' | 'right' | 'up' | 'down'): void {
    upgradeFocus = moveUpgradeFocus({
      ...upgradeFocus,
      nodeCounts: upgradeBranches.map((_, index) => nodesForBranch(index).length),
    }, action);
  }

  function changeFocusedUpgrade(action: 'purchase' | 'refund'): void {
    const id = focusedUpgradeId();
    if (!id) return;
    const changed = action === 'purchase'
      ? progression.purchase(id)
      : progression.refund(id);
    if (!changed) return;
    previewUpgrades(world, progression);
    audio.handle(action === 'purchase' ? 'upgrade-selected' : 'ui-confirm');
  }

  function acceptResults(): void {
    state.resultsAccepted();
    discardPhaseQueues();
    audio.handle('ui-confirm');
  }

  function startNextWave(): void {
    const actComplete = world.actComplete;
    confirmUpgrades(world, progression);
    state.upgradesConfirmed(actComplete);
    postWaveView = null;
    if (actComplete) {
      world.startAct();
      introT = 2;
    } else {
      world.startWave();
      audio.handle('wave-start');
    }
    discardPhaseQueues();
    audio.handle('ui-confirm');
  }

  function returnToMenu(): void {
    state.toMenu();
    discardPhaseQueues();
    audio.handle('ui-confirm');
  }

  activeInput.setTouchControls({
    move: screenLayout.move,
    missile: screenLayout.missile,
    drop: screenLayout.drop,
    zoneSplitX: screenLayout.zoneSplitX,
  });
  activeInput.attach(uiCanvas);
  activeInput.onGesture = () => {
    void audio.resume().then(() => audio.loadMusic());
  };
  activeInput.toCanvas = (clientX, clientY) => clientToWorld(clientX, clientY, viewport);
  activeInput.isGamePoint = (clientX, clientY) =>
    clientX >= viewport.x && clientX <= viewport.x + viewport.width
      && clientY >= viewport.y && clientY <= viewport.y + viewport.height;
  activeInput.onTap = (clientX, clientY) => {
    if (state.phase === 'menu') {
      const hit = audioSettingsHit(screenLayout.audio, { x: clientX, y: clientY });
      if (hit?.control === 'music') audio.setMusicVolume(hit.value);
      else if (hit?.control === 'sfx') audio.setSfxVolume(hit.value);
      else if (hit?.control === 'mute') audio.toggleMute();
      else if (hit?.control === 'credits') creditsOpen = !creditsOpen;
      else startRun();
      return true;
    }
    else if (state.phase === 'gameover') {
      returnToMenu();
      return true;
    } else if (state.phase === 'results') {
      if (resultsControlAt(progressionLayout(), { x: clientX, y: clientY })) acceptResults();
      return true;
    } else if (state.phase === 'upgrade') {
      const hit = upgradeControlAt(
        progressionLayout(),
        { x: clientX, y: clientY },
        progression.pending,
      );
      if (hit?.type === 'tab') focusBranch(hit.index);
      else if (hit?.type === 'purchase' || hit?.type === 'refund') {
        upgradeFocus = { branch: upgradeFocus.branch, node: hit.index };
        changeFocusedUpgrade(hit.type);
      } else if (hit?.type === 'continue') startNextWave();
      return true;
    }
    return state.phase !== 'playing';
  };

  function startRun(): void {
    const run = createRun(mulberry32(Date.now() >>> 0));
    world = run.world;
    progression = run.progression;
    postWaveView = null;
    upgradeFocus = { branch: 0, node: 0 };
    world.startWave();
    state.start();
    discardPhaseQueues();
    audio.handle('wave-start');
  }

  window.addEventListener('keydown', e => {
    if (e.code === 'KeyM') audio.toggleMute();
    if (e.code === 'KeyC' && state.phase === 'menu') creditsOpen = !creditsOpen;
    if (e.code === 'BracketLeft' && state.phase === 'menu') audio.setMusicVolume(audio.preferences.music - 0.1);
    if (e.code === 'BracketRight' && state.phase === 'menu') audio.setMusicVolume(audio.preferences.music + 0.1);
    if (e.code === 'Minus' && state.phase === 'menu') audio.setSfxVolume(audio.preferences.sfx - 0.1);
    if (e.code === 'Equal' && state.phase === 'menu') audio.setSfxVolume(audio.preferences.sfx + 0.1);
  });

  function update(dt: number): void {
    elapsed += dt;
    musicSampleT -= dt;
    if (musicSampleT <= 0) {
      musicSampleT = 0.1;
      const hostileShots = world.shots.filter(shot => shot.ptype !== 'bullet' && shot.ptype !== 'pmissile').length;
      audio.updateMusic({
        phase: state.phase,
        pressure: world.subs.length + hostileShots * 0.5,
        healthRatio: world.player.hp / world.stats.maxHp,
        muted: audio.muted,
        visible: !document.hidden,
      });
    }
    const intent = activeInput.poll();
    if (state.phase === 'menu' || state.phase === 'gameover') {
      if (state.phase === 'menu') {
        if (intent.drop) audio.toggleMute();
        if (intent.missile) audio.setMusicVolume((audio.preferences.music + 0.1) % 1.1);
        if (intent.sfxUp) audio.setSfxVolume((audio.preferences.sfx + 0.1) % 1.1);
      }
      if (activeInput.consumeConfirm()) {
        if (state.phase === 'gameover') returnToMenu();
        else startRun();
      }
      return;
    }
    if (state.phase === 'results') {
      const confirm = activeInput.consumeConfirm();
      const action = activeInput.consumeUpgradeAction();
      if (confirm || action === 'select' || action === 'continue') acceptResults();
      else if (action) discardPhaseQueues();
      return;
    }
    if (state.phase === 'upgrade') {
      const action = activeInput.consumeUpgradeAction();
      if (action === 'left' || action === 'right' || action === 'up' || action === 'down') {
        moveFocus(action);
      } else if (action === 'select') {
        changeFocusedUpgrade('purchase');
      } else if (action === 'refund') {
        changeFocusedUpgrade('refund');
      } else if (action === 'continue') {
        startNextWave();
      }
      if (action) discardPhaseQueues();
      return;
    }
    if (state.phase === 'actIntro') {
      introT -= dt;
      if (introT <= 0) {
        state.introDone();
        world.startWave();
        discardPhaseQueues();
        audio.handle('wave-start');
      }
      return;
    }
    // playing
    if (harness.scene && harness.freeze) return;
    if (harness.scene === 'heavy-combat') {
      harnessRestage -= dt;
      if (harnessRestage <= 0) {
        stageHeavyCombatHarness?.(world);
        harnessRestage = 0.1;
      }
    }
    const stickDir = activeInput.aimStickDir();
    if (stickDir) {
      intent.aim = aimFromStick(world.player.x, world.player.y, stickDir.dx, stickDir.dy);
    } else {
      const m = activeInput.aimCanvasPoint();
      if (m) intent.aim = { x: m.x + world.camX, y: m.y };
    }
    renderer.setTouchVisuals(activeInput.touchVisuals());
    world.update(dt, intent);
    for (const ev of world.events) audio.handle(ev);
    world.events.length = 0;
    if (world.player.hp <= 0) {
      state.died();
      progression.reset();
      previewUpgrades(world, progression);
      postWaveView = null;
      discardPhaseQueues();
      return;
    }
    if (world.cleared) {
      postWaveView = completeWave(world, progression);
      state.waveCleared();
      discardPhaseQueues();
      audio.handle('wave-clear');
    }
  }

  function stageProgressionHarnessView(scene: ProgressionHarnessScene): void {
    const fixture = stageProgressionSceneHarness?.(scene);
    if (!fixture) return;
    const run = createRun(mulberry32(0x5ea));
    world = run.world;
    progression = fixture.progression;
    postWaveView = fixture.postWaveView;
    previewUpgrades(world, progression);
    upgradeFocus = {
      branch: upgradeBranches.indexOf(fixture.branch),
      node: UPGRADE_NODES
        .filter(node => node.branch === fixture.branch)
        .findIndex(node => node.id === fixture.focusedNode),
    };
    state = new StateMachine();
    state.start();
    state.waveCleared();
    if (scene === 'upgrade-tree') state.resultsAccepted();
    discardPhaseQueues();
  }

  if (harness.enabled) {
    const stage = (scene: NonNullable<typeof harness.scene>) => {
      if (scene === 'heavy-combat') stageHeavyCombatHarness?.(world);
      else if (scene === 'results' || scene === 'upgrade-tree') stageProgressionHarnessView(scene);
      else stageVisualSceneHarness?.(world, scene, harness.playerPose, harness.playerFacing);
    };
    (window as unknown as {
      __seaBomberHarness: {
        options: typeof harness;
        getWorld: () => World;
        getTier: () => typeof quality.tier;
        capture: GraphicsCapture;
        exportCsv: () => string;
        stage: typeof stage;
      };
    }).__seaBomberHarness = {
      options: harness,
      getWorld: () => world,
      getTier: () => quality.tier,
      capture: capture!,
      exportCsv: () => capture!.toCsv(),
      stage,
    };
    document.documentElement.dataset.graphicsHarnessReady = '1';
    if (harness.record) {
      captureOutput = document.createElement('textarea');
      captureOutput.id = 'sea-bomber-capture-csv';
      captureOutput.hidden = true;
      captureOutput.dataset.ready = '0';
      captureOutput.dataset.elapsedMs = '0';
      document.body.append(captureOutput);
    }
    if (harness.snapshot) {
      snapshotOutput = document.createElement('textarea');
      snapshotOutput.id = 'sea-bomber-snapshot-data';
      snapshotOutput.hidden = true;
      snapshotOutput.dataset.ready = '0';
      document.body.append(snapshotOutput);
    }
  }

  if (harness.scene) {
    if (harness.scene === 'results' || harness.scene === 'upgrade-tree') {
      stageProgressionHarnessView(harness.scene);
    } else {
      startRun();
      if (harness.scene === 'heavy-combat') stageHeavyCombatHarness?.(world);
      else stageVisualSceneHarness?.(
        world,
        harness.scene,
        harness.playerPose,
        harness.playerFacing,
      );
    }
  }

  const loop = new Loop(
    dt => update(dt),
    (_alpha, deliveredFrameMs) => {
      if (pixelRatioMonitor.changed(effectivePixelRatio())) resize();
      const renderTier = harness.qualityTier ?? quality.tier;
      const renderStart = performance.now();
      const branch = upgradeBranches[upgradeFocus.branch];
      const overlayLayout = state.phase === 'results' || state.phase === 'upgrade'
        ? progressionLayout()
        : undefined;
      renderer.draw(
        world,
        state.phase,
        elapsed,
        activeInput.touchSeen || harness.touchUi,
        renderTier,
        screenLayout,
        motion.value || harness.reducedMotion,
        harness.damageFlash,
        {
          music: audio.preferences.music,
          sfx: audio.preferences.sfx,
          muted: audio.muted,
          creditsOpen,
        },
        {
          points: progression.points,
          layout: overlayLayout,
          results: state.phase === 'results' ? postWaveView ?? undefined : undefined,
          tree: state.phase === 'upgrade'
            ? buildUpgradeTreeView(progression, branch, focusedUpgradeId())
            : undefined,
        },
      );
      const renderEnd = performance.now();
      if (
        snapshotOutput?.dataset.ready === '0'
        && captureSnapshotHarness
        && splitSnapshotHarness
      ) {
        const snapshot = captureSnapshotHarness(
          canvas,
          uiCanvas,
          innerWidth,
          innerHeight,
        );
        const chunks = splitSnapshotHarness(snapshot);
        for (let index = 0; index < chunks.length; index++) {
          const chunk = document.createElement('textarea');
          chunk.id = `sea-bomber-snapshot-chunk-${index}`;
          chunk.hidden = true;
          chunk.value = chunks[index];
          document.body.append(chunk);
        }
        snapshotOutput.dataset.chunks = String(chunks.length);
        snapshotOutput.dataset.ready = '1';
      }
      quality.sample(deliveredFrameMs);
      if (harness.record && capture) {
        capture.record(
          performance.timeOrigin + renderEnd,
          deliveredFrameMs,
          renderEnd - renderStart,
          renderTier,
        );
        if (captureOutput) {
          captureOutput.dataset.elapsedMs = capture.elapsedMs().toFixed(3);
          if (!captureComplete && capture.hasDuration(600_000)) {
            captureComplete = true;
            captureOutput.value = capture.toCsv();
            captureOutput.dataset.ready = '1';
          }
        }
      }
    },
  );
  loop.start();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      activeInput.resetTransient();
      quality.reset();
      loop.stop();
    } else {
      resize();
      loop.start();
    }
  });
}

void boot().catch(error => {
  console.error('Sea Bomber failed to start', error);
  renderFatalBootError(canvas, error);
});
