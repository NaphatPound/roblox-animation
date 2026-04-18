'use client';

import { useState, useRef } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Loader2,
  X,
  Cloud,
  Server,
  AlertTriangle,
} from 'lucide-react';
import { useAnimationStore } from '@/store/useAnimationStore';
import {
  planImportFrames,
  runImportBatch,
  summariseSources,
  type BatchSource,
} from '@/lib/imageImport';
import type { AIPoseResult } from '@/types';

export function ImageUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [visionPrompt, setVisionPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [batchSource, setBatchSource] = useState<BatchSource | null>(null);
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
    setBatchSource(null);
    setProgress(0);

    try {
      const plan = planImportFrames(files.length, currentFrame, fps);
      const trimmedPrompt = visionPrompt.trim();

      const analyze = async (
        index: number,
        hint: 'local' | undefined
      ): Promise<AIPoseResult> => {
        const base64 = await fileToBase64(files[index]);
        const res = await fetch('/api/ai-vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            ...(trimmedPrompt ? { prompt: trimmedPrompt } : {}),
            ...(hint ? { backend: hint } : {}),
          }),
        });
        const data = (await res.json()) as AIPoseResult & { error?: string };
        if (!res.ok) {
          // Flag as a fallback so the pure batch runner aborts.
          return {
            ...data,
            source: 'fallback',
            error:
              data.error ||
              `Vision analysis failed on frame ${index + 1} (HTTP ${res.status})`,
          };
        }
        return data;
      };

      // runImportBatch stages keyframes locally and only returns them
      // if every frame succeeded (report04 #1 — atomic commit).
      const batch = await runImportBatch(plan, analyze, setProgress);

      if (batch.lastFrame > totalFrames) {
        setTotalFrames(batch.lastFrame);
      }
      for (const kf of batch.keyframes) {
        addKeyframe(kf.frame, kf.pose);
      }
      setBatchSource(summariseSources(batch.sources));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const renderSource = (s: BatchSource) => {
    if (s === 'cloud') {
      return (
        <>
          <Cloud size={10} /> via Ollama Cloud
        </>
      );
    }
    if (s === 'local') {
      return (
        <>
          <Server size={10} /> via local Ollama
        </>
      );
    }
    if (s === 'mixed') {
      return (
        <>
          <Cloud size={10} />
          <Server size={10} /> mixed (cloud + local)
        </>
      );
    }
    return (
      <>
        <AlertTriangle size={10} className="text-yellow-500" /> fallback
      </>
    );
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

      <textarea
        value={visionPrompt}
        onChange={(e) => setVisionPrompt(e.target.value)}
        placeholder="Optional guidance (e.g. 'right-handed boxing stance, camera is mirrored')"
        rows={2}
        className="px-3 py-2 bg-[#0a0a0a] border border-[#333] rounded text-white text-xs resize-none focus:outline-none focus:border-purple-500"
      />

      <button
        onClick={handleAnalyze}
        disabled={loading || files.length === 0}
        className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-[#333] disabled:text-gray-500 text-white rounded text-sm transition"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
        {loading ? `Analyzing... ${progress}%` : `Analyze ${files.length} frame(s)`}
      </button>
      {batchSource && !error && (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          {renderSource(batchSource)}
        </p>
      )}
      {error && (
        <p className="text-xs text-red-400 flex items-start gap-1">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
