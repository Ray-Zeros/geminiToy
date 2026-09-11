export type WarpMode = 'homography' | 'naive_mv' | 'depth_occlusion';

export interface SceneConfig {
  cameraTranslation: number; // 0 to 100
  chairZ: number;           // ~2.3m
  chairX: number;           // 0.0m
  chairWidth: number;       // 1.2m
  bgZ: number;              // 5.8m
  fovDegrees: number;       // e.g. 55 deg
  showRayTracing: boolean;
  highlightGhosting: boolean;
  autoAnimate: boolean;
  inspectPixelNorm: number | null; // -1 to 1 screen space coord
}

export interface PixelSampleInfo {
  u: number;                 // normalized screen coordinate [-1, 1]
  currDepth: number;         // depth at t
  currObject: 'chair' | 'background';
  currColor: string;
  prevU: number;             // reprojected coordinate in frame t-1
  prevDepth: number;         // depth stored in t-1 at prevU
  prevObject: 'chair' | 'background' | 'out_of_bounds';
  sampledColor: string;
  isDisoccluded: boolean;
  isGhostArtifact: boolean;
  mode: WarpMode;
  explanation: string;
}

export interface DisocclusionRange {
  worldMinX: number;
  worldMaxX: number;
  screenMinU: number;
  screenMaxU: number;
  prevScreenMinU: number;
  prevScreenMaxU: number;
}
