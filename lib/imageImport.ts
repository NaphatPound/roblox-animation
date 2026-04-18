import type { AIPoseResult, AISource, Keyframe } from '@/types';
import { clonePose } from '@/lib/pose';
import { generateId } from '@/utils/mathUtils';

export type BatchSource = AISource | 'mixed';

export interface FrameSlotPlan {
  start: number;
  step: number;
  frames: number[];
  lastFrame: number;
}

/**
 * Collapse the set of backends seen in a batch into a single badge.
 *  - empty            → null (nothing analyzed yet)
 *  - one source       → that source
 *  - more than one    → 'mixed'
 * report04 #3 — batches that draw from both cloud and local must report
 * "mixed" instead of the last-written source.
 */
export function summariseSources(
  sources: Set<AISource>
): BatchSource | null {
  if (sources.size === 0) return null;
  if (sources.size === 1) return [...sources][0];
  return 'mixed';
}

/**
 * Decide the backend hint to pin for the remainder of a batch. If we've
 * already seen cloud fall through to local for any frame, keep the rest
 * on local — report04 #2, avoids repeating a cloud timeout per frame.
 */
export function pickBackendHint(
  current: 'local' | undefined,
  seen: AISource
): 'local' | undefined {
  if (current) return current;
  if (seen === 'local') return 'local';
  return undefined;
}

export interface BatchResult {
  keyframes: Keyframe[];
  sources: Set<AISource>;
  lastFrame: number;
}

/**
 * Pure image-batch orchestrator. Runs one analysis per slot, stages the
 * keyframes locally, and only returns them if EVERY analysis succeeded —
 * report04 #1. A mid-batch failure throws the per-frame error without
 * emitting any keyframes, so callers can commit to the store atomically.
 *
 * `analyze(index, hint)` is injected so this function can be tested
 * without React, fetch, or the DOM.
 */
export async function runImportBatch(
  plan: FrameSlotPlan,
  analyze: (
    index: number,
    hint: 'local' | undefined
  ) => Promise<AIPoseResult>,
  onProgress?: (pct: number) => void
): Promise<BatchResult> {
  const total = plan.frames.length;
  const staged: Keyframe[] = [];
  const sources = new Set<AISource>();
  let hint: 'local' | undefined = undefined;

  for (let i = 0; i < total; i++) {
    const result = await analyze(i, hint);
    if (result.source === 'fallback') {
      throw new Error(result.error || `frame ${i + 1} failed`);
    }
    sources.add(result.source);
    hint = pickBackendHint(hint, result.source);
    staged.push({
      id: generateId(),
      frame: plan.frames[i],
      pose: clonePose(result.pose),
    });
    if (onProgress) onProgress(Math.round(((i + 1) / total) * 100));
  }

  return { keyframes: staged, sources, lastFrame: plan.lastFrame };
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
