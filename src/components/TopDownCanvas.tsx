import React, { useRef, useEffect, useState } from 'react';
import { SceneConfig, WarpMode } from '../types';
import {
  getCameraDeltaX,
  getTanHalfFov,
  calculateDisocclusion,
  castRayFromCam,
  getTileColorAtWorldX,
} from '../utils/simulation';
import { Eye, Info, Sparkles, Navigation } from 'lucide-react';

interface TopDownCanvasProps {
  config: SceneConfig;
  mode: WarpMode;
  onHoverPixel: (normU: number | null) => void;
  hoverNormU: number | null;
}

export const TopDownCanvas: React.FC<TopDownCanvasProps> = ({
  config,
  mode,
  onHoverPixel,
  hoverNormU,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeRayInfo, setActiveRayInfo] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI crisp rendering
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Coordinate mapping:
    // World X from -3.5m to +3.5m -> screen X
    // World Z from -0.6m to +6.4m -> screen Y (Z=0 near bottom, Z=6 near top)
    const worldXMin = -3.4;
    const worldXMax = 3.4;
    const worldZMin = -0.5;
    const worldZMax = 6.2;

    const toScreenX = (wx: number) => {
      return ((wx - worldXMin) / (worldXMax - worldXMin)) * width;
    };
    const toScreenY = (wz: number) => {
      // Invert Y so Z increases upwards
      return height - ((wz - worldZMin) / (worldZMax - worldZMin)) * (height - 30) - 20;
    };
    const toWorldX = (sx: number) => {
      return worldXMin + (sx / width) * (worldXMax - worldXMin);
    };

    // Clear background
    ctx.fillStyle = '#090d16'; // Deep tech slate
    ctx.fillRect(0, 0, width, height);

    // 1. Draw Grid Lines and Meter Rings
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    // Horizontal Z depth lines
    for (let z = 0; z <= 6; z += 1) {
      const sy = toScreenY(z);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText(`Z = ${z}.0m`, 12, sy - 4);
    }

    // Vertical X lines
    for (let x = -3; x <= 3; x += 1) {
      const sx = toScreenX(x);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
      ctx.stroke();

      if (x !== 0) {
        ctx.fillStyle = '#475569';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${x > 0 ? '+' : ''}${x}m`, sx, height - 6);
      }
    }

    // Central world axis line (X = 0)
    const sx0 = toScreenX(0);
    ctx.strokeStyle = '#334155';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(sx0, 0);
    ctx.lineTo(sx0, height);
    ctx.stroke();
    ctx.setLineDash([]);

    const deltaX = getCameraDeltaX(config.cameraTranslation);
    const T = getTanHalfFov(config.fovDegrees);

    // 2. Draw Background Wall / Floor Tiles at Z = config.bgZ
    const bgScreenY = toScreenY(config.bgZ);
    const tileHeightPx = 18;

    // Draw background slab base
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, bgScreenY - tileHeightPx / 2, width, tileHeightPx);

    // Draw individual striped tiles
    const tileStep = 0.32;
    for (let wx = -4.0; wx <= 4.0; wx += tileStep) {
      const t = getTileColorAtWorldX(wx + 0.01);
      const sx1 = toScreenX(wx);
      const sx2 = toScreenX(wx + tileStep);

      ctx.fillStyle = t.isDark ? '#1e293b' : '#cbd5e1';
      ctx.fillRect(sx1, bgScreenY - tileHeightPx / 2, sx2 - sx1, tileHeightPx);

      // Tile borders
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx1, bgScreenY - tileHeightPx / 2, sx2 - sx1, tileHeightPx);
    }

    // Label background
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('远景背景：黑白条纹地砖 (Z = 5.6m)', 12, bgScreenY - 14);

    // 3. Highlight Disocclusion Region on Background
    const disocc = calculateDisocclusion(config);
    if (disocc) {
      const disoccSx1 = toScreenX(disocc.worldMinX);
      const disoccSx2 = toScreenX(disocc.worldMaxX);
      const disoccWidth = disoccSx2 - disoccSx1;

      // Glowing highlight box
      ctx.fillStyle = 'rgba(234, 179, 8, 0.28)'; // Yellow accent
      ctx.fillRect(disoccSx1, bgScreenY - 18, disoccWidth, 36);

      // Yellow striped hatch
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const hatchStep = 8;
      for (let hx = disoccSx1; hx < disoccSx2 + 36; hx += hatchStep) {
        ctx.moveTo(hx, bgScreenY - 18);
        ctx.lineTo(hx - 14, bgScreenY + 18);
      }
      ctx.stroke();

      // Border bounds
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.strokeRect(disoccSx1, bgScreenY - 18, disoccWidth, 36);

      // Tag badge
      ctx.fillStyle = '#eab308';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      const badgeX = (disoccSx1 + disoccSx2) / 2;
      ctx.fillText('★ 反遮挡区域 (Disocclusion)', badgeX, bgScreenY - 24);
      ctx.font = '9px monospace';
      ctx.fillText(`ΔX: ${disocc.worldMinX.toFixed(2)}m ~ ${disocc.worldMaxX.toFixed(2)}m`, badgeX, bgScreenY + 30);
    }

    // 4. Draw Chair at Z = config.chairZ
    const chairHalfW = config.chairWidth / 2;
    const chairScreenY = toScreenY(config.chairZ);
    const chairSx1 = toScreenX(config.chairX - chairHalfW);
    const chairSx2 = toScreenX(config.chairX + chairHalfW);
    const chairPixelW = chairSx2 - chairSx1;
    const chairPixelDepth = 26;

    // Chair shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(
      (chairSx1 + chairSx2) / 2,
      chairScreenY + 6,
      chairPixelW / 2 + 8,
      chairPixelDepth / 2 + 6,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Chair Seat Cushion
    ctx.fillStyle = '#8b4513'; // Saddle brown
    ctx.strokeStyle = '#5c2d0c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(
      chairSx1,
      chairScreenY - chairPixelDepth / 2,
      chairPixelW,
      chairPixelDepth,
      6
    );
    ctx.fill();
    ctx.stroke();

    // Wooden Slats / Texture Detail
    ctx.fillStyle = '#a0522d';
    for (let sx = chairSx1 + 10; sx < chairSx2 - 8; sx += 14) {
      ctx.fillRect(sx, chairScreenY - chairPixelDepth / 2 + 3, 7, chairPixelDepth - 6);
    }

    // Chair Backrest bar (facing front toward cameras)
    ctx.fillStyle = '#5c2d0c';
    ctx.fillRect(chairSx1 - 2, chairScreenY + chairPixelDepth / 2 - 4, chairPixelW + 4, 6);

    // Chair label
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('近处物体：棕色椅子 (Z = 2.3m)', (chairSx1 + chairSx2) / 2, chairScreenY - 20);

    // 5. Draw Cameras
    // Camera t-1 at (0, 0)
    const cam0X = toScreenX(0);
    const cam0Y = toScreenY(0);

    // Camera t at (deltaX, 0)
    const camTX = toScreenX(deltaX);
    const camTY = toScreenY(0);

    // Draw Camera t-1 FOV frustum lines (Ghost blue)
    const maxFrustumX_0_left = -(config.bgZ * T);
    const maxFrustumX_0_right = config.bgZ * T;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cam0X, cam0Y);
    ctx.lineTo(toScreenX(maxFrustumX_0_left), bgScreenY);
    ctx.moveTo(cam0X, cam0Y);
    ctx.lineTo(toScreenX(maxFrustumX_0_right), bgScreenY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Camera t FOV frustum lines (Cyan)
    const maxFrustumX_t_left = deltaX - config.bgZ * T;
    const maxFrustumX_t_right = deltaX + config.bgZ * T;
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(camTX, camTY);
    ctx.lineTo(toScreenX(maxFrustumX_t_left), bgScreenY);
    ctx.moveTo(camTX, camTY);
    ctx.lineTo(toScreenX(maxFrustumX_t_right), bgScreenY);
    ctx.stroke();

    // Draw Camera t grazing sight rays passing chair silhouette
    const chairLeftWorld = config.chairX - chairHalfW;
    const chairRightWorld = config.chairX + chairHalfW;

    // Ray 1 from Cam t grazing chair left edge
    const dirLeft = (chairLeftWorld - deltaX) / config.chairZ;
    const bgHitLeft = deltaX + dirLeft * config.bgZ;
    // Ray 2 from Cam t grazing chair right edge
    const dirRight = (chairRightWorld - deltaX) / config.chairZ;
    const bgHitRight = deltaX + dirRight * config.bgZ;

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(camTX, camTY);
    ctx.lineTo(toScreenX(bgHitLeft), bgScreenY);
    ctx.moveTo(camTX, camTY);
    ctx.lineTo(toScreenX(bgHitRight), bgScreenY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 6. Draw Camera Icons
    // Camera t-1 Icon
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cam0X - 16, cam0Y - 10, 32, 20, 4);
    ctx.fill();
    ctx.stroke();
    // Lens
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(cam0X, cam0Y - 10, 6, Math.PI, 0);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('相机 (t-1)', cam0X, cam0Y + 24);
    ctx.font = '9px monospace';
    ctx.fillText('X = 0.0m', cam0X, cam0Y + 36);

    // Camera t Icon (Current, highlighted)
    ctx.fillStyle = '#0e7490';
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(camTX - 18, camTY - 11, 36, 22, 5);
    ctx.fill();
    ctx.stroke();
    // Lens
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(camTX, camTY - 11, 7, Math.PI, 0);
    ctx.fill();

    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('当前相机 (t)', camTX, camTY + 24);
    ctx.font = '9px monospace';
    ctx.fillText(`X = +${deltaX.toFixed(2)}m`, camTX, camTY + 36);

    // Horizontal motion arrow between cameras
    if (deltaX > 0.08) {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cam0X + 18, cam0Y);
      ctx.lineTo(camTX - 20, camTY);
      ctx.stroke();
      // Arrow head
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.moveTo(camTX - 20, camTY - 4);
      ctx.lineTo(camTX - 12, camTY);
      ctx.lineTo(camTX - 20, camTY + 4);
      ctx.fill();

      ctx.font = 'bold 9px monospace';
      ctx.fillText(`ΔX = +${deltaX.toFixed(2)}m`, (cam0X + camTX) / 2, cam0Y - 8);
    }

    // 7. Interactive Ray Tracing Demonstration:
    // If showRayTracing is true, trace ray from Cam(t) through inspected pixel (or center of disocclusion)
    // and trace the backward lookup ray to Cam(t-1), showing the collision with the chair!
    let targetNormU = hoverNormU;
    if (targetNormU === null && config.showRayTracing && disocc) {
      // Default to the center of the disocclusion area to illustrate the exact concept
      targetNormU = (disocc.screenMinU + disocc.screenMaxU) / 2;
    }

    if (config.showRayTracing && targetNormU !== null) {
      // Ray from Cam t:
      const rayHit = castRayFromCam(deltaX, targetNormU, config);
      const hitSx = toScreenX(rayHit.worldX);
      const hitSy = toScreenY(rayHit.worldZ);

      // 7.1 Forward sight ray from Cam(t)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(camTX, camTY - 11);
      ctx.lineTo(hitSx, hitSy);
      ctx.stroke();

      // Hit point halo
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(hitSx, hitSy, 5, 0, Math.PI * 2);
      ctx.fill();

      // 7.2 Backward Reprojection Ray from hit point towards Cam(t-1)
      // When Warping reprojects this world point back to Frame t-1:
      // The ray vector from world point (rayHit.worldX, rayHit.worldZ) to Cam(t-1) at (0, 0):
      ctx.strokeStyle = '#f43f5e'; // Bright Rose/Magenta
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(hitSx, hitSy);
      ctx.lineTo(cam0X, cam0Y - 10);
      ctx.stroke();
      ctx.setLineDash([]);

      // Check if backward ray intersects the chair at Z = chairZ!
      // Equation of line from (hit.worldX, hit.worldZ) to (0, 0):
      // At Z = chairZ, X = hit.worldX * (chairZ / hit.worldZ)
      const backwardXAtChair = rayHit.worldX * (config.chairZ / rayHit.worldZ);
      const hitsChairInPrevFrame =
        Math.abs(backwardXAtChair - config.chairX) <= chairHalfW;

      if (rayHit.object === 'background' && hitsChairInPrevFrame) {
        // COLLISION!
        const collSx = toScreenX(backwardXAtChair);
        const collSy = toScreenY(config.chairZ);

        // Explosion spark / beacon
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(collSx, collSy, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Pulsing rings
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(collSx, collSy, 14, 0, Math.PI * 2);
        ctx.stroke();

        // Text Callout on Canvas
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        const calloutX = Math.min(collSx + 16, width - 260);
        const calloutY = collSy + 10;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1.5;
        ctx.fillRect(calloutX - 6, calloutY - 14, 250, 42);
        ctx.strokeRect(calloutX - 6, calloutY - 14, 250, 42);

        ctx.fillStyle = '#f43f5e';
        ctx.fillText('💥 反查光线碰撞：命中上一帧椅子！', calloutX, calloutY);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '10px sans-serif';
        ctx.fillText('地砖采样顺着运动向量寻址，直接采到了椅背颜色', calloutX, calloutY + 16);

        setActiveRayInfo('该地砖像素在上一帧对应位置命中是椅子！(Disocclusion Collision)');
      } else {
        setActiveRayInfo(null);
      }
    } else {
      setActiveRayInfo(null);
    }
  }, [config, mode, hoverNormU]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const width = rect.width;

    // Map screen X directly to a ray angle or normalized screen coordinate u in [-1, 1]
    // Normalized u: -1 at left of FOV, +1 at right of FOV for current camera
    const normU = ((clientX / width) - 0.5) * 2;
    onHoverPixel(Math.max(-1, Math.min(1, normU)));
  };

  const handleCanvasMouseLeave = () => {
    onHoverPixel(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/70 rounded-xl border border-slate-800/80 overflow-hidden shadow-xl shadow-black/40">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Navigation className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-100">
            俯视物理几何与光线追踪仿真 (Top-Down 2D Physics)
          </h2>
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <span>交互式射线追踪</span>
        </div>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full min-h-[380px] bg-slate-950 flex items-center justify-center cursor-crosshair overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
        />

        {/* Legend Overlay */}
        <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg p-2.5 text-xs space-y-1.5 shadow-lg pointer-events-none">
          <div className="font-semibold text-slate-300 pb-1 border-b border-slate-800/80">
            图例说明 (Legend)
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-sm bg-[#8b4513] border border-[#5c2d0c]"></span>
            <span className="text-slate-300">近景物体：椅子 (Z=2.3m)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-sm bg-slate-400 border border-slate-700"></span>
            <span className="text-slate-300">远景背景：黑白条纹地砖 (Z=5.6m)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-sm bg-yellow-400/80 border border-yellow-500"></span>
            <span className="text-yellow-300 font-medium">反遮挡区域 (Disocclusion)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-0.5 bg-cyan-400"></span>
            <span className="text-cyan-300">当前帧视线 (Forward Ray)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-0.5 border-b border-dashed border-rose-500"></span>
            <span className="text-rose-400 font-medium">Warp 反查光线 (Backward Lookup)</span>
          </div>
        </div>

        {/* Dynamic Collision Toast */}
        {activeRayInfo && (
          <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 max-w-md bg-rose-950/90 border border-rose-500/80 rounded-lg p-3 text-xs text-rose-100 shadow-xl backdrop-blur-md flex items-start space-x-2.5 animate-in fade-in slide-in-from-bottom-2">
            <Sparkles className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-rose-200">反查光线冲突命中 (Occlusion Collision)</div>
              <p className="mt-0.5 text-rose-300/90">
                {activeRayInfo}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info Strip */}
      <div className="px-4 py-2 bg-slate-900/60 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <Info className="w-3.5 h-3.5 text-amber-400" />
          <span>在俯视图上移动鼠标可发射任意视线光线，观察反查路径是否穿过上一帧椅子。</span>
        </div>
        <div className="hidden sm:block text-slate-500 font-mono">
          FOV: {config.fovDegrees}° | ΔX: {getCameraDeltaX(config.cameraTranslation).toFixed(2)}m
        </div>
      </div>
    </div>
  );
};
