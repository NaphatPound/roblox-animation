'use client';

import { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { useAnimationStore } from '@/store/useAnimationStore';
import { planImportFrames } from '@/lib/imageImport';
import type { AIPoseResponse } from '@/types';

export function ImageUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { addKeyframe, totalFrames, setTotalFrames, fps, currentFrame } =
    useAnimationStore();

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const selected = Array.from(list).filter((f) => f.type.startsWith('image/'));
    setFiles(selected);
    setError(null);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      const plan = planImportFrames(files.length, currentFrame, fps);
      if (plan.lastFrame > totalFrames) {
        setTotalFrames(plan.lastFrame);
      }
      for (let i = 0; i < files.length; i++) {
        const base64 = await fileToBase64(files[i]);
        const res = await fetch('/api/ai-vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 }),
        });
        if (!res.ok) {
          throw new Error(`Vision analysis failed on frame ${i + 1}`);
        }
        const data: AIPoseResponse = await res.json();
        addKeyframe(plan.frames[i], data.pose);
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 bg-[#111] border border-[#2a2a2a] rounded">
      <label className="text-sm font-semibold text-white flex items-center gap-2">
        <ImageIcon size={14} className="text-purple-400" />
        Image-to-Animation (Vision)
      </label>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center justify-center gap-2 px-3 py-4 border-2 border-dashed border-[#333] hover:border-purple-500 text-gray-300 rounded text-sm transition"
      >
        <Upload size={14} />
        Click to upload frames
      </button>

      {files.length > 0 && (
        <div className="flex flex-col gap-1 max-h-40 overflow-auto">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-2 py-1 bg-[#0a0a0a] rounded text-xs text-gray-300"
            >
              <span className="truncate">{i + 1}. {f.name}</span>
              <button
                onClick={() => removeFile(i)}
                className="text-gray-500 hover:text-red-400"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleAnalyze}
        disabled={loading || files.length === 0}
        className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-[#333] disabled:text-gray-500 text-white rounded text-sm transition"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
        {loading ? `Analyzing... ${progress}%` : `Analyze ${files.length} frame(s)`}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
