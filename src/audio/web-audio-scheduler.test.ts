import { expect, it } from 'vitest';
import { WebAudioMusicScheduler } from './web-audio-scheduler';

it('creates a looping source with the director supplied boundary and start time', () => {
  const starts: number[] = [];
  const source = {
    buffer: null as AudioBuffer | null,
    loop: false,
    loopEnd: 0,
    connect() {},
    start(at: number) { starts.push(at); },
    stop() {},
  };
  const gain = {
    gain: { value: 1, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} },
    connect() {},
  };
  const context = {
    currentTime: 2,
    createBufferSource: () => source,
    createGain: () => gain,
  } as unknown as AudioContext;
  const scheduler = new WebAudioMusicScheduler(context, { } as GainNode);
  const buffer = { duration: 60 } as AudioBuffer;

  scheduler.startLoop('bed', buffer, 2.05, 60);
  expect(source.buffer).toBe(buffer);
  expect({ loop: source.loop, loopEnd: source.loopEnd, starts }).toEqual({ loop: true, loopEnd: 60, starts: [2.05] });
});
