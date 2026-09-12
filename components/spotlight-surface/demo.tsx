"use client";

/**
 * SpotlightSurface —— Demo
 *
 * 这是 Adapter 契约的现场示范：同一份调用，在三个 Style Pack 下
 * 得到三种完全不同的结果，而**组件调用没有一行不同**：
 *
 *   editorial   → --kits-spotlight-opacity: 0    → 光斑消失，只剩纸质表面
 *   cinematic   → 320px + opacity 0.5 + factor 1 → 明显的跟随光斑
 *   instrument  → 140px + opacity 0.16 + factor 0.4 → 呼吸灯式的读数高光
 */

import { SpotlightSurface } from "./spotlight-surface.tsx";
import type { Intensity, Tone } from "@kits/react-utils";

export interface SpotlightSurfaceDemoProps {
  tone?: Tone;
  intensity?: Intensity;
  surface?: "plain" | "glass";
}

export function SpotlightSurfaceDemo({
  tone = "brand",
  intensity = "medium",
  surface = "plain",
}: SpotlightSurfaceDemoProps) {
  return (
    <div className="kits-demo-stack">
      <SpotlightSurface tone={tone} intensity={intensity} surface={surface}>
        <p className="kits-label">Active signal</p>
        <p className="kits-data">1,284</p>
        <p className="kits-body">
          相对上一周期上升 12.4%，主要来自华东区域的读取路径压缩。
        </p>
      </SpotlightSurface>

      <SpotlightSurface tone="critical" intensity="subtle">
        <p className="kits-label">Anomaly</p>
        <p className="kits-body">3 个节点在 04:12 出现延迟尖峰。</p>
      </SpotlightSurface>
    </div>
  );
}

export default SpotlightSurfaceDemo;
