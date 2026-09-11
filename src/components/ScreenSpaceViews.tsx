import React, { useRef, useEffect } from 'react';
import { SceneConfig, WarpMode, PixelSampleInfo } from '../types';
import {
  evaluatePixel,
  getCameraDeltaX,
  getTanHalfFov,
  castRayFromCam,
  calculateDisocclusion,
} from '../utils/simulation';
import { AlertTriangle, CheckCircle2, Crosshair, ZoomIn, Layers } from 'lucide-react';

interface ScreenSpaceViewsProps {
  config: SceneConfig;
  mode: WarpMode;
  hoverNormU: number | null;
  onHoverPixel: (normU: number | null) => void;
}

export const ScreenSpaceViews: React.FC<ScreenSpaceViewsProps> = ({
  config,
  mode,
  hoverNormU,
  onHoverPixel,
}) => {
  const canvasT1Ref = useRef<HTMLCanvasElement | null>(null);
  const canvasGTRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWarpRef = useRef<HTMLCanvasElement | null>(null);

  const deltaX = getCameraDeltaX(config.cameraTranslation);
  const disocc = calculateDisocclusion(config);

  // Helper to render one screen-space view on a canvas
  const renderScreen = (
    canvas: HTMLCanvasElement,
    viewType: 'tMinus1' | 'groundTruth' | 'warped'
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Grid resolution (columns across FOV)
    const cols = 260;
    const colWidth = width / cols;

    // Render columns
    for (let c = 0; c < cols; c++) {
      // Screen space u from -1 (left) to +1 (right)
      const u = ((c + 0.5) / cols) * 2 - 1;
      const xPos = c * colWidth;

      let color = '#000000';
      let depth = 5.6;
      let isChair = false;
      let isHole = false;
      let isGhost = false;

      if (viewType === 'tMinus1') {
        // Frame t-1 (Cam at 0)
        const hit = castRayFromCam(0, u, config);
        color = hit.color;
        depth = hit.depth;
        isChair = hit.object === 'chair';
      } else if (viewType === 'groundTruth') {
        // Ground Truth Frame t (Cam at deltaX)
        const hit = castRayFromCam(deltaX, u, config);
        color = hit.color;
        depth = hit.depth;
        isChair = hit.object === 'chair';
      } else {
        // Warped Frame
        const sample = evaluatePixel(u, mode, config);
        color = sample.sampledColor;
        depth = sample.currDepth;
        isChair = sample.currObject === 'chair';
        isGhost = sample.isGhostArtifact;

        if (mode === 'depth_occlusion' && sample.isDisoccluded) {
          isHole = true;
        }
      }

      // Height of object on screen based on depth perspective
      // Chair is at 2.3m -> occupies roughly 70% of screen height
      // Background is at 5.6m -> occupies 100% of height (floor/wall)
      const chairScreenHeight = height * 0.72;
      const chairY = (height - chairScreenHeight) / 2 + 10;

      if (isHole) {
        // Mode C Rejection hole: distinctive purple/cyan diagonal hatch
        ctx.fillStyle = '#1e1b4b'; // Dark indigo
        ctx.fillRect(xPos, 0, colWidth + 0.5, height);

        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 1;
        if (c % 4 === 0) {
          ctx.beginPath();
          ctx.moveTo(xPos, 0);
          ctx.lineTo(xPos + colWidth * 2, height);
          ctx.stroke();
        }
      } else if (isChair) {
        // Render background first behind chair
        const bgHit = castRayFromCam(
          viewType === 'tMinus1' ? 0 : deltaX,
          u,
          { ...config, chairWidth: 0 } // force background hit
        );
        ctx.fillStyle = bgHit.color;
        ctx.fillRect(xPos, 0, colWidth + 0.5, height);

        // Render chair front
        ctx.fillStyle = color;
        ctx.fillRect(xPos, chairY, colWidth + 0.5, chairScreenHeight);

        // Chair top edge & bottom shadow
        ctx.fillStyle = '#451a03';
        ctx.fillRect(xPos, chairY, colWidth + 0.5, 4);
        ctx.fillStyle = '#292524';
        ctx.fillRect(xPos, chairY + chairScreenHeight - 6, colWidth + 0.5, 6);
      } else {
        // Background tile column
        ctx.fillStyle = color;
        ctx.fillRect(xPos, 0, colWidth + 0.5, height);

        // Perspective floor line in the background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
        ctx.fillRect(xPos, height * 0.65, colWidth + 0.5, height * 0.35);
      }

      // Subtle pixel grid line
      if (c % 16 === 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xPos, 0);
        ctx.lineTo(xPos, height);
        ctx.stroke();
      }
    }

    // Highlighting Ghost Artifacts on Warped Frame
    if (viewType === 'warped' && config.highlightGhosting && disocc) {
      if (mode === 'naive_mv' && deltaX > 0.05) {
        // Mode B Disocclusion ghost area
        const sx1 = ((disocc.screenMinU + 1) / 2) * width;
        const sx2 = ((disocc.screenMaxU + 1) / 2) * width;
        const boxW = Math.max(12, sx2 - sx1);

        // Semi-transparent red highlight
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.fillRect(sx1, 12, boxW, height - 24);

        // Pulsing red border
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 2]);
        ctx.strokeRect(sx1, 12, boxW, height - 24);
        ctx.setLineDash([]);

        // Magnifier / Warning label
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠ 反遮挡重影区', (sx1 + sx2) / 2, 28);
        ctx.font = '9px sans-serif';
        ctx.fillStyle = '#fecaca';
        ctx.fillText('(采到上一帧椅背)', (sx1 + sx2) / 2, 42);
      } else if (mode === 'homography' && deltaX > 0.08) {
        // Mode A severe chair ghost
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(width * 0.18, 16, width * 0.52, height - 32);
        ctx.setLineDash([]);

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠ 全图单应性视差错位', width * 0.44, 32);
      }
    }

    // Draw active cursor crosshair line if hovered
    if (hoverNormU !== null) {
      const cursorX = ((hoverNormU + 1) / 2) * width;
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Point marker
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(cursorX, height / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  useEffect(() => {
    if (canvasT1Ref.current) renderScreen(canvasT1Ref.current, 'tMinus1');
    if (canvasGTRef.current) renderScreen(canvasGTRef.current, 'groundTruth');
    if (canvasWarpRef.current) renderScreen(canvasWarpRef.current, 'warped');
  }, [config, mode, hoverNormU]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const normU = (x / rect.width) * 2 - 1;
    onHoverPixel(Math.max(-1, Math.min(1, normU)));
  };

  const handleMouseLeave = () => {
    onHoverPixel(null);
  };

  // Compute inspected pixel info if hovered
  const inspectedSample: PixelSampleInfo | null =
    hoverNormU !== null ? evaluatePixel(hoverNormU, mode, config) : null;

  return (
    <div className="flex flex-col h-full bg-slate-900/70 rounded-xl border border-slate-800/80 overflow-hidden shadow-xl shadow-black/40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-100">
            画面对比渲染区 (Screen Space Views: 3-Way Realtime Comparison)
          </h2>
        </div>
        <div className="text-xs text-slate-400 hidden sm:block">
          悬停可在 3 个视口中同步高亮同一射线
        </div>
      </div>

      {/* 3 Synchronized Viewports */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 flex-1 min-h-[220px]">
        {/* Viewport 1: Frame t-1 */}
        <div className="flex flex-col bg-slate-950/80 rounded-lg border border-slate-800 overflow-hidden">
          <div className="px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs">
            <span className="font-semibold text-sky-300">1. 上一帧画面 (Frame t-1)</span>
            <span className="text-[10px] text-slate-400 font-mono">X = 0.0m</span>
          </div>
          <div className="relative flex-1 min-h-[160px]">
            <canvas
              ref={canvasT1Ref}
              className="w-full h-full block cursor-crosshair"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />
            <div className="absolute bottom-2 left-2 text-[10px] text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800 pointer-events-none">
              历史参考帧（椅子居中，挡住后方地砖）
            </div>
          </div>
        </div>

        {/* Viewport 2: Ground Truth Frame t */}
        <div className="flex flex-col bg-slate-950/80 rounded-lg border border-slate-800 overflow-hidden">
          <div className="px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-300">2. 当前真实基准 (Ground Truth t)</span>
            <span className="text-[10px] text-slate-400 font-mono">
              X = +{deltaX.toFixed(2)}m
            </span>
          </div>
          <div className="relative flex-1 min-h-[160px]">
            <canvas
              ref={canvasGTRef}
              className="w-full h-full block cursor-crosshair"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />
            <div className="absolute bottom-2 left-2 text-[10px] text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800 pointer-events-none">
              相机右移：椅子向左大视差，露出了右侧地砖
            </div>
          </div>
        </div>

        {/* Viewport 3: Warped Frame */}
        <div className="flex flex-col bg-slate-950/80 rounded-lg border border-slate-800 overflow-hidden">
          <div className="px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-amber-300">3. Warp 重投影结果 (Warped)</span>
              {mode === 'depth_occlusion' ? (
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.2 rounded">
                  遮挡剔除
                </span>
              ) : (
                <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800 px-1.5 py-0.2 rounded">
                  重影伪影
                </span>
              )}
            </div>
          </div>
          <div className="relative flex-1 min-h-[160px]">
            <canvas
              ref={canvasWarpRef}
              className="w-full h-full block cursor-crosshair"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />
            <div className="absolute bottom-2 left-2 text-[10px] text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800 pointer-events-none">
              {mode === 'homography' && '全图无深度：椅子与地面视差不一致'}
              {mode === 'naive_mv' && '双边缘重影：露出的地砖错误采到上一帧椅背！'}
              {mode === 'depth_occlusion' && '深度剔除：反遮挡区域标记为空洞Mask'}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Pixel Inspector Strip */}
      <div className="px-4 py-2.5 bg-slate-950/95 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
        {inspectedSample ? (
          <div className="flex flex-wrap items-center gap-3 w-full">
            <div className="flex items-center space-x-1.5 text-cyan-300 font-mono font-medium">
              <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
              <span>射线 u: {inspectedSample.u.toFixed(2)}</span>
            </div>

            <div className="flex items-center space-x-2 text-slate-300">
              <span>当前目标:</span>
              <span
                className="w-3 h-3 rounded-full border border-slate-600 inline-block"
                style={{ backgroundColor: inspectedSample.currColor }}
              />
              <span className="font-semibold">
                {inspectedSample.currObject === 'chair' ? '近处椅子' : '远景地砖'}
              </span>
              <span className="text-slate-500">({inspectedSample.currDepth.toFixed(1)}m)</span>
            </div>

            <div className="flex items-center space-x-2 text-slate-300">
              <span>上一帧采样源:</span>
              <span
                className="w-3 h-3 rounded-full border border-slate-600 inline-block"
                style={{ backgroundColor: inspectedSample.sampledColor }}
              />
              <span className="font-semibold">
                {inspectedSample.prevObject === 'chair'
                  ? '椅子'
                  : inspectedSample.prevObject === 'background'
                  ? '地砖'
                  : '视锥外'}
              </span>
            </div>

            {inspectedSample.isGhostArtifact ? (
              <div className="flex items-center space-x-1.5 text-rose-400 font-medium ml-auto">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>检测到反遮挡重影 (Ghosting Artifact)!</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 text-emerald-400 font-medium ml-auto">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>采样合法无重影</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-slate-400 flex items-center space-x-2">
            <Crosshair className="w-3.5 h-3.5 text-slate-500" />
            <span>将鼠标移至上方任何画面窗口，可实时审查该像素的射线深度与反查历史采样来源。</span>
          </div>
        )}
      </div>
    </div>
  );
};
