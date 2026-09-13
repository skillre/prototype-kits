"use client";

/**
 * AnimatedGrid —— 内部稳定 API v1
 *
 * ---------------------------------------------------------------------------
 * 这个组件是做什么的
 * ---------------------------------------------------------------------------
 * 一层**结构性的背景网格**：给界面一个"空间度量"，让内容看起来像是
 * 被放置在一个有尺度的面上，而不是浮在虚空里。
 *
 * 它是纯装饰：`aria-hidden="true"`、`pointer-events: none`、`z-index: -1`，
 * 不进入无障碍树、不拦截交互、不承载任何信息。
 *
 * ---------------------------------------------------------------------------
 * 稳定 API（产品只允许用这些）
 * ---------------------------------------------------------------------------
 *   cell?    网格密度（"none" 表示不画格子，只保留其它层）
 *   fade?    边缘淡出强度 —— 决定网格是"铺满"还是"中心聚光"
 *   motion?  网格动效：none / drift / pulse（语义化，不是速度值）
 *   placement?  absolute（作为容器背景）| fixed（作为全屏底纹）
 *
 * ---------------------------------------------------------------------------
 * 明确**不属于** API 的东西
 * ---------------------------------------------------------------------------
 *   lineColor / lineWidth / cellSize(px) / speed / opacity / blurRadius …
 *   线条颜色来自 --kits-grid-line-color，格子尺寸来自 --kits-grid-cell，
 *   淡出半径来自 --kits-grid-fade —— 全部由 Style Pack 决定。
 *   需要改这些 → 改 pack。
 *
 * ---------------------------------------------------------------------------
 * motion 的语义（不是"强弱"）
 * ---------------------------------------------------------------------------
 *   "none"  完全静态。instrument 档位：仪表不呼吸。
 *   "drift" 环境动效（ambient）：网格极缓慢移动，营造"空间在延伸"的感觉。
 *           → editorial / instrument 未授予 ambient 角色，会自动退化为静态。
 *   "pulse" 数据/环境动效：网格亮度缓慢呼吸，暗示"系统在运行"。
 *           → editorial 未授予，会自动退化为静态。
 *
 * 之所以用语义而不是 speed={2}，是因为"快慢"是 Style Pack 的职责：
 * cinematic 的 ambient 是 9s，instrument 是 4s，editorial 干脆不给。
 */

import type { CSSProperties } from "react";
import { cx, type MotionFallbackProps } from "@kits/react-utils";
import { useMotionAllowed } from "@kits/react-utils";
import "./animated-grid.css";

export type GridCell = "none" | "dense" | "normal" | "wide";
export type GridFade = "none" | "subtle" | "medium" | "strong";
export type GridMotion = "none" | "drift" | "pulse";

export interface AnimatedGridProps extends MotionFallbackProps {
  /** 网格密度。`none` = 不画格子。 */
  cell?: GridCell;
  /** 边缘淡出强度。`none` = 网格铺满整个容器（编辑器式的硬边网格）。 */
  fade?: GridFade;
  /** 网格动效的**语义**，不是速度。 */
  motion?: GridMotion;
  /** `absolute` 作为父容器背景；`fixed` 作为全屏底纹。 */
  placement?: "absolute" | "fixed";
  /** 网格层的堆叠层级。默认 `-1`（在所有内容之下）。 */
  elevation?: -1 | 0;
  className?: string;
}

/** 密度 → pack 单元格尺寸的乘数。绝对尺寸仍由 `--kits-grid-cell` 决定。 */
const CELL_SCALE: Record<GridCell, string> = {
  none: "0px",
  dense: "0.5",
  normal: "1",
  wide: "2",
};

const FADE_SIZE: Record<GridFade, string> = {
  none: "0%",
  subtle: "30%",
  medium: "36%",
  strong: "42%",
};

export function AnimatedGrid({
  cell = "normal",
  fade = "medium",
  motion = "none",
  placement = "absolute",
  elevation = -1,
  disableMotion = false,
  className,
}: AnimatedGridProps) {
  const animated = useMotionAllowed(disableMotion);

  // 动效只有在"系统允许动"且"产品要动"时才存在。
  // 具体时长/曲线由 pack 的 --kits-dur-ambient / --kits-ease-* 决定。
  const resolvedMotion = animated ? motion : "none";

  const style: CSSProperties = {
    /*
     * 密度只是一个**乘数**，不是一个尺寸。
     *
     * 这里曾经直接写 `--kits-grid-cell-size: calc(var(--kits-grid-cell) * 2)` ——
     * 那是行内样式，**优先级高于样式表**，于是样式表里那条
     * "基准 × 指针能力因子" 的组合被整个盖掉了。
     *
     * 后果很隐蔽：CSS 里看起来一切正确（`--kits-grid-cell-scale` 在触屏下
     * 确实是 1.5），而真正画出来的单元格仍然是 64px —— 移动端反摩尔纹降级
     * 依然失效。这正是 v0.1.1 第一次修复 K-02 时踩的坑：改对了 CSS，
     * 却没发现组件自己在行内把同一个变量又算了一遍。
     *
     * 现在职责分开：
     *   --kits-grid-cell        pack 给的基准（48 / 64 / 32）
     *   --kits-grid-cell-scale  契约给的指针能力因子（触屏 1.5）
     *   --kits-grid-density     ← 组件在这里贡献的密度乘数
     * 三者由 animated-grid.css 在 `.kits-grid` 上相乘得到有效值。
     */
    ["--kits-grid-density" as string]: CELL_SCALE[cell],
    ["--kits-grid-mask-size" as string]: FADE_SIZE[fade],
  };

  return (
    <div
      className={cx(
        "kits-grid",
        `kits-grid--${placement}`,
        `kits-grid--motion-${resolvedMotion}`,
        `kits-grid--elevation-${elevation === 0 ? "0" : "neg"}`,
        className,
      )}
      style={style}
      data-kits-component="animated-grid"
      data-kits-motion={resolvedMotion}
      aria-hidden="true"
    />
  );
}

export default AnimatedGrid;
