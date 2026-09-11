import Link from "next/link";
import { PackColumn } from "../components/pack-stage";
import {
  CursorSample,
  GridSample,
  HeroSample,
  RevealSample,
  SpotlightSample,
} from "../components/samples";

/**
 * Playground 首页 —— 三套 Style Pack 并排。
 *
 * 这一页就是「Kits 负责变化」的现场证明：
 * 下面每一组对比里，**组件调用完全相同**，只有外层的
 * `data-kits-pack` 不同，结果却明显不同。
 *
 * 并排检查的重点（不是"好不好看"，而是"是否真的不同"）：
 *   1. 灰度化之后能否区分？（排版/间距/边界/圆角，而不是颜色）
 *   2. 首屏视觉焦点是否各自成立？
 *   3. 数据的读法是否不同？（衬线大字号 / 发光曲线 / 等宽读数）
 *   4. 三列里的间距节奏是否明显不同？（96 / 64 / 32px）
 */
export default function PlaygroundHome() {
  return (
    <>
      <h1 className="pg-title">Style Packs · 并排验收</h1>
      <p className="pg-lede">
        三套风格必须**明显不同**，且不能只是换颜色。下面的每一组对比都使用
        <strong>同一份组件调用</strong>，只有外层 <code>data-kits-pack</code>{" "}
        不同。判定标准是：把三列都转成灰度之后，差异是否依然一眼可见。
      </p>

      {/* ------------------------------------------------------------------ */}
      <section className="pg-section">
        <h2 className="pg-section__title">
          01 · InteractiveHero —— 同一份 title / lead / actions / media
        </h2>
        <div className="pg-grid pg-grid--3">
          <PackColumn pack="editorial">
            <div style={{ padding: "var(--kits-gutter)" }}>
              <HeroSample />
            </div>
          </PackColumn>
          <PackColumn pack="cinematic">
            <div style={{ padding: "var(--kits-gutter)" }}>
              <HeroSample />
            </div>
          </PackColumn>
          <PackColumn pack="instrument">
            <div style={{ padding: "var(--kits-gutter)" }}>
              <HeroSample />
            </div>
          </PackColumn>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="pg-section">
        <h2 className="pg-section__title">
          02 · SpotlightSurface —— 同一份 tone=&quot;brand&quot; intensity=&quot;medium&quot;
        </h2>
        <p className="pg-note">
          editorial 的 <code>--kits-spotlight-opacity</code> 是{" "}
          <strong>0</strong>：光斑在这个 pack 下会完全消失，只剩纸质表面。
          这不是 bug，是风格 —— 组件代码零改动。
        </p>
        <div className="pg-grid pg-grid--3">
          <PackColumn pack="editorial">
            <div className="pg-inner">
              <SpotlightSample />
            </div>
          </PackColumn>
          <PackColumn pack="cinematic">
            <div className="pg-inner">
              <SpotlightSample />
            </div>
          </PackColumn>
          <PackColumn pack="instrument">
            <div className="pg-inner">
              <SpotlightSample />
            </div>
          </PackColumn>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="pg-section">
        <h2 className="pg-section__title">
          03 · AnimatedGrid —— 同一份 cell=&quot;normal&quot; fade=&quot;medium&quot;
        </h2>
        <p className="pg-note">
          editorial 的 <code>--kits-grid-line-width</code> 是 <strong>0px</strong>
          ：网格在该 pack 下自动消失。cinematic 是 64px + 55% 淡出；
          instrument 是 32px + 22% 淡出（在那里网格就是刻度）。
        </p>
        <div className="pg-grid pg-grid--3">
          <PackColumn pack="editorial">
            <div className="pg-inner">
              <GridSample motion="drift" />
            </div>
          </PackColumn>
          <PackColumn pack="cinematic">
            <div className="pg-inner">
              <GridSample motion="drift" />
            </div>
          </PackColumn>
          <PackColumn pack="instrument">
            <div className="pg-inner">
              <GridSample motion="drift" />
            </div>
          </PackColumn>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="pg-section">
        <h2 className="pg-section__title">04 · DataCursor —— 把指针移到读数上</h2>
        <p className="pg-note">
          只在精确指针 + 允许动效时激活；触屏与 reduced-motion 下完全不激活，
          系统光标照常显示。读数信息同时存在于可见文本中（契约要求）。
        </p>
        <div className="pg-grid pg-grid--3">
          <PackColumn pack="editorial">
            <div className="pg-inner">
              <CursorSample />
            </div>
          </PackColumn>
          <PackColumn pack="cinematic">
            <div className="pg-inner">
              <CursorSample />
            </div>
          </PackColumn>
          <PackColumn pack="instrument">
            <div className="pg-inner">
              <CursorSample />
            </div>
          </PackColumn>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="pg-section">
        <h2 className="pg-section__title">
          05 · InsightReveal —— 同一份 step=&quot;group&quot; blur
        </h2>
        <p className="pg-note">
          节奏差异：editorial 70ms/段 · cinematic 110ms/段 + 6px 景深模糊 ·
          instrument 25ms/段。滚动到下面，三段内容的揭示顺序会明显不同。
        </p>
        <div className="pg-grid pg-grid--3">
          <PackColumn pack="editorial">
            <div className="pg-inner">
              <RevealSample />
            </div>
          </PackColumn>
          <PackColumn pack="cinematic">
            <div className="pg-inner">
              <RevealSample />
            </div>
          </PackColumn>
          <PackColumn pack="instrument">
            <div className="pg-inner">
              <RevealSample />
            </div>
          </PackColumn>
        </div>
      </section>

      <section className="pg-section">
        <h2 className="pg-section__title">下一步</h2>
        <p className="pg-lede">
          逐维度差异与十维对照表在{" "}
          <Link href="/audit" style={{ color: "var(--pg-accent)" }}>
            /audit
          </Link>
          ；五个组件的内部 API、降级矩阵与性能分级在{" "}
          <Link href="/components" style={{ color: "var(--pg-accent)" }}>
            /components
          </Link>
          。
        </p>
      </section>
    </>
  );
}
