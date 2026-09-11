"use client";

/**
 * InsightReveal —— 内部稳定 API v1
 *
 * ---------------------------------------------------------------------------
 * 这个组件是做什么的
 * ---------------------------------------------------------------------------
 * 当内容滚动进入视口时，**按阅读顺序逐段揭示**。
 *
 * 它解决的不是"好看"的问题，而是**层级**问题：
 * 一份长内容一次性全部出现时，读者不知道从哪里开始；
 * 逐段揭示把阅读顺序变成可见的节奏，并把注意力引导到当前段落。
 *
 * ---------------------------------------------------------------------------
 * 稳定 API（产品只允许用这些）
 * ---------------------------------------------------------------------------
 *   step?      揭示的**粒度**：one（整体）/ group（按直接子元素分组）
 *   shift?     位移档位：none | subtle | medium | strong
 *   blur?      是否带景深模糊（cinematic 的"从远到近"）
 *   once?      是否只揭示一次（默认 true）
 *   as?        语义元素
 *
 * ---------------------------------------------------------------------------
 * 明确**不属于** API 的东西
 * ---------------------------------------------------------------------------
 *   distance(px) / duration(ms) / easing / delay / threshold / blurRadius …
 *   位移来自 --kits-reveal-distance，模糊来自 --kits-reveal-blur，
 *   时长来自 --kits-dur-*，步进来自 --kits-stagger-step —— 全部由 pack 决定。
 *
 * ---------------------------------------------------------------------------
 * 三层降级（全部内建）
 * ---------------------------------------------------------------------------
 *   1. 无 IntersectionObserver → 立即揭示（不做动画）
 *   2. prefers-reduced-motion / disableMotion → 立即揭示
 *   3. **JS 完全失败** → CSS `@media (scripting: none)` 兜底，内容直接可见
 *
 * 第 3 条是最容易被忽略的一条：如果"隐藏"写在 CSS 类上而"显示"依赖 JS，
 * 那么 JS 一挂，整页内容就是空白。
 */

import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { cx, type MotionFallbackProps } from "../_shared/contract.ts";
import { useReveal } from "../_shared/use-reveal.ts";
import "./insight-reveal.css";

export type RevealStep = "one" | "group";
export type RevealShift = "none" | "subtle" | "medium" | "strong";

export interface InsightRevealProps extends MotionFallbackProps {
  children: ReactNode;
  /** 揭示粒度。`group` 会为每个直接子元素分配一个步进序号。 */
  step?: RevealStep;
  /** 位移档位。实际像素由 pack 的 `--kits-reveal-distance` 决定。 */
  shift?: RevealShift;
  /** 景深模糊。cinematic 有意义（`--kits-reveal-blur: 6px`），其他 pack 为 0。 */
  blur?: boolean;
  /** 只揭示一次，还是每次进入视口都揭示。默认 true。 */
  once?: boolean;
  as?: "div" | "section" | "article" | "ol" | "ul";
  /** 最大步进序号。超出的子元素不再延迟（避免第 20 段等 1.4 秒）。 */
  maxStagger?: number;
  className?: string;
  id?: string;
}

const SHIFT_SCALE: Record<RevealShift, number> = {
  none: 0,
  subtle: 0.5,
  medium: 1,
  strong: 1.8,
};

export function InsightReveal({
  children,
  step = "group",
  shift = "medium",
  blur = false,
  once = true,
  as: Element = "div",
  maxStagger = 6,
  disableMotion = false,
  className,
  id,
}: InsightRevealProps) {
  const { ref, visible, animated } = useReveal({ disableMotion, once });

  const items = Children.toArray(children);

  return (
    <Element
      ref={ref as React.Ref<never>}
      id={id}
      className={cx(
        "kits-reveal",
        animated && "kits-reveal--animated",
        once && "kits-reveal--once",
        shift !== "none" && "kits-reveal--shift",
        blur && "kits-reveal--blur",
        className,
      )}
      style={{
        // 位移与模糊的"档位乘数"在这里合成，绝对数值仍由 pack 决定
        ["--kits-reveal-shift-scale" as string]: String(SHIFT_SCALE[shift]),
      }}
      data-kits-component="insight-reveal"
      data-kits-visible={visible ? "true" : "false"}
      data-kits-step={step}
    >
      {step === "group"
        ? items.map((child, index) => {
            if (!isValidElement(child)) return child;
            const element = child as React.ReactElement<{
              style?: React.CSSProperties;
            }>;
            return cloneElement(element, {
              style: {
                ...element.props.style,
                // 步进序号只作为 CSS 变量存在；CSS 用 calc 相乘得到延迟。
                // 绝对步进值来自 pack 的 --kits-reveal-stagger，组件不知道它。
                ["--kits-reveal-index" as string]: String(
                  Math.min(index, maxStagger),
                ),
              },
            });
          })
        : children}
    </Element>
  );
}

export default InsightReveal;
