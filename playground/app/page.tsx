import Link from "next/link";
import type { ReactNode } from "react";

import { PACK_IDS, PackColumn } from "../components/pack-stage";
import { MISSING_PACK_RUNTIME } from "../components/registry-view";
import {
  CursorSample,
  GridSample,
  HeroSample,
  RevealSample,
  SpotlightSample,
} from "../components/samples";

/**
 * Playground 首页 —— **registry 里全部已批准的 Style Pack 并排**。
 *
 * 这一页就是「Kits 负责变化」的现场证明：
 * 下面每一组对比里，**组件调用完全相同**，只有外层的
 * `data-kits-pack` 不同，结果却明显不同。
 *
 * 列数**不是写死的**：它来自 `registry/assets.json` 里
 * `type === "style"` 且 `status === "approved"` 的资产顺序（见 `../components/registry-view`）。
 * 这里是视图，不是权威 —— 视图可以过期，但**不许自己定义"有哪些 pack"**。
 *
 * 并排检查的重点（不是"好不好看"，而是"是否真的不同"）：
 *   1. 灰度化之后能否区分？（排版/间距/边界/圆角，而不是颜色）
 *   2. 首屏视觉焦点是否各自成立？
 *   3. 数据的读法是否不同？（衬线大字号 / 发光曲线 / 等宽读数 / 格位读数）
 *   4. 每一列的间距节奏是否明显不同？
 *      （`--kits-section-gap`：editorial 96px · cinematic 96px · console 24px · instrument 32px）
 */

/**
 * 一行舞台：每一套已批准的 pack 一列。
 *
 * 列表只有一个来源（`PACK_IDS` ← registry），所以第五套 pack 落在 registry 里
 * 就会被渲染，不需要回来改这一页 —— 唯一需要人工补的是 `pack-stage.tsx` 里
 * 那句**性格描述**（那是人工写的解释，不是从 registry 生成的数据），
 * 而它由 `tests/playground-pack-coverage.spec.ts` 强制覆盖。
 */
function PackRow({ children }: { children: ReactNode }) {
  return (
    <div className="pg-grid pg-grid--packs">
      {PACK_IDS.map((pack) => (
        <PackColumn key={pack} pack={pack}>
          <div className="pg-inner">{children}</div>
        </PackColumn>
      ))}
    </div>
  );
}

export default function PlaygroundHome() {
  return (
    <>
      <h1 className="pg-title">Style Packs · 并排验收</h1>
      <p className="pg-lede">
        每一套风格都必须与其它套**明显不同**，且不能只是换颜色。下面的每一组对比都使用
        <strong>同一份组件调用</strong>，只有外层 <code>data-kits-pack</code>{" "}
        不同。判定标准是：把所有列都转成灰度之后，差异是否依然一眼可见。
      </p>

      {/*
        视图缺口要**被看见**，不能被留白吞掉：
        registry 里已批准、但 `registry-view.ts` 还没接线的 pack 会在这里点名。
        正常情况下这一段不渲染（正常状态就是空数组）。
      */}
      {MISSING_PACK_RUNTIME.length > 0 ? (
        <p className="pg-note">
          <strong>视图缺口：</strong>registry 里已批准、但这一页尚未接线的 pack ——{" "}
          {MISSING_PACK_RUNTIME.join(" / ")}。它们**没有**被藏起来，这一条就是它们的位置：
          registry 是权威，Playground 只是视图。
        </p>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      <section className="pg-section">
        <h2 className="pg-section__title">
          01 · InteractiveHero —— 同一份 title / lead / actions / media
        </h2>
        <PackRow>
          <HeroSample />
        </PackRow>
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
          <br />
          <strong>console 的同一个值也是 0</strong>（
          <code>styles/console/tokens.css</code> 里写着「没有聚光灯：那是 cinematic 的手段」），
          所以第四列同样只剩格位表面；有光斑的是 cinematic（0.5）与 instrument（0.16）。
        </p>
        <PackRow>
          <SpotlightSample />
        </PackRow>
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
          <br />
          <strong>console 是 1px 线 + 0% 淡出</strong>，并且它**没有声明**
          <code>--kits-grid-cell</code> —— 格位因此取契约兜底 <strong>48px</strong>
          （其余三套各自声明了 48 / 64 / 32px）。线宽 1px 而不是 0px：
          在 console 里规则线只出现在语法位置，网格是「格位」而不是装饰。
          <br />
          <span style={{ opacity: 0.8 }}>
            上面引的是各 pack **声明**的取值。本节样张显式传了{" "}
            <code>{'fade="medium"'}</code>，边缘遮罩由组件的 prop 决定
            （36%），所以这一节里 pack 的 <code>--kits-grid-fade</code> 不改变遮罩 ——
            它改变的是各 pack 自己声明的值。
          </span>
        </p>
        <PackRow>
          <GridSample motion="drift" />
        </PackRow>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="pg-section">
        <h2 className="pg-section__title">04 · DataCursor —— 把指针移到读数上</h2>
        <p className="pg-note">
          只在精确指针 + 允许动效时激活；触屏与 reduced-motion 下完全不激活，
          系统光标照常显示。读数信息同时存在于可见文本中（契约要求）。
          <br />
          <strong>console 的 <code>--kits-cursor-ring-size</code> 是 0px</strong>
          （没有跟随光标的光环），<code>--kits-pointer-factor</code> 也是 0 ——
          它在控制台里只是一个取数点（<code>--kits-cursor-size</code> 走契约兜底 8px）。
          组件照常挂载、照常降级，只是这一套 pack 不给它光环。
        </p>
        <PackRow>
          <CursorSample />
        </PackRow>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="pg-section">
        <h2 className="pg-section__title">
          05 · InsightReveal —— 同一份 step=&quot;group&quot; blur
        </h2>
        <p className="pg-note">
          节奏差异：editorial 70ms/段 · cinematic 110ms/段 + 6px 景深模糊 ·
          instrument 25ms/段。滚动到下面，三段内容的揭示顺序会明显不同。
          <br />
          <strong>console 24ms/段</strong>（<code>staggerStep: 24</code>，四套里最快）·
          无模糊（<code>--kits-reveal-blur</code> 0px）· 位移 4px。
          理由在 <code>styles/console/motion.ts</code> 里：一次可能揭示 8–12 条事件行，
          60ms 的步进会让第 12 条等到 720ms 之后。
        </p>
        <PackRow>
          <RevealSample />
        </PackRow>
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
