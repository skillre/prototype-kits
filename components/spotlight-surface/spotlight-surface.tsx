"use client";

/**
 * SpotlightSurface —— 内部稳定 API v1
 *
 * ---------------------------------------------------------------------------
 * 这个组件是做什么的
 * ---------------------------------------------------------------------------
 * 一块**会响应指针的表面**：指针位置在表面上形成一片局部光斑 / 高光，
 * 内容（children）照常渲染，不受影响。
 *
 * ---------------------------------------------------------------------------
 * 契约范例（题面明确要求的产品调用形状）
 * ---------------------------------------------------------------------------
 *     <SpotlightSurface tone="brand" intensity="medium">
 *       …
 *     </SpotlightSurface>
 *
 * 产品**只能**说「什么语调（tone）+ 多强（intensity）」，
 * 不能说「什么颜色（#4fd6ff）+ 多大半径（240px）」。
 * 因为前者是产品语义，后者是实现细节 —— 后者一旦进入产品代码，
 * 换风格、换第三方便成了全站重构。
 *
 * ---------------------------------------------------------------------------
 * 常见错误对照
 * ---------------------------------------------------------------------------
 *   ❌ <FancyGlowCard glowColor="#4fd6ff" blurRadius={24} opacity={0.6} />
 *   ✅ <SpotlightSurface tone="brand" intensity="medium" />
 *
 *   ❌ 为了让光斑"更大一点"，从产品传 size={320}
 *   ✅ 换 Style Pack（cinematic 的 --kits-spotlight-size 是 320px，
 *      editorial 是 220px 且 opacity 为 0 —— 因为纸质表面不该有光斑）
 *
 * ---------------------------------------------------------------------------
 * Adapter 说明
 * ---------------------------------------------------------------------------
 * 若底层替换为第三方实现（例如某个 FancyGlowCard / MagicCard）：
 *   1. 第三方进入 incoming/ 走完整审计流程；
 *   2. 在 adapters/ 下写映射：tone → 第三方 color、intensity → 第三方 blur/opacity；
 *   3. 产品调用**一行不改**。
 */

import type { ReactNode } from "react";
import {
  cx,
  resolveToneVars,
  type Intensity,
  type MotionFallbackProps,
  type Tone,
} from "@kits/react-utils";
import { useElementPointer } from "@kits/react-utils";
import "./spotlight-surface.css";

export interface SpotlightSurfaceProps extends MotionFallbackProps {
  children?: ReactNode;
  /** 语调：映射到 Style Pack 的颜色槽位。默认 `neutral`。 */
  tone?: Tone;
  /**
   * 强度：`none` 完全关闭光斑（仍然保留表面）。
   * 注意 —— 光斑的**绝对大小**由 Style Pack 决定，这里只调强弱。
   */
  intensity?: Intensity;
  /** 表面质感。`glass` 只在 cinematic 下有意义，其他 pack 会退化为平面。 */
  surface?: "plain" | "glass";
  /** 语义元素。默认 `div`；列表里可用 `li`。 */
  as?: "div" | "li" | "section" | "article";
  /** 是否裁切超出表面的内容（光斑超出时必须裁切） */
  clip?: boolean;
  className?: string;
  id?: string;
}

export function SpotlightSurface({
  children,
  tone = "neutral",
  intensity = "medium",
  surface = "plain",
  as: Element = "div",
  clip = true,
  disableMotion = false,
  className,
  id,
}: SpotlightSurfaceProps) {
  const { ref, enabled } = useElementPointer({
    disableMotion,
    // 光斑用 [0, 1] 定位（CSS 里当成百分比），而不是 [-1, 1] 视差坐标
    normalized: false,
    restValue: { x: 0.5, y: 0 },
  });

  return (
    <Element
      ref={ref as React.Ref<never>}
      id={id}
      className={cx(
        "kits-spotlight",
        `kits-spotlight--${surface}`,
        clip && "kits-spotlight--clip",
        !enabled && "kits-spotlight--static",
        className,
      )}
      data-kits-component="spotlight-surface"
      data-kits-tone={tone}
      data-kits-intensity={intensity}
      style={resolveToneVars(tone, intensity) as React.CSSProperties}
    >
      {/* 光斑层：纯装饰，必须同时退出无障碍树与命中测试 */}
      <span className="kits-spotlight__veil" aria-hidden="true" />
      <span className="kits-spotlight__content">{children}</span>
    </Element>
  );
}

export default SpotlightSurface;
