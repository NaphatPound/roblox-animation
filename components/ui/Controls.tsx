'use client';

import { useEffect } from 'react';
import { useAnimationStore } from '@/store/useAnimationStore';
import { interpolatePose } from '@/components/3d/InterpolationEngine';
import { POSE_PRESETS, PRESET_ORDER } from '@/lib/presets';
import { IK_HANDLES } from '@/lib/rig/r6Rig';
import type { R6PartName } from '@/types';
import {
  FlipHorizontal,
  Move3D,
  Rotate3D,
  RotateCcw,
  Shapes,
  Undo2,
  Redo2,
  Target,
} from 'lucide-react';

const PART_LABELS: Record<R6PartName, string> = {
  head: 'Head',
  torso: 'Torso',
  leftArm: 'Left Arm',
  rightArm: 'Right Arm',
  leftLeg: 'Left Leg',
  rightLeg: 'Right Leg',
};

const PARTS: R6PartName[] = [
  'head',
  'torso',
  'leftArm',
  'rightArm',
  'leftLeg',
  'rightLeg',
];

export function Controls() {
  const {
    selectedPart,
    selectPart,
    keyframes,
    currentFrame,
    updatePartRotation,
    addKeyframe,
    gizmoMode,
    setGizmoMode,
    editMode,
    setEditMode,
    ikTargets,
    activeIkHandles,
    setIkTarget,
    resetIkTargets,
    bakeIkToCurrentFrame,
    mirrorCurrentKeyframe,
    undo,
    redo,
    history,
    future,
  } = useAnimationStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (ctrl && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === 'r' || e.key === 'R') setGizmoMode('rotate');
      if (e.key === 't' || e.key === 'T' || e.key === 'g' || e.key === 'G') {
        setGizmoMode('translate');
      }
      if (e.key === 'm' || e.key === 'M') mirrorCurrentKeyframe();
      if (e.key === 'Escape') selectPart(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setGizmoMode, selectPart, undo, redo, mirrorCurrentKeyframe]);

  // report05 #3: sample pose and edit at the same rounded frame. A
  // fractional currentFrame during playback would otherwise make the
  // sliders show an interpolated Y/Z which then gets written back into
  // the rounded frame — silently corrupting the target keyframe.
  const roundedFrame = Math.round(currentFrame);
  const currentPose = interpolatePose(keyframes, roundedFrame);
  const part = selectedPart ? currentPose[selectedPart] : null;

  const handleChange = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!selectedPart || !part) return;
    const rotation = { ...part.rotation, [axis]: value };
    updatePartRotation(roundedFrame, selectedPart, rotation);
  };

  const handleReset = () => {
    if (!selectedPart) return;
    updatePartRotation(roundedFrame, selectedPart, {
      x: 0,
      y: 0,
      z: 0,
    });
  };

  const handlePreset = (key: string) => {
    const factory = POSE_PRESETS[key];
    if (!factory) return;
    addKeyframe(roundedFrame, factory());
  };

  const IK_LABELS: Record<(typeof IK_HANDLES)[number], string> = {
    leftHand: 'Left Hand',
    rightHand: 'Right Hand',
    leftFoot: 'Left Foot',
    rightFoot: 'Right Foot',
    headLook: 'Head Look',
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-[#111] border border-[#2a2a2a] rounded">
      <div className="flex items-center gap-2">
        <button
          onClick={undo}
          disabled={history.length === 0}
          title="Undo (Ctrl+Z)"
          className="flex items-center gap-1 px-2 py-1 text-xs bg-[#0a0a0a] text-gray-300 hover:bg-[#222] disabled:opacity-40 disabled:cursor-not-allowed rounded transition"
        >
          <Undo2 size={12} /> Undo
        </button>
        <button
          onClick={redo}
          disabled={future.length === 0}
          title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
          className="flex items-center gap-1 px-2 py-1 text-xs bg-[#0a0a0a] text-gray-300 hover:bg-[#222] disabled:opacity-40 disabled:cursor-not-allowed rounded transition"
        >
          <Redo2 size={12} /> Redo
        </button>
        <div className="flex-1" />
        <button
          onClick={mirrorCurrentKeyframe}
          title="Mirror current keyframe left ↔ right (M)"
          className="flex items-center gap-1 px-2 py-1 text-xs bg-[#0a0a0a] text-gray-300 hover:bg-purple-600 hover:text-white rounded transition"
        >
          <FlipHorizontal size={12} /> Mirror
        </button>
      </div>

      <div className="flex items-center gap-2 border-t border-[#2a2a2a] pt-2">
        <span className="text-xs text-gray-400">Mode</span>
        <button
          onClick={() => setEditMode('fk')}
          className={`px-2 py-1 text-xs rounded transition ${
            editMode === 'fk'
              ? 'bg-blue-500 text-white'
              : 'bg-[#0a0a0a] text-gray-300 hover:bg-[#222]'
          }`}
        >
          FK
        </button>
        <button
          onClick={() => setEditMode('ik')}
          className={`px-2 py-1 text-xs rounded transition ${
            editMode === 'ik'
              ? 'bg-blue-500 text-white'
              : 'bg-[#0a0a0a] text-gray-300 hover:bg-[#222]'
          }`}
        >
          IK
        </button>
      </div>

      {editMode === 'ik' && (
        <div className="flex flex-col gap-2 border border-[#2a2a2a] p-2 rounded bg-[#0a0a0a]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-white flex items-center gap-1">
              <Target size={12} className="text-cyan-400" /> IK Targets
            </label>
            <div className="flex gap-1">
              <button
                onClick={resetIkTargets}
                className="px-2 py-0.5 text-[10px] bg-[#0a0a0a] border border-[#333] text-gray-400 hover:bg-[#222] rounded transition"
              >
                Reset
              </button>
              <button
                onClick={bakeIkToCurrentFrame}
                disabled={activeIkHandles.size === 0}
                title={
                  activeIkHandles.size === 0
                    ? 'Edit a target to arm the bake'
                    : `Bake ${activeIkHandles.size} handle(s)`
                }
                className="px-2 py-0.5 text-[10px] bg-cyan-600 hover:bg-cyan-700 disabled:bg-[#222] disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded transition"
              >
                Bake{activeIkHandles.size ? ` (${activeIkHandles.size})` : ''}
              </button>
            </div>
          </div>
          {IK_HANDLES.map((h) => (
            <div
              key={h}
              className={`flex items-center gap-1 text-[10px] ${
                activeIkHandles.has(h) ? '' : 'opacity-60'
              }`}
              title={
                activeIkHandles.has(h)
                  ? 'Will be solved on next Bake'
                  : 'Untouched — bake skips this handle'
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  activeIkHandles.has(h) ? 'bg-cyan-400' : 'bg-gray-700'
                }`}
              />
              <span className="text-gray-400 w-16">{IK_LABELS[h]}</span>
              {(['x', 'y', 'z'] as const).map((axis) => (
                <input
                  key={axis}
                  type="number"
                  step={0.1}
                  value={Number(ikTargets[h][axis].toFixed(2))}
                  onChange={(e) =>
                    setIkTarget(h, {
                      ...ikTargets[h],
                      [axis]: Number(e.target.value),
                    })
                  }
                  className="w-12 px-1 py-0.5 bg-[#111] border border-[#333] rounded text-white"
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <label className="text-sm font-semibold text-white flex items-center gap-2">
        <Shapes size={14} className="text-green-400" />
        Pose Presets
      </label>
      <div className="grid grid-cols-3 gap-1.5">
        {PRESET_ORDER.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handlePreset(key)}
            className="px-2 py-1.5 text-xs bg-[#0a0a0a] text-gray-200 rounded hover:bg-green-600 hover:text-white transition"
          >
            {label}
          </button>
        ))}
      </div>

      <label className="text-sm font-semibold text-white mt-1">Body Parts</label>
      <div className="grid grid-cols-2 gap-2">
        {PARTS.map((name) => (
          <button
            key={name}
            onClick={() => selectPart(selectedPart === name ? null : name)}
            className={`px-2 py-1.5 text-xs rounded transition ${
              selectedPart === name
                ? 'bg-blue-500 text-white'
                : 'bg-[#0a0a0a] text-gray-300 hover:bg-[#222]'
            }`}
          >
            {PART_LABELS[name]}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-gray-400">Gizmo</span>
        <button
          onClick={() => setGizmoMode('rotate')}
          title="Rotate (R)"
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition ${
            gizmoMode === 'rotate'
              ? 'bg-blue-500 text-white'
              : 'bg-[#0a0a0a] text-gray-300 hover:bg-[#222]'
          }`}
        >
          <Rotate3D size={12} /> Rotate
        </button>
        <button
          onClick={() => setGizmoMode('translate')}
          title="Move (T) — torso moves the rig root; other parts offset from the joint"
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition ${
            gizmoMode === 'translate'
              ? 'bg-blue-500 text-white'
              : 'bg-[#0a0a0a] text-gray-300 hover:bg-[#222]'
          }`}
        >
          <Move3D size={12} /> Move
        </button>
      </div>

      {selectedPart && part && (
        <div className="flex flex-col gap-2 border-t border-[#2a2a2a] pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white">
              Rotation ({PART_LABELS[selectedPart]})
            </span>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
            >
              <RotateCcw size={10} /> Reset
            </button>
          </div>
          {(['x', 'y', 'z'] as const).map((axis) => (
            <div key={axis} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-4 uppercase">{axis}</span>
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={Math.round(part.rotation[axis])}
                onChange={(e) => handleChange(axis, Number(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <input
                type="number"
                value={Math.round(part.rotation[axis])}
                onChange={(e) => handleChange(axis, Number(e.target.value))}
                className="w-14 px-1 py-0.5 bg-[#0a0a0a] border border-[#333] rounded text-white text-xs"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
