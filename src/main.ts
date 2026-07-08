import { VIEW_W, VIEW_H, WATERLINE } from './game/consts';

const canvas = document.getElementById('game') as HTMLCanvasElement;
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d')!;
ctx.fillStyle = '#3d6fd6';
ctx.fillRect(0, 0, VIEW_W, WATERLINE);
ctx.fillStyle = '#0b2a52';
ctx.fillRect(0, WATERLINE, VIEW_W, VIEW_H - WATERLINE);
