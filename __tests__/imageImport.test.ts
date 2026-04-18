import {
  planImportFrames,
  pickBackendHint,
  runImportBatch,
  summariseSources,
} from '../lib/imageImport';
import { DEFAULT_POSE, clonePose } from '../lib/pose';
import type { AIPoseResult, AISource } from '../types';

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

describe('summariseSources (report04 #3 — mixed-source display)', () => {
  const set = (...xs: AISource[]) => new Set<AISource>(xs);

  it('returns null for an empty set', () => {
    expect(summariseSources(set())).toBeNull();
  });

  it('returns the only source when exactly one was seen', () => {
    expect(summariseSources(set('cloud'))).toBe('cloud');
    expect(summariseSources(set('local'))).toBe('local');
  });

  it('returns "mixed" when the batch used more than one backend', () => {
    expect(summariseSources(set('cloud', 'local'))).toBe('mixed');
  });
});

describe('pickBackendHint (report04 #2 — stop repeating cloud failure per frame)', () => {
  it('sticks with the existing hint once it is set', () => {
    expect(pickBackendHint('local', 'cloud')).toBe('local');
    expect(pickBackendHint('local', 'local')).toBe('local');
    expect(pickBackendHint('local', 'fallback')).toBe('local');
  });

  it('pins to local the first time a frame comes from local (cloud fell through)', () => {
    expect(pickBackendHint(undefined, 'local')).toBe('local');
  });

  it('leaves the hint unset while frames are still succeeding on cloud', () => {
    expect(pickBackendHint(undefined, 'cloud')).toBeUndefined();
  });

  it('leaves the hint unset for a fallback source (caller aborts instead)', () => {
    expect(pickBackendHint(undefined, 'fallback')).toBeUndefined();
  });
});

describe('runImportBatch (report04 #1 — atomic commit, #2 — hint carry)', () => {
  const okResult = (source: AISource): AIPoseResult => ({
    pose: clonePose(DEFAULT_POSE),
    source,
  });

  const plan = (count: number) => planImportFrames(count, 0, 30);

  it('returns staged keyframes when every frame succeeds', async () => {
    const result = await runImportBatch(plan(3), async () =>
      okResult('cloud')
    );
    expect(result.keyframes).toHaveLength(3);
    expect(result.keyframes.map((k) => k.frame)).toEqual([0, 7, 14]);
    expect([...result.sources]).toEqual(['cloud']);
  });

  it('throws on the failing frame and never emits a keyframe (atomic commit)', async () => {
    const calls: number[] = [];
    const analyze = async (i: number): Promise<AIPoseResult> => {
      calls.push(i);
      if (i === 2) {
        return {
          pose: clonePose(DEFAULT_POSE),
          source: 'fallback',
          error: 'simulated cloud 403',
        };
      }
      return okResult('cloud');
    };
    await expect(runImportBatch(plan(5), analyze)).rejects.toThrow(
      /simulated cloud 403/
    );
    // First two frames tried, failure aborted the loop before frames 3-4.
    expect(calls).toEqual([0, 1, 2]);
  });

  it('passes the hint forward once a local frame is seen (stops repeating cloud)', async () => {
    const hints: Array<'local' | undefined> = [];
    const analyze = async (
      i: number,
      hint: 'local' | undefined
    ): Promise<AIPoseResult> => {
      hints.push(hint);
      // First frame falls through to local (cloud failed), rest stay local.
      return okResult('local');
    };
    await runImportBatch(plan(3), analyze);
    // The first call has no hint (batch just started). Later calls MUST
    // carry 'local' to skip cloud retry on every subsequent frame.
    expect(hints).toEqual([undefined, 'local', 'local']);
  });

  it('records mixed sources across frames (report04 #3 input)', async () => {
    let i = 0;
    const analyze = async (): Promise<AIPoseResult> => {
      const src: AISource = i++ === 0 ? 'cloud' : 'local';
      return okResult(src);
    };
    const result = await runImportBatch(plan(2), analyze);
    expect(summariseSources(result.sources)).toBe('mixed');
  });

  it('reports progress after every frame', async () => {
    const pct: number[] = [];
    await runImportBatch(
      plan(4),
      async () => okResult('cloud'),
      (p) => pct.push(p)
    );
    expect(pct).toEqual([25, 50, 75, 100]);
  });
});
