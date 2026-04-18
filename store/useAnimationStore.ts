import { create } from 'zustand';
import type {
  EditMode,
  GizmoMode,
  Keyframe,
  R6Pose,
  R6PartName,
  PlaybackState,
  Vec3,
} from '@/types';
import { generateId } from '@/utils/mathUtils';
import { DEFAULT_POSE, clonePose } from '@/lib/pose';
import { interpolatePose } from '@/components/3d/InterpolationEngine';
import {
  defaultIKTargets,
  IK_HANDLES,
  type IKHandleName,
} from '@/lib/rig/r6Rig';
import { solveIKPose } from '@/lib/rig/r6IkSolver';
import { mirrorPose } from '@/lib/rig/mirrorPose';

export { DEFAULT_POSE, clonePose };

const HISTORY_CAP = 50;

interface HistorySnapshot {
  keyframes: Keyframe[];
  totalFrames: number;
  fps: number;
}

function snapshot(state: Pick<AnimationState, 'keyframes' | 'totalFrames' | 'fps'>): HistorySnapshot {
  return {
    keyframes: state.keyframes.map((k) => ({
      id: k.id,
      frame: k.frame,
      pose: clonePose(k.pose),
      ...(k.easing ? { easing: k.easing } : {}),
    })),
    totalFrames: state.totalFrames,
    fps: state.fps,
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
  updatePartPosition: (frame: number, part: R6PartName, position: Vec3) => void;

  gizmoMode: GizmoMode;
  setGizmoMode: (mode: GizmoMode) => void;

  editMode: EditMode;
  setEditMode: (mode: EditMode) => void;

  ikTargets: Record<IKHandleName, Vec3>;
  setIkTarget: (handle: IKHandleName, position: Vec3) => void;
  resetIkTargets: () => void;
  bakeIkToCurrentFrame: () => void;

  mirrorCurrentKeyframe: () => void;

  history: HistorySnapshot[];
  future: HistorySnapshot[];
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
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
  gizmoMode: 'rotate',
  editMode: 'fk',
  ikTargets: defaultIKTargets(),
  history: [],
  future: [],

  addKeyframe: (frame, pose) => {
    set((state) => {
      const history = [...state.history, snapshot(state)].slice(-HISTORY_CAP);
      const filtered = state.keyframes.filter((kf) => kf.frame !== frame);
      const newKf: Keyframe = {
        id: generateId(),
        frame,
        pose: clonePose(pose),
      };
      return {
        keyframes: [...filtered, newKf].sort((a, b) => a.frame - b.frame),
        history,
        future: [],
      };
    });
  },

  removeKeyframe: (id) => {
    set((state) => {
      const history = [...state.history, snapshot(state)].slice(-HISTORY_CAP);
      return {
        keyframes: state.keyframes.filter((kf) => kf.id !== id),
        history,
        future: [],
      };
    });
  },

  updateKeyframePose: (id, pose) => {
    set((state) => ({
      keyframes: state.keyframes.map((kf) =>
        kf.id === id ? { ...kf, pose: clonePose(pose) } : kf
      ),
    }));
  },

  moveKeyframe: (id, newFrame) => {
    set((state) => {
      const history = [...state.history, snapshot(state)].slice(-HISTORY_CAP);
      // report05 #4: match addKeyframe's invariants — clamp to the clip
      // range and drop any keyframe already living at the target frame
      // so we never end up with two keyframes at the same frame.
      const clamped = Math.max(
        0,
        Math.min(Math.floor(newFrame), state.totalFrames)
      );
      const filtered = state.keyframes.filter(
        (kf) => kf.frame !== clamped || kf.id === id
      );
      return {
        keyframes: filtered
          .map((kf) => (kf.id === id ? { ...kf, frame: clamped } : kf))
          .sort((a, b) => a.frame - b.frame),
        history,
        future: [],
      };
    });
  },

  clearKeyframes: () => {
    set((state) => ({
      keyframes: [{ id: 'initial', frame: 0, pose: clonePose(DEFAULT_POSE) }],
      currentFrame: 0,
      isPlaying: false,
      history: [...state.history, snapshot(state)].slice(-HISTORY_CAP),
      future: [],
    }));
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
      // report05 #2: drop keyframes that would live past the new end so
      // they can't linger invisibly, leak into interpolation, or get
      // exported with frame > duration.
      keyframes: state.keyframes.filter((kf) => kf.frame <= clamped),
      history: [...state.history, snapshot(state)].slice(-HISTORY_CAP),
      future: [],
    }));
  },

  setFps: (fps) => set({ fps: Math.max(1, Math.min(fps, 120)) }),

  selectPart: (part) => set({ selectedPart: part }),

  updatePartRotation: (frame, part, rotation) => {
    set((state) => {
      const history = [...state.history, snapshot(state)].slice(-HISTORY_CAP);
      const existingAtFrame = state.keyframes.find((kf) => kf.frame === frame);
      const basePose = existingAtFrame
        ? existingAtFrame.pose
        : interpolatePose(state.keyframes, frame);
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
        history,
        future: [],
      };
    });
  },

  updatePartPosition: (frame, part, position) => {
    set((state) => {
      const history = [...state.history, snapshot(state)].slice(-HISTORY_CAP);
      const existingAtFrame = state.keyframes.find((kf) => kf.frame === frame);
      const basePose = existingAtFrame
        ? existingAtFrame.pose
        : interpolatePose(state.keyframes, frame);
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
                  position: { ...position },
                },
              },
            }
          : kf
      );
      return {
        keyframes: updated.sort((a, b) => a.frame - b.frame),
        history,
        future: [],
      };
    });
  },

  setGizmoMode: (mode) => set({ gizmoMode: mode }),

  setEditMode: (mode) => set({ editMode: mode }),

  setIkTarget: (handle, position) => {
    set((state) => ({
      ikTargets: { ...state.ikTargets, [handle]: { ...position } },
    }));
  },

  resetIkTargets: () => set({ ikTargets: defaultIKTargets() }),

  bakeIkToCurrentFrame: () => {
    set((state) => {
      const frame = Math.round(state.currentFrame);
      const basePose =
        state.keyframes.find((kf) => kf.frame === frame)?.pose ||
        interpolatePose(state.keyframes, frame);
      const targetMap: Partial<Record<IKHandleName, Vec3>> = {};
      for (const h of IK_HANDLES) {
        targetMap[h] = state.ikTargets[h];
      }
      const { pose: solved } = solveIKPose(basePose, targetMap);
      const history = [...state.history, snapshot(state)].slice(-HISTORY_CAP);
      const filtered = state.keyframes.filter((kf) => kf.frame !== frame);
      const newKf: Keyframe = {
        id: generateId(),
        frame,
        pose: clonePose(solved),
      };
      return {
        keyframes: [...filtered, newKf].sort((a, b) => a.frame - b.frame),
        history,
        future: [],
      };
    });
  },

  mirrorCurrentKeyframe: () => {
    set((state) => {
      const frame = Math.round(state.currentFrame);
      const basePose =
        state.keyframes.find((kf) => kf.frame === frame)?.pose ||
        interpolatePose(state.keyframes, frame);
      const mirrored = mirrorPose(basePose);
      const history = [...state.history, snapshot(state)].slice(-HISTORY_CAP);
      const filtered = state.keyframes.filter((kf) => kf.frame !== frame);
      const newKf: Keyframe = {
        id: generateId(),
        frame,
        pose: clonePose(mirrored),
      };
      return {
        keyframes: [...filtered, newKf].sort((a, b) => a.frame - b.frame),
        history,
        future: [],
      };
    });
  },

  undo: () => {
    set((state) => {
      const prev = state.history[state.history.length - 1];
      if (!prev) return {};
      const current = snapshot(state);
      return {
        keyframes: prev.keyframes,
        totalFrames: prev.totalFrames,
        fps: prev.fps,
        currentFrame: Math.min(state.currentFrame, prev.totalFrames),
        history: state.history.slice(0, -1),
        future: [...state.future, current].slice(-HISTORY_CAP),
      };
    });
  },

  redo: () => {
    set((state) => {
      const next = state.future[state.future.length - 1];
      if (!next) return {};
      const current = snapshot(state);
      return {
        keyframes: next.keyframes,
        totalFrames: next.totalFrames,
        fps: next.fps,
        currentFrame: Math.min(state.currentFrame, next.totalFrames),
        history: [...state.history, current].slice(-HISTORY_CAP),
        future: state.future.slice(0, -1),
      };
    });
  },

  canUndo: () => get().history.length > 0,
  canRedo: () => get().future.length > 0,
}));
