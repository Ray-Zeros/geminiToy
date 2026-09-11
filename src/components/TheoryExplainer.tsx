import React, { useState } from 'react';
import { HelpCircle, BookOpen, ChevronDown, ChevronUp, Cpu, Compass, ShieldAlert } from 'lucide-react';
import { WarpMode } from '../types';

interface TheoryExplainerProps {
  currentMode: WarpMode;
}

export const TheoryExplainer: React.FC<TheoryExplainerProps> = ({ currentMode }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-4 shadow-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mt-0.5">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <span>帧间重投影（Warping）重影伪影交互教学仿真</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                TAA / DLSS / TSR / VR SpaceWarp 原理
              </span>
            </h1>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-4xl">
              <strong>核心物理本质：</strong>当相机发生平移时，近景物体（椅子 Z=2.3m）与远景背景（地砖 Z=5.6m）产生<strong>不同大小的视差</strong>。
              椅子移开后，原本被挡住的地砖在当前帧被看见（<strong>反遮挡 Disocclusion</strong>）。
              若算法机械地顺着运动向量去上一帧（t-1）寻址颜色，而上一帧该射线位置保存的正是椅子，地砖就会被错误涂上椅背木纹，形成经典的<strong>双边缘重影伪影（Ghosting Artifact）</strong>！
            </p>
          </div>
        </div>

        <button
          id="toggle-deep-dive-btn"
          onClick={() => setExpanded(!expanded)}
          className="self-start md:self-center flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>{expanded ? '收起理论精讲' : '展开算法深度解析'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expandable Technical Guide */}
      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-4 text-xs text-slate-300">
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 space-y-1.5">
            <div className="font-bold text-amber-300 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>1. 模式 A: 单应性变换 (Homography)</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              早期移动端或全景重投影常假设“场景处于无穷远或单一深度平面”。
              当场景存在近物（椅子）时，视差与深度成反比（$Disparity \propto 1/Z$）。
              椅子视差远大于地面，如果按地面平移，椅子完全错位，产生严重的多重鬼影。
            </p>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 space-y-1.5">
            <div className="font-bold text-rose-300 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span>2. 模式 B: Naive MV 反遮挡重影</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              现代引擎记录每个像素的真实 Depth 与 Motion Vector。椅子本身对齐完美，
              但<strong>历史颜色缓冲（Frame t-1）只有一个最前面的表面</strong>。
              新露出的地砖向后反查时，上一帧该像素根本没有地砖的信息（只有遮挡它的椅背），造成强行采样椅背，留下“拖尾重影”。
            </p>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 space-y-1.5">
            <div className="font-bold text-emerald-300 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>3. 模式 C: 工业界标准解决路径</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              <strong>深度差剔除 (Depth Disocclusion Rejection)：</strong> 比较 Z_prev(u_prev) 与 Z_curr(u)。
              当发现历史深度明显更近（2.3m ≪ 5.6m），立即判定遮挡失效，生成拒绝空洞Mask。
              后续通过当前帧实时渲染或邻域颜色夹持（Color Clamping / AABB Clip）补全新地砖，彻底无重影。
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
