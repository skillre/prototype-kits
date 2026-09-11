"use client";

/**
 * InteractiveHero —— Demo（供 Playground 与本地验证使用）
 *
 * Demo 的作用是**验证契约**，不是展示效果：
 *   1. 同一份 JSX，在三种 Style Pack 下都必须成立
 *      （如果某个 pack 下崩了，说明组件偷偷依赖了某个 pack 的样式）；
 *   2. 插槽（actions / media）可以由任意节点填充；
 *   3. 不允许出现任何视觉字面量。
 */

import { InteractiveHero } from "./interactive-hero.tsx";
import type { Intensity } from "../_shared/contract.ts";

export interface InteractiveHeroDemoProps {
  depth?: Intensity;
  withMedia?: boolean;
  align?: "start" | "center";
}

export function InteractiveHeroDemo({
  depth = "subtle",
  withMedia = true,
  align = "start",
}: InteractiveHeroDemoProps) {
  return (
    <InteractiveHero
      eyebrow="Prototype Factory · Q3"
      title="把复杂还给简单。"
      lead="我们重新设计了数据层的读取路径，把原本需要四步的操作压缩成一步，并把所有中间状态暴露给用户。"
      align={align}
      depth={depth}
      mediaPlacement={withMedia ? "side" : "below"}
      actions={
        <>
          <button type="button" className="kits-control kits-control--primary">
            查看报告
          </button>
          <button type="button" className="kits-control">
            方法论
          </button>
        </>
      }
      media={
        withMedia ? (
          <figure className="kits-demo-media">
            <div className="kits-demo-media__plot" />
            <figcaption className="kits-label">图 1 · 读取路径压缩</figcaption>
          </figure>
        ) : undefined
      }
    />
  );
}

export default InteractiveHeroDemo;
