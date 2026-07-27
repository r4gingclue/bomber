export interface Frame { x: number; y: number; w: number; h: number }

export interface Sheet {
  canvas: HTMLCanvasElement;
  frames: Record<string, Frame>;
}

/** Generate the pixel-art sprite sheet at boot. Palette honors the 2003 original
 * (yellow subs, deep blue sea) without copying its art. */
export function makeSheet(): Sheet {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 96;
  const c = canvas.getContext('2d')!;
  const px = (x: number, y: number, w: number, h: number, col: string) => {
    c.fillStyle = col;
    c.fillRect(x, y, w, h);
  };

  // --- helicopter 32x16, rows = bank (0 level, 1 lean, 2 hard), cols = rotor frame
  // Nose on the RIGHT: renderer draws unflipped when facing = 1 (rightward).
  const heli = (ox: number, oy: number, bank: number, rotor: number) => {
    const n = bank;        // nose dips with bank
    const t = -bank;       // tail rises with bank
    px(ox + 3, oy + 7 + t, 9, 2, '#3c4b30');        // tail boom
    px(ox + 2, oy + 4 + t, 2, 5, '#3c4b30');        // tail fin
    px(ox + 0, oy + 5 + t, 2, 1, '#5a6d48');        // tail rotor
    px(ox + 11, oy + 6, 16, 6, '#4a5d3a');          // fuselage
    px(ox + 11, oy + 6, 16, 2, '#5f7549');          // top highlight
    px(ox + 24, oy + 8 + n, 4, 3, '#3c4b30');       // gunner nose
    px(ox + 19, oy + 6, 6, 3, '#9fd8ff');           // canopy
    px(ox + 22, oy + 7, 2, 1, '#e8f6ff');           // canopy glint
    px(ox + 12, oy + 11, 14, 1, '#2b3622');         // belly
    px(ox + 14, oy + 10, 7, 2, '#3c4b30');          // stub wings
    px(ox + 22, oy + 13, 4, 1, '#222222');          // skids
    px(ox + 13, oy + 13, 4, 1, '#222222');
    px(ox + 23, oy + 12, 1, 1, '#222222');
    px(ox + 15, oy + 12, 1, 1, '#222222');
    px(ox + 18, oy + 3, 2, 3, '#222222');           // rotor mast
    if (rotor === 0) px(ox + 8, oy + 2, 22, 1, '#cccccc');
    else px(ox + 12, oy + 2, 14, 1, 'rgba(220,220,220,0.6)');
  };
  for (let bank = 0; bank < 3; bank++) {
    for (let rotor = 0; rotor < 2; rotor++) heli(rotor * 32, bank * 16, bank, rotor);
  }

  // --- chin turret 8x4 at (64,0); pivot drawn at (66,2), barrel points right
  px(64, 0, 3, 4, '#39424e');
  px(67, 1, 5, 2, '#222831');

  // --- subs 26x12 at y=48: patrol(0), hunter(28), missile(56)
  const sub = (ox: number, hi: string, mid: string, lo: string, accent: string) => {
    const oy = 48;
    px(ox + 1, oy + 4, 24, 6, mid);           // hull
    px(ox + 2, oy + 4, 22, 2, hi);            // top highlight
    px(ox + 2, oy + 8, 22, 2, lo);            // bottom shadow
    px(ox + 25, oy + 5, 1, 4, accent);        // nose cap (right: faces travel dir)
    px(ox + 0, oy + 5, 1, 4, accent);         // tail cap
    px(ox + 0, oy + 2, 2, 2, accent);         // rudder
    px(ox + 11, oy + 0, 6, 4, mid);           // conning tower
    px(ox + 13, oy + 1, 3, 2, '#9fd8ff');     // window
    px(ox + 18, oy + 0, 1, 3, accent);        // periscope
    px(ox + 3, oy + 6, 20, 1, accent);        // stripe
  };
  sub(0,  '#f5dd6a', '#e8c832', '#b09420', '#8a7014');
  sub(28, '#f5a55a', '#e88232', '#b0611f', '#8a4a12');
  sub(56, '#cf92ee', '#b06ee0', '#8449ad', '#5f3380');

  // --- gunboat 30x14 at (84,48)
  const gx = 84, gy = 48;
  px(gx + 1, gy + 8, 28, 4, '#8a8f98');       // hull
  px(gx + 2, gy + 8, 26, 1, '#b8bdc8');       // deck highlight
  px(gx + 0, gy + 9, 1, 2, '#6a6f78');        // bow
  px(gx + 8, gy + 3, 10, 5, '#a8adb8');       // superstructure
  px(gx + 10, gy + 4, 3, 2, '#3d5a7a');       // bridge window
  px(gx + 20, gy + 5, 6, 3, '#7a7f88');       // aft mount
  px(gx + 21, gy + 2, 2, 3, '#555a63');       // turret
  px(gx + 23, gy + 3, 5, 1, '#31363f');       // barrel
  px(gx + 1, gy + 12, 28, 1, '#5a5f68');      // waterline shadow

  // --- mine 10x10 at (120,0)
  const mx = 120, my = 0;
  px(mx + 3, my + 3, 4, 4, '#39424e');
  px(mx + 4, my + 2, 2, 1, '#4a5560');
  px(mx + 4, my + 0, 2, 2, '#2b333d');
  px(mx + 4, my + 8, 2, 2, '#2b333d');
  px(mx + 0, my + 4, 2, 2, '#2b333d');
  px(mx + 8, my + 4, 2, 2, '#2b333d');
  px(mx + 1, my + 1, 2, 2, '#2b333d');
  px(mx + 7, my + 1, 2, 2, '#2b333d');
  px(mx + 1, my + 7, 2, 2, '#2b333d');
  px(mx + 7, my + 7, 2, 2, '#2b333d');
  px(mx + 4, my + 4, 2, 2, '#ff5544');        // light (renderer blinks over it)

  // --- torpedo 10x4 at (132,0)
  px(132, 1, 8, 2, '#d8dde4');
  px(140, 1, 2, 2, '#ff8844');
  px(132, 0, 3, 1, '#8a8f98');
  px(132, 3, 3, 1, '#8a8f98');

  // --- SAM 4x12 at (144,0), pointing up
  px(145, 0, 2, 3, '#ffcc66');
  px(144, 3, 4, 7, '#d8dde4');
  px(144, 10, 1, 2, '#8a8f98');
  px(147, 10, 1, 2, '#8a8f98');
  px(145, 10, 2, 2, '#ff8844');

  // --- depth charge 4x6 at (152,0)
  px(152, 0, 4, 5, '#5a6470');
  px(153, 0, 2, 1, '#7a8492');
  px(153, 5, 2, 1, '#3a424c');

  // --- enemy choppers at y=64: scout 14x8 (0,64), gunship 24x12 (16,64), mchopper 22x12 (44,64)
  // scout: tiny drone, red accent
  px(2, 68, 10, 3, '#7a3f3f');
  px(4, 67, 4, 1, '#9a5a5a');
  px(1, 66, 12, 1, '#cccccc');      // rotor
  px(11, 69, 2, 1, '#ff5544');      // tail light
  // gunship: dark green attack heli, nose right
  px(18, 69, 14, 5, '#3f5138');
  px(28, 70, 4, 3, '#2e3c29');      // nose
  px(26, 69, 4, 2, '#88aacc');      // canopy
  px(16, 70, 4, 2, '#2e3c29');      // tail
  px(17, 66, 12, 1, '#cccccc');     // rotor
  px(20, 74, 8, 1, '#222222');      // skid
  // mchopper: grey with missile pods, nose right
  px(46, 69, 12, 5, '#5a6068');
  px(56, 70, 4, 3, '#464c54');      // nose
  px(54, 69, 3, 2, '#88aacc');      // canopy
  px(44, 70, 4, 2, '#464c54');      // tail
  px(45, 66, 11, 1, '#cccccc');     // rotor
  px(48, 74, 3, 2, '#31363f');      // pod L
  px(53, 74, 3, 2, '#31363f');      // pod R
  // --- ground at y=80: aagun 12x8 (0,80), tank 18x10 (16,80)
  px(2, 84, 8, 3, '#6a6f78');       // aagun base
  px(5, 81, 2, 4, '#464c54');       // mount
  px(6, 80, 5, 1, '#31363f');       // barrel (up-right)
  px(18, 84, 14, 4, '#55603f');     // tank hull
  px(21, 81, 7, 3, '#48522f');      // turret
  px(27, 82, 6, 1, '#31363f');      // barrel
  px(18, 88, 14, 1, '#222222');     // tracks
  // --- player missile 6x2 at (68,64)
  px(68, 64, 5, 2, '#e8eef4');
  px(73, 64, 1, 2, '#ffcc66');

  return {
    canvas,
    frames: {
      heli00: { x: 0,  y: 0,  w: 32, h: 16 },
      heli01: { x: 32, y: 0,  w: 32, h: 16 },
      heli10: { x: 0,  y: 16, w: 32, h: 16 },
      heli11: { x: 32, y: 16, w: 32, h: 16 },
      heli20: { x: 0,  y: 32, w: 32, h: 16 },
      heli21: { x: 32, y: 32, w: 32, h: 16 },
      turret: { x: 64, y: 0,  w: 8,  h: 4 },
      patrol: { x: 0,  y: 48, w: 26, h: 12 },
      hunter: { x: 28, y: 48, w: 26, h: 12 },
      missile:{ x: 56, y: 48, w: 26, h: 12 },
      gunboat:{ x: 84, y: 48, w: 30, h: 14 },
      mine:   { x: 120, y: 0, w: 10, h: 10 },
      torpedo:{ x: 132, y: 0, w: 10, h: 4 },
      sam:    { x: 144, y: 0, w: 4,  h: 12 },
      charge: { x: 152, y: 0, w: 4,  h: 6 },
      scout:    { x: 0,  y: 64, w: 14, h: 8 },
      gunship:  { x: 16, y: 64, w: 24, h: 12 },
      mchopper: { x: 44, y: 64, w: 22, h: 12 },
      aagun:    { x: 0,  y: 80, w: 12, h: 8 },
      tank:     { x: 16, y: 80, w: 18, h: 10 },
      pmissile: { x: 68, y: 64, w: 6,  h: 2 },
    },
  };
}
