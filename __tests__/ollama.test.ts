import {
  extractJson,
  normalizePose,
  fallbackPoseFromPrompt,
} from '../lib/ollama';

describe('extractJson', () => {
  it('parses plain JSON', () => {
    const result = extractJson('{"foo": 1}');
    expect(result).toEqual({ foo: 1 });
  });

  it('parses fenced json block', () => {
    const result = extractJson('```json\n{"bar": 2}\n```');
    expect(result).toEqual({ bar: 2 });
  });

  it('parses fenced non-json block', () => {
    const result = extractJson('```\n{"baz": 3}\n```');
    expect(result).toEqual({ baz: 3 });
  });

  it('extracts JSON from surrounding prose', () => {
    const result = extractJson(
      'Here is your pose: {"qux": 4}\nThat should work.'
    );
    expect(result).toEqual({ qux: 4 });
  });

  it('throws when no JSON object present', () => {
    expect(() => extractJson('no json here')).toThrow();
  });
});

describe('normalizePose', () => {
  it('fills missing parts with defaults', () => {
    const pose = normalizePose({
      rightArm: { rotation: { x: 90, y: 0, z: -45 } },
    });
    expect(pose.rightArm.rotation).toEqual({ x: 90, y: 0, z: -45 });
    expect(pose.head.rotation).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('clamps rotation values out of range', () => {
    const pose = normalizePose({
      rightArm: { rotation: { x: 500, y: -500, z: 0 } },
    });
    expect(pose.rightArm.rotation.x).toBe(180);
    expect(pose.rightArm.rotation.y).toBe(-180);
  });

  it('handles invalid numbers as 0', () => {
    const pose = normalizePose({
      head: { rotation: { x: 'foo', y: null, z: undefined } },
    });
    expect(pose.head.rotation).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('handles non-object input gracefully', () => {
    const pose = normalizePose(null);
    expect(pose.head.rotation).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('fallbackPoseFromPrompt', () => {
  it('right punch throws the right arm forward (pitch around X)', () => {
    const pose = fallbackPoseFromPrompt('right hook punch');
    expect(pose.rightArm.rotation.x).toBe(-90);
    expect(pose.rightArm.rotation.z).toBe(0);
  });

  it('left punch throws the left arm forward', () => {
    const pose = fallbackPoseFromPrompt('left jab');
    expect(pose.leftArm.rotation.x).toBe(-90);
    expect(pose.rightArm.rotation.x).toBe(0);
  });

  it('running swings arms and legs opposite', () => {
    const pose = fallbackPoseFromPrompt('sprint fast');
    expect(pose.leftArm.rotation.x).not.toBe(0);
    expect(pose.rightArm.rotation.x).not.toBe(0);
    expect(Math.sign(pose.leftArm.rotation.x)).not.toBe(
      Math.sign(pose.rightArm.rotation.x)
    );
  });

  it('wave raises the right arm outward (positive Z)', () => {
    const pose = fallbackPoseFromPrompt('wave hello');
    expect(pose.rightArm.rotation.z).toBe(150);
  });

  it('left wave raises the left arm outward (negative Z)', () => {
    const pose = fallbackPoseFromPrompt('left wave');
    expect(pose.leftArm.rotation.z).toBe(-150);
  });

  it('kick rotates right leg forward by default', () => {
    const pose = fallbackPoseFromPrompt('roundhouse kick');
    expect(pose.rightLeg.rotation.x).toBe(-90);
  });

  it('t-pose spreads arms laterally', () => {
    const pose = fallbackPoseFromPrompt('t-pose');
    expect(pose.leftArm.rotation.z).toBe(-90);
    expect(pose.rightArm.rotation.z).toBe(90);
  });

  it('unknown prompt returns neutral pose', () => {
    const pose = fallbackPoseFromPrompt('foobar');
    expect(pose.head.rotation).toEqual({ x: 0, y: 0, z: 0 });
    expect(pose.rightArm.rotation).toEqual({ x: 0, y: 0, z: 0 });
  });
});
