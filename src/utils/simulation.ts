import { SceneConfig, WarpMode, PixelSampleInfo, DisocclusionRange } from '../types';

export const DEFAULT_CONFIG: SceneConfig = {
  cameraTranslation: 45, // 0 to 100, gives clean visible parallax
  chairZ: 2.3,
  chairX: 0.0,
  chairWidth: 1.1,
  bgZ: 5.6,
  fovDegrees: 56,
  showRayTracing: true,
  highlightGhosting: true,
  autoAnimate: false,
  inspectPixelNorm: null,
};

export function getCameraDeltaX(sliderVal: number): number {
  // Map 0-100 to 0.0m - 1.1m
  return (sliderVal / 100) * 1.05;
}

export function getTanHalfFov(fovDeg: number): number {
  return Math.tan(((fovDeg / 2) * Math.PI) / 180);
}

// Background tile pattern colors
export function getTileColorAtWorldX(worldX: number): { hex: string; isDark: boolean } {
  const tileSize = 0.32; // 32cm tiles
  const tileIndex = Math.floor(worldX / tileSize);
  const isDark = Math.abs(tileIndex) % 2 === 1;
  return {
    hex: isDark ? '#1e293b' : '#94a3b8', // Slate-800 vs Slate-400
    isDark,
  };
}

// Chair texture color based on internal coordinate
export function getChairColor(relativeX: number): string {
  // Wood texture tone with vertical slat borders
  const norm = (relativeX + 0.5); // 0 to 1
  const slat = Math.sin(norm * Math.PI * 8);
  if (slat > 0.85) {
    return '#5c2d0c'; // darker wood grain line
  }
  return '#8b4513'; // saddle brown
}

// Calculate the exact world interval of disocclusion on the background plane (Z = bgZ)
export function calculateDisocclusion(config: SceneConfig): DisocclusionRange | null {
  const deltaX = getCameraDeltaX(config.cameraTranslation);
  if (deltaX <= 0.01) return null;

  const T = getTanHalfFov(config.fovDegrees);
  const chairHalfW = config.chairWidth / 2;
  const chairLeft = config.chairX - chairHalfW;
  const chairRight = config.chairX + chairHalfW;

  // In Frame t-1 (Cam at 0):
  // Rays passing chair edges:
  // ray_left = chairLeft / chairZ, ray_right = chairRight / chairZ
  // Occluded region on background plane Z = bgZ:
  const occMinWorldX_tMinus1 = (chairLeft / config.chairZ) * config.bgZ;
  const occMaxWorldX_tMinus1 = (chairRight / config.chairZ) * config.bgZ;

  // In Frame t (Cam at deltaX):
  // Chair silhouette rays from deltaX:
  // ray_left_t = (chairLeft - deltaX) / chairZ
  // ray_right_t = (chairRight - deltaX) / chairZ
  // Occluded region on background in Frame t:
  const occMinWorldX_t = deltaX + ((chairLeft - deltaX) / config.chairZ) * config.bgZ;
  const occMaxWorldX_t = deltaX + ((chairRight - deltaX) / config.chairZ) * config.bgZ;

  // Disoccluded area: points on background that were occluded at t-1 (inside [occMin_t-1, occMax_t-1])
  // but are VISIBLE at frame t (outside [occMin_t, occMax_t]).
  // Since camera moved right (deltaX > 0), the chair's shadow at t moves to the left!
  // So the newly uncovered region is on the right side of the t shadow, specifically between occMaxWorldX_t and occMaxWorldX_tMinus1
  const disoccMinX = Math.max(occMinWorldX_tMinus1, occMaxWorldX_t);
  const disoccMaxX = occMaxWorldX_tMinus1;

  if (disoccMaxX <= disoccMinX + 0.02) return null;

  // Project to screen coords in frame t:
  const screenMinU = (disoccMinX - deltaX) / (config.bgZ * T);
  const screenMaxU = (disoccMaxX - deltaX) / (config.bgZ * T);

  // In frame t-1 screen coords:
  const prevScreenMinU = disoccMinX / (config.bgZ * T);
  const prevScreenMaxU = disoccMaxX / (config.bgZ * T);

  return {
    worldMinX: disoccMinX,
    worldMaxX: disoccMaxX,
    screenMinU,
    screenMaxU,
    prevScreenMinU,
    prevScreenMaxU,
  };
}

// Ray cast from a camera position in world coordinates to find hit object, depth and color
export function castRayFromCam(
  camX: number,
  u: number,
  config: SceneConfig
): {
  object: 'chair' | 'background';
  depth: number;
  worldX: number;
  worldZ: number;
  color: string;
} {
  const T = getTanHalfFov(config.fovDegrees);
  const chairHalfW = config.chairWidth / 2;

  // At chair depth Z = chairZ:
  const worldXAtChair = camX + config.chairZ * u * T;
  const isHitChair =
    worldXAtChair >= config.chairX - chairHalfW &&
    worldXAtChair <= config.chairX + chairHalfW;

  if (isHitChair) {
    const relX = (worldXAtChair - config.chairX) / config.chairWidth;
    return {
      object: 'chair',
      depth: config.chairZ,
      worldX: worldXAtChair,
      worldZ: config.chairZ,
      color: getChairColor(relX),
    };
  }

  // Hit background plane Z = bgZ
  const worldXAtBg = camX + config.bgZ * u * T;
  const tile = getTileColorAtWorldX(worldXAtBg);
  return {
    object: 'background',
    depth: config.bgZ,
    worldX: worldXAtBg,
    worldZ: config.bgZ,
    color: tile.hex,
  };
}

// Sample a single pixel in Screen Space t and evaluate warping behavior
export function evaluatePixel(
  u: number,
  mode: WarpMode,
  config: SceneConfig
): PixelSampleInfo {
  const deltaX = getCameraDeltaX(config.cameraTranslation);
  const T = getTanHalfFov(config.fovDegrees);

  // 1. Ground truth ray in Frame t
  const currHit = castRayFromCam(deltaX, u, config);

  // 2. Determine previous frame coordinate u_prev based on warping mode
  let prevU = 0;
  let explanation = '';
  let isGhostArtifact = false;
  let isDisoccluded = false;

  if (mode === 'homography') {
    // Mode A: Flat ground homography assumption: assumes everything is at bgZ
    prevU = u + deltaX / (config.bgZ * T);
    if (currHit.object === 'chair') {
      // Chair is at chairZ << bgZ, so its true motion vector was much larger!
      // Here it was under-displaced, causing severe misalignment ghosting
      isGhostArtifact = deltaX > 0.05;
      explanation = '【模式A: 单应性变换】假设全图为同深度背景平面。椅子真实深度为2.3m，但仅按5.6m地砖视差重投影，产生严重视差双边缘错位重影！';
    } else {
      explanation = '【模式A: 单应性变换】背景地砖刚好符合该深度的单应性假设，地砖纹理对齐良好。';
    }
  } else if (mode === 'naive_mv') {
    // Mode B: True per-pixel motion vector based on depth buffer at t
    prevU = u + deltaX / (currHit.depth * T);

    // In Frame t-1, what was at prevU?
    const prevHit = castRayFromCam(0, prevU, config);

    if (currHit.object === 'background' && prevHit.object === 'chair') {
      // Disocclusion artifact!
      isDisoccluded = true;
      isGhostArtifact = true;
      explanation = '【模式B: 反遮挡重影 (Disocclusion Ghosting)】当前视角看到地砖，按运动向量反查上一帧 t-1 时，该位置在上一帧被椅子挡住，因此从历史缓冲中错误采到了上一帧的椅背纹理，形成了虚假木纹边缘！';
    } else if (currHit.object === 'chair') {
      explanation = '【模式B: 运动向量对齐】当前为椅子，反查上一帧精准命中椅子，纹理清晰锐利。';
    } else {
      explanation = '【模式B: 正常背景对齐】当前为地砖，且在上一帧也是可见地砖，反查采样成功。';
    }
  } else {
    // Mode C: Depth-Aware Occlusion Culling (DLSS / TAA / TSR logic)
    prevU = u + deltaX / (currHit.depth * T);
    const prevHit = castRayFromCam(0, prevU, config);

    if (currHit.object === 'background' && prevHit.object === 'chair') {
      isDisoccluded = true;
      isGhostArtifact = false; // Resolved by culling!
      explanation = '【模式C: 遮挡剔除/有效性判定】检测到深度冲突（历史采样深度为2.3m椅子，当前像素为5.6m地砖）。判定为反遮挡空洞（Disocclusion Hole），标记为剔除Mask并回退重新着色，杜绝了重影！';
    } else {
      explanation = '【模式C: 深度验证通过】历史深度与当前投影深度一致，接受历史重投影颜色。';
    }
  }

  // Sample Frame t-1 color buffer
  let sampledColor = '#0f172a';
  let prevDepth = 0;
  let prevObject: 'chair' | 'background' | 'out_of_bounds' = 'out_of_bounds';

  if (prevU >= -1 && prevU <= 1) {
    const prevHit = castRayFromCam(0, prevU, config);
    prevDepth = prevHit.depth;
    prevObject = prevHit.object;

    if (mode === 'depth_occlusion' && isDisoccluded) {
      // Masked out in Mode C! Shown as distinct rejection mask color or shaded ground truth
      sampledColor = '#090d16'; // Masked black/hole indicator
    } else {
      sampledColor = prevHit.color;
    }
  } else {
    prevObject = 'out_of_bounds';
    sampledColor = '#020617';
    if (mode === 'depth_occlusion') {
      explanation = '【视锥外剔除】上一帧对应像素已移出屏幕视锥之外，拒绝历史采样。';
    }
  }

  return {
    u,
    currDepth: currHit.depth,
    currObject: currHit.object,
    currColor: currHit.color,
    prevU,
    prevDepth,
    prevObject,
    sampledColor,
    isDisoccluded,
    isGhostArtifact,
    mode,
    explanation,
  };
}
