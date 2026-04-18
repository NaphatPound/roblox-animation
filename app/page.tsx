'use client';

import dynamic from 'next/dynamic';
import { Timeline } from '@/components/ui/Timeline';
import { PromptInput } from '@/components/ui/PromptInput';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { Controls } from '@/components/ui/Controls';
import { ExportPanel } from '@/components/ui/ExportPanel';

const Scene = dynamic(
  () => import('@/components/3d/Scene').then((mod) => mod.Scene),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="flex flex-col h-screen w-screen bg-[#0a0a0a] text-white">
      <header className="flex items-center justify-between px-6 py-3 border-b border-[#2a2a2a]">
        <div>
          <h1 className="text-lg font-semibold">Roblox R6 AI Animator</h1>
          <p className="text-xs text-gray-400">
            Animate R6 characters with AI — Text/Image to pose, SLERP interpolation.
          </p>
        </div>
        <div className="text-xs text-gray-500">v0.1.0</div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-80 flex flex-col gap-3 p-3 border-r border-[#2a2a2a] overflow-auto">
          <PromptInput />
          <ImageUploader />
          <Controls />
          <ExportPanel />
        </aside>

        <section className="flex-1 relative min-w-0">
          <Scene />
        </section>
      </div>

      <Timeline />
    </main>
  );
}
