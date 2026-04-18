'use client';

import { useAnimationStore } from '@/store/useAnimationStore';
import { interpolatePose } from '@/components/3d/InterpolationEngine';
import { POSE_PRESETS, PRESET_ORDER } from '@/lib/presets';
import type { R6PartName } from '@/types';
import { RotateCcw, Shapes } from 'lucide-react';

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
  } = useAnimationStore();

  const currentPose = interpolatePose(keyframes, currentFrame);
  const part = selectedPart ? currentPose[selectedPart] : null;

  const handleChange = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!selectedPart || !part) return;
    const rotation = { ...part.rotation, [axis]: value };
    updatePartRotation(Math.round(currentFrame), selectedPart, rotation);
  };

  const handleReset = () => {
    if (!selectedPart) return;
    updatePartRotation(Math.round(currentFrame), selectedPart, {
      x: 0,
      y: 0,
      z: 0,
    });
  };

  const handlePreset = (key: string) => {
    const factory = POSE_PRESETS[key];
    if (!factory) return;
    addKeyframe(Math.round(currentFrame), factory());
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-[#111] border border-[#2a2a2a] rounded">
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
