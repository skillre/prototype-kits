"use client";

import { useState } from "react";
/*
 * 产品代码只 import 适配层 —— 从不 import lib/kits/installed/*。
 *
 * 三条缝各跑一遍（这也是 v0.1.1 补全之后的形态）：
 *   style-pack             → stylePackMotion / stylePackMotionVars / stylePackMeta
 *   <component>            → 组件
 *   effect-<id>            → 容器类名与公开变量名
 *
 * 最后一条是 v0.1.1 新增的：效果是纯 CSS，托管区里没有可 import 的模块，
 * 所以它的 TS 缝导出的是**标识符**。以前产品只能在 JSX 里硬编码
 * `className="kits-effect-ambient-glow"` —— 把 Kits 的实现细节写死在自己代码里。
 */
import { AnimatedGrid } from "@/lib/kits/adapters/animated-grid";
import { DataCursor } from "@/lib/kits/adapters/data-cursor";
import { InsightReveal } from "@/lib/kits/adapters/insight-reveal";
import {
  effectClass,
  effectModifiers,
  effectVars,
} from "@/lib/kits/adapters/effect-ambient-glow";
import { stylePackMeta } from "@/lib/kits/adapters/style-pack";

/**
 * 这个页面存在的唯一目的：**证明安装后的资产真的能被产品使用**。
 *
 * 它刻意把三类资产都跑一遍，因为三者各自代表一类依赖：
 *   AnimatedGrid   → useMotionAllowed（能力探测）
 *   DataCursor     → useFinePointer + useMotionAllowed（指针探测）
 *   InsightReveal  → useReveal（共享 IntersectionObserver）+ 步进宿主
 *
 * 三个组件都渲染出来，等于把 @kits/react-utils 的公开面全部走了一遍。
 * 少一个，就不能说"组件包自足"。
 */
export default function FixturePage() {
  const [count, setCount] = useState(3);
  const [light, setLight] = useState(false);

  /*
   * 浅色主题的"光"——**只覆盖公开变量**，不重写效果的实现。
   *
   * 这正是 K-05 要证明的事：v0.1.0 的光色是硬编码的，产品想改只能把
   * ::before 的整个 background-image 抄一遍；现在改两个变量就够了。
   * 这里用 CSS 变量名当 React style 的键（effectVars 给的是名字，
   * 不是值）—— 名字来自适配层，因此 Kits 改命名时这里会一起被 doctor 提醒。
   */
  const lightOverride = light
    ? ({
        [effectVars.strength]: "0.45",
        [effectVars.primary]: "rgb(0 92 175 / 0.1)",
        [effectVars.secondary]: "rgb(180 83 9 / 0.08)",
        [effectVars.rim]: "rgb(79 70 229 / 0.08)",
      } as React.CSSProperties)
    : undefined;

  return (
    <main className="fixture-shell">
      <div
        className={`fixture-panel ${effectClass}`}
        data-testid="fixture-ambient"
        style={{ position: "relative", overflow: "hidden", ...lightOverride }}
      >
        <AnimatedGrid cell="wide" fade="strong" motion="drift" />

        <InsightReveal step="group" shift="medium" blur>
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="fixture-row">
              结论 {i + 1} —— 步进序号必须真的落在 DOM 上
            </div>
          ))}
        </InsightReveal>

        <p style={{ marginTop: "var(--kits-space-lg)" }}>
          <button type="button" onClick={() => setCount((c) => (c === 3 ? 5 : 3))}>
            切换条目数（当前 {count}）
          </button>
          {" "}
          <button type="button" onClick={() => setLight((v) => !v)}>
            切换效果强度（当前 {light ? "light" : "default"}）
          </button>
        </p>

        <p className="fixture-note">
          pack = {stylePackMeta.id}（{stylePackMeta.selector}）· 效果修饰类：
          {" "}
          {Object.keys(effectModifiers).length ? Object.values(effectModifiers).join(", ") : "无"}
        </p>
      </div>

      <div className="fixture-panel" style={{ marginTop: "var(--kits-space-lg)" }}>
        <DataCursor mode="ring">
          <table data-testid="fixture-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {[
                ["PZ-202609-31", "¥43,608"],
                ["PZ-202609-30", "¥74,760"],
              ].map(([voucher, amount]) => (
                <tr
                  key={voucher}
                  className="fixture-row"
                  data-cursor="inspect"
                  data-cursor-label={`${voucher} · ${amount}`}
                >
                  <td>{voucher}</td>
                  <td>{amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataCursor>
      </div>
    </main>
  );
}
