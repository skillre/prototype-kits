"use client";

import { useState } from "react";
// 产品代码只 import 适配层 —— 从不 import lib/kits/installed/*
import { AnimatedGrid } from "@/lib/kits/adapters/animated-grid";
import { DataCursor } from "@/lib/kits/adapters/data-cursor";
import { InsightReveal } from "@/lib/kits/adapters/insight-reveal";

/**
 * 这个页面存在的唯一目的：**证明安装后的资产真的能被产品使用**。
 *
 * 它刻意把三个组件都跑一遍，因为三者各自代表一类依赖：
 *   AnimatedGrid   → useMotionAllowed（能力探测）
 *   DataCursor     → useFinePointer + useMotionAllowed（指针探测）
 *   InsightReveal  → useReveal（共享 IntersectionObserver）+ 步进宿主
 *
 * 三个都渲染出来，等于把 @kits/react-utils 的公开面全部走了一遍。
 * 少一个，就不能说"组件包自足"。
 */
export default function FixturePage() {
  const [count, setCount] = useState(3);

  return (
    <main className="fixture-shell">
      <div className="fixture-panel" style={{ position: "relative", overflow: "hidden" }}>
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
