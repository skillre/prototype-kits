"use client";

/**
 * InteractiveHero —— 内部稳定 API v1
 *
 * ---------------------------------------------------------------------------
 * 这个组件是做什么的
 * ---------------------------------------------------------------------------
 * 首屏「第一视觉」。它只负责**结构、节奏与交互行为**，
 * 不负责任何视觉决策：字号、字距、留白、圆角、颜色、动效幅度
 * 全部来自当前 Style Pack 的 `var(--kits-*)`。
 *
 * ---------------------------------------------------------------------------
 * 稳定 API（产品只允许用这些）
 * ---------------------------------------------------------------------------
 *   eyebrow?   上方的小标签（可选）
 *   title      主标题（必填，DOM 里是一个 h1，语义层级不因为样式而变）
 *   lead?      导语段
 *   actions?   行动区（按钮等）
 *   media?     视觉插槽（图表 / 画布 / 视频 / 任意节点）
 *   align      "start" | "center"
 *   depth      视差强度：none | subtle | medium | strong
 *   disableMotion?  仅产品级"用户主动关闭动画"开关 —— 触屏与
 *                   prefers-reduced-motion 的降级组件已内建，不需要产品处理
 *
 * ---------------------------------------------------------------------------
 * 明确**不属于** API 的东西（禁止暴露，禁止产品传入）
 * ---------------------------------------------------------------------------
 *   glowColor / blurRadius / fontSize / padding / borderRadius / easing …
 *   任何视觉字面量。需要改这些 → 改 Style Pack，不要改组件调用。
 *
 * ---------------------------------------------------------------------------
 * Adapter 说明
 * ---------------------------------------------------------------------------
 * 若未来引入第三方 Hero 实现（例如某个 FancyHero），正确做法是：
 *   1. 把第三方放到 incoming/components/，走完整 incoming 流程；
 *   2. 在本目录新增 `adapters/fancy-hero.tsx`，把
 *      `<FancyHero splitText glowColor="…" />` 包成
 *      本组件相同的 props 形状；
 *   3. 产品代码**一行都不改**，只把内部实现替换掉。
 *   → 产品永远只依赖 `title` / `lead` / `actions` 这些产品语义。
 */

import type { ReactNode } from "react";
import {
  cx,
  type Intensity,
  type MotionFallbackProps,
} from "../_shared/contract.ts";
import { useParallaxLayers } from "../_shared/use-parallax-layers.ts";
import "./interactive-hero.css";

export interface InteractiveHeroProps extends MotionFallbackProps {
  /** 主标题。渲染为 `h1`，可用 `as` 改层级。 */
  title: ReactNode;
  /** 导语 */
  lead?: ReactNode;
  /** 标题上方的小标签 */
  eyebrow?: ReactNode;
  /** 行动区（按钮、链接……） */
  actions?: ReactNode;
  /** 视觉插槽：图表、画布、视频或任意节点 */
  media?: ReactNode;
  /** 视觉插槽的位置。`background` 让 media 铺满整个 hero 作为背板。 */
  mediaPlacement?: "side" | "below" | "background";
  align?: "start" | "center";
  /** 视差强度。`none` 表示完全静态（也会在触屏上自动变成 none）。 */
  depth?: Intensity;
  /** 标题的语义层级。默认 `h1`。 */
  as?: "h1" | "h2";
  className?: string;
  id?: string;
}

/**
 * 视差深度表 —— 这些数字是**结构**（哪一层比哪一层浅），不是"效果强弱"。
 * 效果强弱由 `depth` prop 与 pack 的 `--kits-pointer-factor` 共同决定。
 */
const LAYER_DEPTH = {
  eyebrow: 0.25,
  title: 0.55,
  lead: 0.75,
  actions: 0.9,
  media: 0.15,
} as const;

const DEPTH_SCALE: Record<Intensity, number> = {
  none: 0,
  subtle: 0.4,
  medium: 1,
  strong: 1.7,
};

export function InteractiveHero({
  title,
  lead,
  eyebrow,
  actions,
  media,
  mediaPlacement = "side",
  align = "start",
  depth = "subtle",
  as: Heading = "h1",
  disableMotion = false,
  className,
  id,
}: InteractiveHeroProps) {
  const { ref, enabled } = useParallaxLayers(disableMotion);
  const scale = DEPTH_SCALE[depth];

  const layerStyle = (name: keyof typeof LAYER_DEPTH) => ({
    // 深度值只作为 data 属性存在；具体偏移量由 use-parallax-layers 计算并写入
    // --kits-layer-dx / --kits-layer-dy（CSS 变量），样式表负责使用它们。
    ["data-kits-depth" as string]: String(LAYER_DEPTH[name] * scale),
  });

  return (
    <section
      ref={ref}
      id={id}
      className={cx(
        "kits-hero",
        `kits-hero--media-${mediaPlacement}`,
        `kits-hero--${align}`,
        !enabled && "kits-hero--static",
        className,
      )}
      data-kits-component="interactive-hero"
      data-kits-depth-active={enabled ? "true" : "false"}
    >
      <div className="kits-hero__inner">
        <div className="kits-hero__copy">
          {eyebrow ? (
            <p className="kits-label kits-hero__eyebrow" {...layerStyle("eyebrow")}>
              {eyebrow}
            </p>
          ) : null}

          <Heading className="kits-display kits-hero__title" {...layerStyle("title")}>
            {title}
          </Heading>

          {lead ? (
            <p className="kits-lead kits-hero__lead" {...layerStyle("lead")}>
              {lead}
            </p>
          ) : null}

          {actions ? (
            <div className="kits-hero__actions" {...layerStyle("actions")}>
              {actions}
            </div>
          ) : null}
        </div>

        {media && mediaPlacement !== "background" ? (
          <div
            className="kits-hero__media"
            data-kits-media="true"
            {...layerStyle("media")}
          >
            {media}
          </div>
        ) : null}
      </div>

      {media && mediaPlacement === "background" ? (
        <div className="kits-hero__backdrop" aria-hidden="true">
          {media}
        </div>
      ) : null}
    </section>
  );
}

export default InteractiveHero;
