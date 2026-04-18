'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useAnimationStore } from '@/store/useAnimationStore';
import type { AIPoseResponse } from '@/types';

export function PromptInput() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentFrame, addKeyframe } = useAnimationStore();

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        throw new Error(`AI request failed: ${res.status}`);
      }
      const data: AIPoseResponse = await res.json();
      addKeyframe(Math.round(currentFrame), data.pose);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 bg-[#111] border border-[#2a2a2a] rounded">
      <label className="text-sm font-semibold text-white flex items-center gap-2">
        <Sparkles size={14} className="text-blue-400" />
        Text-to-Animation
      </label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. right hook punch, running, idle wave..."
        rows={2}
        className="px-3 py-2 bg-[#0a0a0a] border border-[#333] rounded text-white text-sm resize-none focus:outline-none focus:border-blue-500"
      />
      <button
        onClick={handleGenerate}
        disabled={loading || !prompt.trim()}
        className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-[#333] disabled:text-gray-500 text-white rounded text-sm transition"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {loading ? 'Generating...' : 'Generate Pose'}
      </button>
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
