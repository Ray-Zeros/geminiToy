import React from 'react';
import { SceneConfig, WarpMode } from '../types';
import { getCameraDeltaX } from '../utils/simulation';
import {
  Sliders,
  Eye,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  AlertOctagon,
  Sparkles,
} from 'lucide-react';

interface ControlPanelProps {
  config: SceneConfig;
  onChangeConfig: (newConfig: Partial<SceneConfig>) => void;
  mode: WarpMode;
  onChangeMode: (newMode: WarpMode) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  config,
  onChangeConfig,
  mode,
  onChangeMode,
}) => {
  const deltaX = getCameraDeltaX(config.cameraTranslation);

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 shadow-xl shadow-black/30 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-100">
            交互控制台 (Simulation Control Console)
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            id="toggle-animation-btn"
            onClick={() => onChangeConfig({ autoAnimate: !config.autoAnimate })}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              config.autoAnimate
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            {config.autoAnimate ? (
              <>
                <Pause className="w-3 h-3 text-cyan-400" />
                <span>暂停摆动</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-slate-400" />
                <span>自动平移摆动</span>
              </>
            )}
          </button>

          <button
            id="reset-cam-btn"
            onClick={() => onChangeConfig({ cameraTranslation: 45, autoAnimate: false })}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition"
            title="重置平移"
          >
            <RotateCcw className="w-3 h-3" />
            <span>重置</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* 1. Camera Translation Slider */}
        <div className="lg:col-span-5 space-y-2 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">
              1. 相机水平平移 (Camera Translation)
            </span>
            <span className="font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60 font-medium">
              ΔX = {deltaX.toFixed(2)}m ({config.cameraTranslation}%)
            </span>
          </div>

          <div className="pt-1">
            <input
              id="camera-translation-slider"
              type="range"
              min="0"
              max="100"
              value={config.cameraTranslation}
              onChange={(e) =>
                onChangeConfig({ cameraTranslation: Number(e.target.value) })
              }
              className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer transition-all"
            />
          </div>

          <div className="flex justify-between text-[11px] text-slate-500 font-mono pt-0.5">
            <span>0% (无位移)</span>
            <span>50% (中度视差)</span>
            <span>100% (最大视差 1.05m)</span>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
            拖动滑块移动“当前帧相机 (t)”。由于椅子 (Z=2.3m) 离相机近、地砖 (Z=5.6m) 离相机远，产生强烈的<strong>深度视差</strong>。
          </p>
        </div>

        {/* 2. Warp Mode Selector */}
        <div className="lg:col-span-7 space-y-2">
          <div className="text-xs font-semibold text-slate-200">
            2. 模式切换 (Warp Algorithm Mode)
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {/* Mode A */}
            <button
              id="mode-homography-btn"
              onClick={() => onChangeMode('homography')}
              className={`text-left p-3 rounded-lg border transition-all flex flex-col justify-between ${
                mode === 'homography'
                  ? 'bg-amber-950/40 border-amber-500/80 shadow-md shadow-amber-950/30'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div>
                <div className="flex items-center space-x-1.5 pb-1">
                  <AlertOctagon
                    className={`w-3.5 h-3.5 ${
                      mode === 'homography' ? 'text-amber-400' : 'text-slate-500'
                    }`}
                  />
                  <span
                    className={`text-xs font-bold ${
                      mode === 'homography' ? 'text-amber-200' : 'text-slate-300'
                    }`}
                  >
                    模式 A：无深度
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mb-1.5">
                  单应性变换 (Homography)
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  假设全图为单一地面。地面对齐了，但近处椅子位移步长严重不足，产生巨大视差双影。
                </p>
              </div>
              <div
                className={`mt-2.5 text-[10px] font-semibold px-2 py-0.5 rounded text-center ${
                  mode === 'homography'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                视差错位重影
              </div>
            </button>

            {/* Mode B */}
            <button
              id="mode-naive-mv-btn"
              onClick={() => onChangeMode('naive_mv')}
              className={`text-left p-3 rounded-lg border transition-all flex flex-col justify-between ${
                mode === 'naive_mv'
                  ? 'bg-rose-950/40 border-rose-500/80 shadow-md shadow-rose-950/30'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div>
                <div className="flex items-center space-x-1.5 pb-1">
                  <AlertOctagon
                    className={`w-3.5 h-3.5 ${
                      mode === 'naive_mv' ? 'text-rose-400' : 'text-slate-500'
                    }`}
                  />
                  <span
                    className={`text-xs font-bold ${
                      mode === 'naive_mv' ? 'text-rose-200' : 'text-slate-300'
                    }`}
                  >
                    模式 B：无遮挡检测
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mb-1.5">
                  Naive Motion Vector
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  有真实运动向量，椅子对齐了。但在新露出的反遮挡地砖处，错误采到了上一帧的椅背木纹！
                </p>
              </div>
              <div
                className={`mt-2.5 text-[10px] font-semibold px-2 py-0.5 rounded text-center ${
                  mode === 'naive_mv'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                典型反遮挡重影
              </div>
            </button>

            {/* Mode C */}
            <button
              id="mode-depth-occlusion-btn"
              onClick={() => onChangeMode('depth_occlusion')}
              className={`text-left p-3 rounded-lg border transition-all flex flex-col justify-between ${
                mode === 'depth_occlusion'
                  ? 'bg-emerald-950/40 border-emerald-500/80 shadow-md shadow-emerald-950/30'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div>
                <div className="flex items-center space-x-1.5 pb-1">
                  <CheckCircle
                    className={`w-3.5 h-3.5 ${
                      mode === 'depth_occlusion'
                        ? 'text-emerald-400'
                        : 'text-slate-500'
                    }`}
                  />
                  <span
                    className={`text-xs font-bold ${
                      mode === 'depth_occlusion'
                        ? 'text-emerald-200'
                        : 'text-slate-300'
                    }`}
                  >
                    模式 C：完整方案
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mb-1.5">
                  Depth + 遮挡剔除 (TAA/DLSS)
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  比较投影深度与历史深度。发现冲突时标记为空洞Mask并剔除历史，彻底根除重影。
                </p>
              </div>
              <div
                className={`mt-2.5 text-[10px] font-semibold px-2 py-0.5 rounded text-center ${
                  mode === 'depth_occlusion'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                重影彻底消除
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Toggles Strip */}
      <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-800/80 text-xs gap-3">
        <div className="flex items-center space-x-5">
          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              id="show-ray-tracing-checkbox"
              type="checkbox"
              checked={config.showRayTracing}
              onChange={(e) =>
                onChangeConfig({ showRayTracing: e.target.checked })
              }
              className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
            />
            <span className="text-slate-300 font-medium flex items-center space-x-1.5">
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              <span>显示反查光线 (Show Ray-tracing)</span>
            </span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              id="highlight-ghosting-checkbox"
              type="checkbox"
              checked={config.highlightGhosting}
              onChange={(e) =>
                onChangeConfig({ highlightGhosting: e.target.checked })
              }
              className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0 cursor-pointer"
            />
            <span className="text-slate-300 font-medium flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-rose-400" />
              <span>标注重影框 (Highlight Ghost Artifacts)</span>
            </span>
          </label>
        </div>

        <div className="text-[11px] text-slate-400">
          勾选“显示反查光线”后，在俯视图或画面中悬停，可透视光线反向命中历史椅子的全过程。
        </div>
      </div>
    </div>
  );
};
