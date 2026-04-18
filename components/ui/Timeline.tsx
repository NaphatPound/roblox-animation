'use client';

import { Play, Pause, Square, Plus, Trash2, Repeat } from 'lucide-react';
import { useAnimationStore } from '@/store/useAnimationStore';
import {
  interpolatePose,
} from '@/components/3d/InterpolationEngine';

export function Timeline() {
  const {
    keyframes,
    currentFrame,
    totalFrames,
    isPlaying,
    loop,
    speed,
    fps,
    play,
    pause,
    stop,
    setCurrentFrame,
    setTotalFrames,
    setFps,
    setSpeed,
    toggleLoop,
    addKeyframe,
    removeKeyframe,
  } = useAnimationStore();

  const handleAddKeyframe = () => {
    // report05 #3: sample the pose at the SAME frame we write to. Before,
    // `currentFrame` could be fractional during playback; we sampled at
    // 9.6 and wrote to 10, overwriting the real frame-10 keyframe with
    // the near-end interpolation.
    const frame = Math.round(currentFrame);
    const pose = interpolatePose(keyframes, frame);
    addKeyframe(frame, pose);
  };

  const nearestKeyframe = keyframes.find(
    (kf) => Math.abs(kf.frame - currentFrame) < 0.5
  );

  return (
    <div className="flex flex-col gap-3 bg-[#111] border-t border-[#2a2a2a] p-4">
      <div className="flex items-center gap-3">
        <button
          onClick={isPlaying ? pause : play}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          onClick={stop}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-[#222] hover:bg-[#333] text-white transition"
          aria-label="Stop"
        >
          <Square size={16} />
        </button>
        <button
          onClick={toggleLoop}
          className={`flex items-center justify-center w-10 h-10 rounded-full transition ${
            loop ? 'bg-blue-500 text-white' : 'bg-[#222] text-gray-400'
          }`}
          aria-label="Toggle loop"
        >
          <Repeat size={16} />
        </button>

        <div className="flex items-center gap-2 ml-2 text-sm text-gray-300">
          <span>Frame</span>
          <input
            type="number"
            value={Math.round(currentFrame)}
            onChange={(e) => setCurrentFrame(Number(e.target.value))}
            min={0}
            max={totalFrames}
            className="w-16 px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded text-white text-sm"
          />
          <span>/ {totalFrames}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-300">
          <span>FPS</span>
          <input
            type="number"
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            min={1}
            max={120}
            className="w-16 px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded text-white text-sm"
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-300">
          <span>Speed</span>
          <input
            type="number"
            value={speed}
            step={0.1}
            onChange={(e) => setSpeed(Number(e.target.value))}
            min={0.1}
            max={4}
            className="w-16 px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded text-white text-sm"
          />
          <span>x</span>
        </div>

        <div className="flex-1" />

        <button
          onClick={handleAddKeyframe}
          className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition"
        >
          <Plus size={14} /> Keyframe
        </button>
        {nearestKeyframe && nearestKeyframe.id !== 'initial' && (
          <button
            onClick={() => removeKeyframe(nearestKeyframe.id)}
            className="flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition"
          >
            <Trash2 size={14} /> Delete
          </button>
        )}
      </div>

      <div className="relative h-16 bg-[#0a0a0a] border border-[#2a2a2a] rounded overflow-hidden">
        <div className="absolute inset-0 flex">
          {Array.from({ length: totalFrames + 1 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 border-r border-[#1a1a1a]"
              style={{ minWidth: 4 }}
            />
          ))}
        </div>

        <input
          type="range"
          value={Math.round(currentFrame)}
          min={0}
          max={totalFrames}
          step={1}
          onChange={(e) => setCurrentFrame(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          aria-label="Scrub timeline"
        />

        {keyframes.map((kf) => {
          const isActive = Math.abs(kf.frame - currentFrame) < 0.5;
          return (
            <div
              key={kf.id}
              onClick={() => setCurrentFrame(kf.frame)}
              className={`absolute top-1 bottom-1 w-2 rounded-sm shadow-md z-20 cursor-pointer transition ${
                isActive ? 'bg-orange-400' : 'bg-yellow-400 hover:bg-yellow-300'
              }`}
              style={{
                left: `calc(${(kf.frame / Math.max(1, totalFrames)) * 100}% - 4px)`,
              }}
              title={`Keyframe at frame ${kf.frame}`}
            />
          );
        })}

        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none"
          style={{
            left: `${(currentFrame / totalFrames) * 100}%`,
          }}
        />
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span>Total Frames:</span>
        <input
          type="number"
          value={totalFrames}
          min={1}
          onChange={(e) => setTotalFrames(Number(e.target.value))}
          className="w-20 px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded text-white"
        />
        <span>Keyframes: {keyframes.length}</span>
        <span>Duration: {(totalFrames / fps).toFixed(2)}s</span>
      </div>
    </div>
  );
}
