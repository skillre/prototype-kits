"use client";

/**
 * AnimatedGrid —— Demo
 *
 * 演示要点：同一份调用在三种 Style Pack 下的"自动降级"。
 *
 *   <AnimatedGrid />  →  editorial 里网格根本不会出现
 *                        （--kits-grid-line-width = 0px）
 *                      →  cinematic 里是 64px 网格 + 55% 淡出
 *                      →  instrument 里是 32px 硬网格 + 22% 淡出（网格即刻度）
 *
 * 组件调用没有一行不同。
 */

import { AnimatedGrid } from "./animated-grid.tsx";
import type { GridCell, GridFade, GridMotion } from "./animated-grid.tsx";

export interface AnimatedGridDemoProps {
  cell?: GridCell;
  fade?: GridFade;
  motion?: GridMotion;
}

export function AnimatedGridDemo({
  cell = "normal",
  fade = "medium",
  motion = "none",
}: AnimatedGridDemoProps) {
  return (
    <div className="kits-demo-stage">
      <AnimatedGrid cell={cell} fade={fade} motion={motion} />
      <div className="kits-demo-stage__content">
        <p className="kits-label">Grid · {cell} / {fade} / {motion}</p>
        <p className="kits-body">
          网格是装饰层：aria-hidden、pointer-events:none、z-index:-1。
          它不承载任何信息，屏幕阅读器不会读到它。
        </p>
      </div>
    </div>
  );
}

export default AnimatedGridDemo;
