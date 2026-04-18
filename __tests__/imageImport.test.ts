import { planImportFrames } from '../lib/imageImport';

describe('planImportFrames (report02 #2 — image import honors currentFrame)', () => {
  it('starts at frame 0 when playhead is 0', () => {
    const plan = planImportFrames(3, 0, 30);
    expect(plan.start).toBe(0);
    expect(plan.step).toBe(7); // floor(30/4)
    expect(plan.frames).toEqual([0, 7, 14]);
    expect(plan.lastFrame).toBe(14);
  });

  it('inserts at currentFrame, currentFrame+step, currentFrame+2*step (exact repro from report)', () => {
    const plan = planImportFrames(3, 30, 30);
    expect(plan.start).toBe(30);
    expect(plan.frames).toEqual([30, 37, 44]);
  });

  it('rounds non-integer currentFrame', () => {
    const plan = planImportFrames(2, 12.4, 30);
    expect(plan.start).toBe(12);
    expect(plan.frames).toEqual([12, 19]);
  });

  it('clamps a negative currentFrame to 0', () => {
    const plan = planImportFrames(2, -5, 30);
    expect(plan.start).toBe(0);
  });

  it('uses step=1 minimum for very low fps', () => {
    const plan = planImportFrames(3, 10, 2);
    expect(plan.step).toBe(1);
    expect(plan.frames).toEqual([10, 11, 12]);
  });

  it('lastFrame == start for a single image', () => {
    const plan = planImportFrames(1, 40, 30);
    expect(plan.frames).toEqual([40]);
    expect(plan.lastFrame).toBe(40);
  });

  it('empty input returns an empty frame list', () => {
    const plan = planImportFrames(0, 20, 30);
    expect(plan.frames).toEqual([]);
    expect(plan.lastFrame).toBe(20);
  });
});
