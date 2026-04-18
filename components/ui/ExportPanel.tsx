'use client';

import { useRef, useState } from 'react';
import { Download, Upload, Trash2 } from 'lucide-react';
import { useAnimationStore } from '@/store/useAnimationStore';
import { sanitizeClip, toAnimationClip } from '@/lib/animationClip';

export function ExportPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const {
    keyframes,
    totalFrames,
    fps,
    clearKeyframes,
  } = useAnimationStore();

  const handleExport = () => {
    const clip = toAnimationClip(keyframes, totalFrames, fps);
    const blob = new Blob([JSON.stringify(clip, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `r6-animation-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage(`Exported ${clip.keyframes.length} keyframe(s)`);
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const clip = sanitizeClip(parsed);
      if (!clip) {
        setMessage('Invalid animation file');
        return;
      }
      useAnimationStore.setState({
        keyframes: clip.keyframes,
        totalFrames: Math.max(
          clip.duration,
          ...clip.keyframes.map((k) => k.frame)
        ),
        fps: clip.fps,
        currentFrame: 0,
        isPlaying: false,
      });
      setMessage(`Imported ${clip.keyframes.length} keyframe(s)`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const handleClear = () => {
    clearKeyframes();
    setMessage('Cleared all keyframes');
  };

  return (
    <div className="flex flex-col gap-2 p-4 bg-[#111] border border-[#2a2a2a] rounded">
      <label className="text-sm font-semibold text-white flex items-center gap-2">
        <Download size={14} className="text-orange-400" />
        Export / Import
      </label>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImport(f);
          e.target.value = '';
        }}
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-1 px-2 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs transition"
        >
          <Download size={12} /> Export JSON
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-1 px-2 py-1.5 bg-[#0a0a0a] hover:bg-[#222] text-gray-200 rounded text-xs transition"
        >
          <Upload size={12} /> Import
        </button>
      </div>
      <button
        onClick={handleClear}
        className="flex items-center justify-center gap-1 px-2 py-1.5 bg-[#0a0a0a] hover:bg-red-700 hover:text-white text-gray-400 rounded text-xs transition"
      >
        <Trash2 size={12} /> Clear All Keyframes
      </button>

      {message && <p className="text-xs text-gray-400 mt-1">{message}</p>}
    </div>
  );
}
