export interface Frame { x: number; y: number; w: number; h: number }

export interface Sheet {
  canvas: HTMLCanvasElement;
  frames: Record<string, Frame>;
}

/** Generate the pixel-art sprite sheet at boot. Palette honors the 2003 original
 * (yellow subs, deep blue sea) without copying its art. */
export function makeSheet(): Sheet {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const c = canvas.getContext('2d')!;
  const px = (x: number, y: number, w: number, h: number, col: string) => {
    c.fillStyle = col;
    c.fillRect(x, y, w, h);
  };

  // --- helicopter, 24x12, two rotor frames at (0,0) and (24,0), faces right
  for (let f = 0; f < 2; f++) {
    const ox = f * 24;
    px(ox + 4, 4, 13, 5, '#4a5d3a');        // fuselage
    px(ox + 15, 5, 7, 2, '#3c4b30');        // tail boom
    px(ox + 21, 3, 2, 4, '#3c4b30');        // tail fin
    px(ox + 6, 5, 4, 2, '#9fd8ff');         // canopy
    px(ox + 5, 9, 11, 1, '#2b3622');        // belly
    px(ox + 4, 10, 3, 1, '#222');           // skid
    px(ox + 12, 10, 3, 1, '#222');
    px(ox + 10, 2, 1, 2, '#222');           // rotor mast
    if (f === 0) px(ox + 2, 1, 17, 1, '#cccccc');   // rotor frame A
    else { px(ox + 6, 1, 9, 1, '#cccccc'); }        // rotor frame B (blur)
  }

  // --- subs 22x10 at y=16: patrol(0), hunter(24), missile(48)
  const subBody = (ox: number, hull: string, accent: string) => {
    px(ox + 1, 19, 20, 5, hull);            // hull
    px(ox + 0, 20, 1, 3, accent);           // nose
    px(ox + 21, 20, 1, 3, accent);          // tail
    px(ox + 8, 16, 4, 3, hull);             // conning tower
    px(ox + 9, 17, 2, 1, '#9fd8ff');        // porthole
    px(ox + 2, 21, 18, 1, accent);          // stripe
  };
  subBody(0, '#e8c832', '#a8891a');         // patrol: yellow
  subBody(24, '#e88232', '#a85a1a');        // hunter: orange
  subBody(48, '#b06ee0', '#7a3fa8');        // missile: violet

  // --- gunboat 26x12 at (72,16)
  px(74, 22, 22, 4, '#8a8f98');             // hull
  px(72, 23, 2, 2, '#6a6f78');
  px(80, 18, 8, 4, '#a8adb8');              // superstructure
  px(83, 16, 2, 2, '#6a6f78');              // gun
  px(74, 25, 22, 1, '#5a5f68');

  // --- mine 8x8 at (0,32)
  px(2, 34, 4, 4, '#39424e');
  px(3, 33, 2, 1, '#39424e');
  px(3, 38, 2, 1, '#39424e');
  px(1, 35, 1, 2, '#39424e');
  px(6, 35, 1, 2, '#39424e');
  px(3, 35, 1, 1, '#ff5544');               // detonator glint

  // --- depth charge 4x6 at (16,32)
  px(16, 32, 4, 5, '#5a6470');
  px(17, 37, 2, 1, '#3a424c');

  // --- torpedo 8x3 at (24,32) faces up when rotated by renderer; draw horizontal
  px(24, 33, 7, 2, '#d8dde4');
  px(31, 33, 1, 2, '#ff8844');

  // --- SAM 3x10 at (40,32) pointing up
  px(41, 32, 1, 2, '#ffcc66');
  px(40, 34, 3, 6, '#d8dde4');
  px(40, 40, 1, 2, '#8a8f98');
  px(42, 40, 1, 2, '#8a8f98');

  return {
    canvas,
    frames: {
      heli0:   { x: 0,  y: 0,  w: 24, h: 12 },
      heli1:   { x: 24, y: 0,  w: 24, h: 12 },
      patrol:  { x: 0,  y: 16, w: 22, h: 10 },
      hunter:  { x: 24, y: 16, w: 22, h: 10 },
      missile: { x: 48, y: 16, w: 22, h: 10 },
      gunboat: { x: 72, y: 16, w: 26, h: 12 },
      mine:    { x: 0,  y: 32, w: 8,  h: 8 },
      charge:  { x: 16, y: 32, w: 4,  h: 6 },
      torpedo: { x: 24, y: 32, w: 8,  h: 3 },
      sam:     { x: 40, y: 32, w: 3,  h: 10 },
    },
  };
}
