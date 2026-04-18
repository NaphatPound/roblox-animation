export interface FrameSlotPlan {
  start: number;
  step: number;
  frames: number[];
  lastFrame: number;
}

/**
 * Works out where image-to-animation should drop the `count` analyzed
 * keyframes along the timeline, starting at `currentFrame` instead of 0
 * so the user's playhead choice controls insertion.
 */
export function planImportFrames(
  count: number,
  currentFrame: number,
  fps: number
): FrameSlotPlan {
  const step = Math.max(1, Math.floor(fps / 4));
  const start = Math.max(0, Math.round(currentFrame));
  const frames = Array.from({ length: count }, (_, i) => start + i * step);
  const lastFrame = frames.length ? frames[frames.length - 1] : start;
  return { start, step, frames, lastFrame };
}
