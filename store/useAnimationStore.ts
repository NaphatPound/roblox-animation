import { create } from 'zustand';
import type {
  Keyframe,
  R6Pose,
  R6PartName,
  PlaybackState,
  Vec3,
} from '@/types';
import { generateId } from '@/utils/mathUtils';

export const DEFAULT_POSE: R6Pose = {
  head: { rotation: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 2.5, z: 0 } },
  torso: { rotation: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 1.2, z: 0 } },
  leftArm: { rotation: { x: 0, y: 0, z: 0 }, position: { x: -1.2, y: 1.2, z: 0 } },
  rightArm: { rotation: { x: 0, y: 0, z: 0 }, position: { x: 1.2, y: 1.2, z: 0 } },
  leftLeg: { rotation: { x: 0, y: 0, z: 0 }, position: { x: -0.4, y: -0.5, z: 0 } },
  rightLeg: { rotation: { x: 0, y: 0, z: 0 }, position: { x: 0.4, y: -0.5, z: 0 } },
};

export function clonePose(pose: R6Pose): R6Pose {
  return {
    head: {
      rotation: { ...pose.head.rotation },
      position: pose.head.position ? { ...pose.head.position } : undefined,
    },
    torso: {
      rotation: { ...pose.torso.rotation },
      position: pose.torso.position ? { ...pose.torso.position } : undefined,
    },
    leftArm: {
      rotation: { ...pose.leftArm.rotation },
      position: pose.leftArm.position ? { ...pose.leftArm.position } : undefined,
    },
    rightArm: {
      rotation: { ...pose.rightArm.rotation },
      position: pose.rightArm.position ? { ...pose.rightArm.position } : undefined,
    },
    leftLeg: {
      rotation: { ...pose.leftLeg.rotation },
      position: pose.leftLeg.position ? { ...pose.leftLeg.position } : undefined,
    },
    rightLeg: {
      rotation: { ...pose.rightLeg.rotation },
      position: pose.rightLeg.position ? { ...pose.rightLeg.position } : undefined,
    },
  };
}

interface AnimationState extends PlaybackState {
  keyframes: Keyframe[];
  totalFrames: number;
  fps: number;
  selectedPart: R6PartName | null;

  addKeyframe: (frame: number, pose: R6Pose) => void;
  removeKeyframe: (id: string) => void;
  updateKeyframePose: (id: string, pose: R6Pose) => void;
  moveKeyframe: (id: string, newFrame: number) => void;
  clearKeyframes: () => void;

  setCurrentFrame: (frame: number) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  toggleLoop: () => void;
  setSpeed: (speed: number) => void;

  setTotalFrames: (frames: number) => void;
  setFps: (fps: number) => void;

  selectPart: (part: R6PartName | null) => void;
  updatePartRotation: (frame: number, part: R6PartName, rotation: Vec3) => void;
}

function findOrCreateKeyframe(
  keyframes: Keyframe[],
  frame: number,
  basePose: R6Pose
): { keyframes: Keyframe[]; target: Keyframe } {
  const existing = keyframes.find((kf) => kf.frame === frame);
  if (existing) {
    return { keyframes, target: existing };
  }
  const newKf: Keyframe = {
    id: generateId(),
    frame,
    pose: clonePose(basePose),
  };
  return { keyframes: [...keyframes, newKf], target: newKf };
}

export const useAnimationStore = create<AnimationState>((set, get) => ({
  keyframes: [
    { id: 'initial', frame: 0, pose: clonePose(DEFAULT_POSE) },
  ],
  totalFrames: 60,
  fps: 30,
  isPlaying: false,
  currentFrame: 0,
  loop: true,
  speed: 1,
  selectedPart: null,

  addKeyframe: (frame, pose) => {
    set((state) => {
      const filtered = state.keyframes.filter((kf) => kf.frame !== frame);
      const newKf: Keyframe = {
        id: generateId(),
        frame,
        pose: clonePose(pose),
      };
      return {
        keyframes: [...filtered, newKf].sort((a, b) => a.frame - b.frame),
      };
    });
  },

  removeKeyframe: (id) => {
    set((state) => ({
      keyframes: state.keyframes.filter((kf) => kf.id !== id),
    }));
  },

  updateKeyframePose: (id, pose) => {
    set((state) => ({
      keyframes: state.keyframes.map((kf) =>
        kf.id === id ? { ...kf, pose: clonePose(pose) } : kf
      ),
    }));
  },

  moveKeyframe: (id, newFrame) => {
    set((state) => ({
      keyframes: state.keyframes
        .map((kf) => (kf.id === id ? { ...kf, frame: newFrame } : kf))
        .sort((a, b) => a.frame - b.frame),
    }));
  },

  clearKeyframes: () => {
    set({
      keyframes: [{ id: 'initial', frame: 0, pose: clonePose(DEFAULT_POSE) }],
      currentFrame: 0,
      isPlaying: false,
    });
  },

  setCurrentFrame: (frame) => {
    const { totalFrames } = get();
    const clamped = Math.max(0, Math.min(frame, totalFrames));
    set({ currentFrame: clamped });
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  stop: () => set({ isPlaying: false, currentFrame: 0 }),
  toggleLoop: () => set((state) => ({ loop: !state.loop })),
  setSpeed: (speed) => set({ speed: Math.max(0.1, Math.min(speed, 4)) }),

  setTotalFrames: (frames) => {
    const clamped = Math.max(1, frames);
    set((state) => ({
      totalFrames: clamped,
      currentFrame: Math.min(state.currentFrame, clamped),
    }));
  },

  setFps: (fps) => set({ fps: Math.max(1, Math.min(fps, 120)) }),

  selectPart: (part) => set({ selectedPart: part }),

  updatePartRotation: (frame, part, rotation) => {
    set((state) => {
      const basePose =
        state.keyframes.find((kf) => kf.frame === frame)?.pose ||
        state.keyframes[0]?.pose ||
        DEFAULT_POSE;
      const { keyframes, target } = findOrCreateKeyframe(
        state.keyframes,
        frame,
        basePose
      );
      const updated = keyframes.map((kf) =>
        kf.id === target.id
          ? {
              ...kf,
              pose: {
                ...clonePose(kf.pose),
                [part]: {
                  ...kf.pose[part],
                  rotation: { ...rotation },
                },
              },
            }
          : kf
      );
      return {
        keyframes: updated.sort((a, b) => a.frame - b.frame),
      };
    });
  },
}));
