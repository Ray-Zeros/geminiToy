import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SceneConfig, WarpMode } from './types';
import { DEFAULT_CONFIG } from './utils/simulation';
import { TheoryExplainer } from './components/TheoryExplainer';
import { TopDownCanvas } from './components/TopDownCanvas';
import { ScreenSpaceViews } from './components/ScreenSpaceViews';
import { ControlPanel } from './components/ControlPanel';

export default function App() {
  const [config, setConfig] = useState<SceneConfig>(DEFAULT_CONFIG);
  const [mode, setMode] = useState<WarpMode>('naive_mv'); // Default to Naive MV to showcase ghosting
  const [hoverNormU, setHoverNormU] = useState<number | null>(null);

  const animRef = useRef<number | null>(null);
  const animTimeRef = useRef<number>(0);

  const updateConfig = useCallback((newPartial: Partial<SceneConfig>) => {
    setConfig((prev) => ({ ...prev, ...newPartial }));
  }, []);

  // Keyboard navigation for ease of presentation & exploration
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === '1' || e.key.toLowerCase() === 'a') {
        setMode('homography');
      } else if (e.key === '2' || e.key.toLowerCase() === 'b') {
        setMode('naive_mv');
      } else if (e.key === '3' || e.key.toLowerCase() === 'c') {
        setMode('depth_occlusion');
      } else if (e.code === 'Space') {
        e.preventDefault();
        updateConfig({ autoAnimate: !config.autoAnimate });
      } else if (e.key === 'ArrowLeft') {
        updateConfig({
          cameraTranslation: Math.max(0, config.cameraTranslation - 5),
          autoAnimate: false,
        });
      } else if (e.key === 'ArrowRight') {
        updateConfig({
          cameraTranslation: Math.min(100, config.cameraTranslation + 5),
          autoAnimate: false,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config.autoAnimate, config.cameraTranslation, updateConfig]);

  // Smooth animation loop for camera oscillation
  useEffect(() => {
    if (!config.autoAnimate) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    const loop = () => {
      animTimeRef.current += 0.02;
      // Oscillate camera translation between 15% and 85%
      const val = 50 + 35 * Math.sin(animTimeRef.current);
      setConfig((prev) => ({
        ...prev,
        cameraTranslation: Math.round(val),
      }));
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [config.autoAnimate]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      {/* Background radial gradient accent */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-950/20 via-slate-950/40 to-slate-950 -z-10" />

      {/* Main Container */}
      <main className="w-full max-w-[1600px] mx-auto p-3 sm:p-5 flex-1 flex flex-col space-y-4">
        {/* Top: Theory & Core Principle Header */}
        <TheoryExplainer currentMode={mode} />

        {/* Middle Section: Top-Down Physics (Left) + Screen Space Comparison (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 items-stretch">
          {/* Left / Top: 2D Geometry & Ray Tracing Canvas */}
          <div className="lg:col-span-5 flex flex-col h-full">
            <TopDownCanvas
              config={config}
              mode={mode}
              onHoverPixel={setHoverNormU}
              hoverNormU={hoverNormU}
            />
          </div>

          {/* Right / Bottom: 3-Way Screen Space Synchronized View */}
          <div className="lg:col-span-7 flex flex-col h-full">
            <ScreenSpaceViews
              config={config}
              mode={mode}
              hoverNormU={hoverNormU}
              onHoverPixel={setHoverNormU}
            />
          </div>
        </div>

        {/* Bottom: Interactive Control Console */}
        <ControlPanel
          config={config}
          onChangeConfig={updateConfig}
          mode={mode}
          onChangeMode={setMode}
        />

        {/* Quick shortcut help strip */}
        <footer className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 px-2 py-1">
          <div className="flex items-center space-x-4">
            <span>
              快捷键：<kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400">A/B/C</kbd> 切换模式
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400">空格 Space</kbd> 播放/暂停摆动
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400">← / →</kbd> 微调相机平移
            </span>
          </div>
          <div>帧间重投影与反遮挡重影（Disocclusion Artifacts）交互教学课件</div>
        </footer>
      </main>
    </div>
  );
}
