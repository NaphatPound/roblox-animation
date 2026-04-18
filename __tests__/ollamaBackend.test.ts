import {
  planAttempts,
  resolveBackendMode,
  resolveTextModel,
  resolveVisionModel,
} from '../lib/ollama';

describe('resolveBackendMode (report03 #3)', () => {
  it('returns "auto" when unset', () => {
    expect(resolveBackendMode(undefined, true)).toBe('auto');
    expect(resolveBackendMode('', true)).toBe('auto');
  });

  it('returns "cloud" for explicit cloud', () => {
    expect(resolveBackendMode('cloud', true)).toBe('cloud');
    expect(resolveBackendMode('Cloud', true)).toBe('cloud');
  });

  it('returns "local" for explicit local', () => {
    expect(resolveBackendMode('local', false)).toBe('local');
  });

  it('falls back to "auto" for unrecognised values', () => {
    expect(resolveBackendMode('wat', true)).toBe('auto');
  });
});

describe('planAttempts (report03 #3 — cloud → local → fallback retry chain)', () => {
  it('auto with key tries cloud then local', () => {
    expect(planAttempts('auto', true)).toEqual(['cloud', 'local']);
  });

  it('auto without key skips cloud and only tries local', () => {
    expect(planAttempts('auto', false)).toEqual(['local']);
  });

  it('cloud with key tries only cloud', () => {
    expect(planAttempts('cloud', true)).toEqual(['cloud']);
  });

  it('cloud without a key produces an empty attempt list (caller should surface error)', () => {
    expect(planAttempts('cloud', false)).toEqual([]);
  });

  it('local always tries only local, key-independent', () => {
    expect(planAttempts('local', true)).toEqual(['local']);
    expect(planAttempts('local', false)).toEqual(['local']);
  });
});

describe('resolveTextModel / resolveVisionModel (report03 #2 — cloud defaults)', () => {
  it('text: cloud mode with no override defaults to a cloud-tagged model', () => {
    expect(resolveTextModel('cloud', undefined)).toMatch(/cloud$/);
  });

  it('text: local mode with no override defaults to a local-friendly model', () => {
    expect(resolveTextModel('local', undefined)).not.toMatch(/cloud$/);
  });

  it('text: explicit override wins in both modes', () => {
    expect(resolveTextModel('cloud', 'qwen3-coder:480b-cloud')).toBe(
      'qwen3-coder:480b-cloud'
    );
    expect(resolveTextModel('local', 'phi4:14b')).toBe('phi4:14b');
  });

  it('text: blank override is treated as unset', () => {
    expect(resolveTextModel('cloud', '   ')).toMatch(/cloud$/);
  });

  it('vision: cloud mode defaults to a cloud-tagged vision model (gemma4:31b-cloud by default)', () => {
    expect(resolveVisionModel('cloud', undefined)).toBe('gemma4:31b-cloud');
  });

  it('vision: local mode defaults to a local-friendly vision model', () => {
    expect(resolveVisionModel('local', undefined)).not.toMatch(/cloud$/);
  });

  it('vision: explicit override wins', () => {
    expect(resolveVisionModel('cloud', 'llava:34b-cloud')).toBe(
      'llava:34b-cloud'
    );
  });
});
