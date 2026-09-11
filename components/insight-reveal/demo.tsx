"use client";

/**
 * InsightReveal —— Demo
 *
 * 演示要点：**同一份 JSX 在三种 pack 下是三种节奏**。
 *
 *   editorial   70ms/段 · 10px 位移 · 无模糊   → 像印刷品的段落顺序
 *   cinematic  110ms/段 · 24px 位移 · 6px 模糊 → 像镜头依次对焦
 *   instrument  25ms/段 ·  4px 位移 · 无模糊   → 像扫描仪逐行点亮
 *
 * 组件调用没有一行不同 —— 节奏住在 pack 的 motion.ts 里。
 */

import { InsightReveal } from "./insight-reveal.tsx";
import type { RevealShift, RevealStep } from "./insight-reveal.tsx";

export interface InsightRevealDemoProps {
  step?: RevealStep;
  shift?: RevealShift;
  blur?: boolean;
}

export function InsightRevealDemo({
  step = "group",
  shift = "medium",
  blur = false,
}: InsightRevealDemoProps) {
  return (
    <InsightReveal step={step} shift={shift} blur={blur}>
      <div>
        <p className="kits-label">Insight 01</p>
        <h3 className="kits-title">读取路径被压缩了 4 倍</h3>
        <p className="kits-body">
          原本需要四次串行读取的操作被合并为一次并行获取，P99 从 720ms 降到 184ms。
        </p>
      </div>

      <div>
        <p className="kits-label">Insight 02</p>
        <h3 className="kits-title">异常集中在两个时段</h3>
        <p className="kits-body">
          04:00–04:20 与 13:40–14:00 的延迟尖峰由同一批批处理任务引起。
        </p>
      </div>

      <div>
        <p className="kits-label">Insight 03</p>
        <h3 className="kits-title">下个周期的三个动作</h3>
        <p className="kits-body">
          调整批处理窗口、给华东区域增加一个只读副本、把 P99 纳入发布门禁。
        </p>
      </div>
    </InsightReveal>
  );
}

export default InsightRevealDemo;
