import {
  AnimatedGrid,
  type GridCell,
  type GridFade,
  type GridMotion,
} from "@kits/animated-grid";
import { DataCursor } from "@kits/data-cursor";
import { InsightReveal } from "@kits/insight-reveal";
import { InteractiveHero } from "@kits/interactive-hero";
import { SpotlightSurface } from "@kits/spotlight-surface";

/**
 * 五种组件在三种 Style Pack 下的**同一份调用**。
 *
 * 这个文件里没有任何 pack 判断语句 —— 没有
 * `if (pack === "cinematic") …` 这样的分支。
 * 如果某个组件在某个 pack 下需要特殊处理，那是组件违规，不是 Playground 的责任。
 */

export function HeroSample() {
  return (
    <InteractiveHero
      eyebrow="Prototype Factory"
      title="把复杂还给简单。"
      lead="重新设计数据层的读取路径，把原本需要四步的操作压缩成一步，并把所有中间状态暴露给用户。"
      depth="medium"
      mediaPlacement="side"
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
        <figure className="kits-demo-media">
          <div className="kits-demo-media__plot" />
          <figcaption className="kits-label">图 1 · 读取路径压缩</figcaption>
        </figure>
      }
    />
  );
}

export function SpotlightSample() {
  return (
    <div className="kits-demo-stack">
      <SpotlightSurface tone="brand" intensity="medium">
        <p className="kits-label">Active signal</p>
        <p className="kits-data">1,284</p>
        <p className="kits-body">
          环比上升 12.4%，主要来自华东区域的读取路径压缩。
        </p>
      </SpotlightSurface>

      <SpotlightSurface tone="critical" intensity="subtle">
        <p className="kits-label">Anomaly</p>
        <p className="kits-body">3 个节点在 04:12 出现延迟尖峰。</p>
      </SpotlightSurface>
    </div>
  );
}

export function GridSample({
  motion = "drift",
}: {
  motion?: GridMotion;
}) {
  const cell: GridCell = "normal";
  const fade: GridFade = "medium";
  return (
    <div className="kits-demo-stage">
      <AnimatedGrid cell={cell} fade={fade} motion={motion} />
      <div className="kits-demo-stage__content">
        <p className="kits-label">AnimatedGrid · motion={motion}</p>
        <p className="kits-body">
          纯装饰层：aria-hidden、pointer-events:none、z-index:-1。
          三种 pack 下同一份调用，网格的尺寸/线色/淡出/动效各不相同。
        </p>
      </div>
    </div>
  );
}

export function CursorSample() {
  const readings = [
    { id: "P99", value: "184ms" },
    { id: "P50", value: "42ms" },
    { id: "ERR", value: "0.14%" },
    { id: "QPS", value: "12.4k" },
  ];
  return (
    <DataCursor mode="ring">
      <div className="kits-demo-cursor-area">
        <p className="kits-label">DataCursor · 把指针移到读数上</p>
        <ul className="kits-demo-reading-list">
          {readings.map((reading) => (
            <li key={reading.id}>
              <button
                type="button"
                className="kits-demo-reading"
                data-cursor="inspect"
                data-cursor-label={`${reading.id} · ${reading.value}`}
              >
                <span className="kits-label">{reading.id}</span>
                <span className="kits-data">{reading.value}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </DataCursor>
  );
}

export function RevealSample() {
  return (
    <InsightReveal step="group" shift="medium" blur>
      <div>
        <p className="kits-label">Insight 01</p>
        <h3 className="kits-title">读取路径被压缩了 4 倍</h3>
        <p className="kits-body">P99 从 720ms 降到 184ms。</p>
      </div>
      <div>
        <p className="kits-label">Insight 02</p>
        <h3 className="kits-title">异常集中在两个时段</h3>
        <p className="kits-body">04:00–04:20 与 13:40–14:00。</p>
      </div>
      <div>
        <p className="kits-label">Insight 03</p>
        <h3 className="kits-title">下个周期的三个动作</h3>
        <p className="kits-body">调整窗口、增加只读副本、纳入发布门禁。</p>
      </div>
    </InsightReveal>
  );
}
