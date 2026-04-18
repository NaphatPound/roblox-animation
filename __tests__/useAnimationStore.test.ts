import {
  useAnimationStore,
  DEFAULT_POSE,
  clonePose,
} from '../store/useAnimationStore';

function resetStore() {
  useAnimationStore.setState({
    keyframes: [{ id: 'initial', frame: 0, pose: clonePose(DEFAULT_POSE) }],
    totalFrames: 60,
    fps: 30,
    isPlaying: false,
    currentFrame: 0,
    loop: true,
    speed: 1,
    selectedPart: null,
  });
}

describe('useAnimationStore', () => {
  beforeEach(resetStore);

  it('has sensible defaults', () => {
    const state = useAnimationStore.getState();
    expect(state.totalFrames).toBe(60);
    expect(state.fps).toBe(30);
    expect(state.currentFrame).toBe(0);
    expect(state.keyframes).toHaveLength(1);
  });

  it('addKeyframe inserts a new keyframe sorted by frame', () => {
    const { addKeyframe } = useAnimationStore.getState();
    addKeyframe(30, DEFAULT_POSE);
    addKeyframe(10, DEFAULT_POSE);
    const { keyframes } = useAnimationStore.getState();
    expect(keyframes.map((k) => k.frame)).toEqual([0, 10, 30]);
  });

  it('addKeyframe replaces existing keyframe at same frame', () => {
    const { addKeyframe } = useAnimationStore.getState();
    addKeyframe(10, DEFAULT_POSE);
    addKeyframe(10, DEFAULT_POSE);
    const { keyframes } = useAnimationStore.getState();
    expect(keyframes.filter((k) => k.frame === 10)).toHaveLength(1);
  });

  it('removeKeyframe by id', () => {
    const { addKeyframe, removeKeyframe } = useAnimationStore.getState();
    addKeyframe(10, DEFAULT_POSE);
    const target = useAnimationStore
      .getState()
      .keyframes.find((k) => k.frame === 10);
    expect(target).toBeDefined();
    removeKeyframe(target!.id);
    expect(
      useAnimationStore.getState().keyframes.find((k) => k.frame === 10)
    ).toBeUndefined();
  });

  it('setCurrentFrame clamps to [0, totalFrames]', () => {
    const { setCurrentFrame } = useAnimationStore.getState();
    setCurrentFrame(-5);
    expect(useAnimationStore.getState().currentFrame).toBe(0);
    setCurrentFrame(1000);
    expect(useAnimationStore.getState().currentFrame).toBe(60);
  });

  it('play/pause/stop toggles playback state', () => {
    const { play, pause, stop } = useAnimationStore.getState();
    play();
    expect(useAnimationStore.getState().isPlaying).toBe(true);
    pause();
    expect(useAnimationStore.getState().isPlaying).toBe(false);
    useAnimationStore.setState({ currentFrame: 10, isPlaying: true });
    stop();
    expect(useAnimationStore.getState().isPlaying).toBe(false);
    expect(useAnimationStore.getState().currentFrame).toBe(0);
  });

  it('toggleLoop flips loop flag', () => {
    const initial = useAnimationStore.getState().loop;
    useAnimationStore.getState().toggleLoop();
    expect(useAnimationStore.getState().loop).toBe(!initial);
  });

  it('setSpeed clamps to [0.1, 4]', () => {
    const { setSpeed } = useAnimationStore.getState();
    setSpeed(10);
    expect(useAnimationStore.getState().speed).toBe(4);
    setSpeed(0);
    expect(useAnimationStore.getState().speed).toBe(0.1);
  });

  it('setFps clamps to [1, 120]', () => {
    const { setFps } = useAnimationStore.getState();
    setFps(0);
    expect(useAnimationStore.getState().fps).toBe(1);
    setFps(1000);
    expect(useAnimationStore.getState().fps).toBe(120);
  });

  it('setTotalFrames keeps currentFrame within range', () => {
    useAnimationStore.setState({ currentFrame: 50 });
    useAnimationStore.getState().setTotalFrames(30);
    expect(useAnimationStore.getState().totalFrames).toBe(30);
    expect(useAnimationStore.getState().currentFrame).toBe(30);
  });

  it('selectPart updates selection', () => {
    useAnimationStore.getState().selectPart('rightArm');
    expect(useAnimationStore.getState().selectedPart).toBe('rightArm');
    useAnimationStore.getState().selectPart(null);
    expect(useAnimationStore.getState().selectedPart).toBeNull();
  });

  it('updatePartRotation creates keyframe if missing', () => {
    useAnimationStore
      .getState()
      .updatePartRotation(15, 'rightArm', { x: 45, y: 0, z: -30 });
    const kf = useAnimationStore
      .getState()
      .keyframes.find((k) => k.frame === 15);
    expect(kf).toBeDefined();
    expect(kf!.pose.rightArm.rotation).toEqual({ x: 45, y: 0, z: -30 });
  });

  it('updatePartRotation updates existing keyframe', () => {
    useAnimationStore.getState().addKeyframe(20, DEFAULT_POSE);
    useAnimationStore
      .getState()
      .updatePartRotation(20, 'head', { x: 10, y: 20, z: 30 });
    const kf = useAnimationStore
      .getState()
      .keyframes.find((k) => k.frame === 20);
    expect(kf!.pose.head.rotation).toEqual({ x: 10, y: 20, z: 30 });
  });

  it('clearKeyframes restores initial state', () => {
    const { addKeyframe, clearKeyframes } = useAnimationStore.getState();
    addKeyframe(10, DEFAULT_POSE);
    addKeyframe(20, DEFAULT_POSE);
    clearKeyframes();
    const s = useAnimationStore.getState();
    expect(s.keyframes).toHaveLength(1);
    expect(s.currentFrame).toBe(0);
    expect(s.isPlaying).toBe(false);
  });
});

describe('clonePose', () => {
  it('creates an independent copy', () => {
    const copy = clonePose(DEFAULT_POSE);
    copy.head.rotation.x = 999;
    expect(DEFAULT_POSE.head.rotation.x).toBe(0);
  });
});
