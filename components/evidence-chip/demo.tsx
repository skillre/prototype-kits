"use client";

/**
 * EvidenceChip —— Demo
 *
 * 演示的是 S1（研判卡片）里的真实形态：一条结论下面挂着几条可点开的引用。
 * 同一份 JSX 在四套 pack 下是四种格位，而**组件调用没有一行不同**：
 *
 *   editorial    纸面 + 细横线 + 大写字距      → 像脚注里的引用标记
 *   cinematic    深色玻璃 + 圆角 + 引用色       → 像叠在卡片上的可点开标签
 *   instrument   等宽 + 2px 刻度线 + 极小圆角   → 像仪表盘上的通道标签
 *   console      等宽 + 0 圆角 + 证据引用蓝     → 像终端里的一行可跳转引用
 *
 * 抽屉不在这里：demo 只把 onActivate 接成一个受控的「哪一条被打开」，
 * 真正的抽屉内容属于产品。这也是本组件契约的一部分（见 README §2）。
 */

import { useState } from "react";
import { EvidenceChip } from "./evidence-chip.tsx";

export function EvidenceChipDemo() {
  const [openId, setOpenId] = useState<string | undefined>(undefined);

  return (
    <div className="kits-demo-stack">
      <p className="kits-label">研判结论 · 攻击者已获得交互式执行</p>
      <p className="kits-body">
        java.exe 由 tomcat 派生后立即向公网地址建立连接，落地的可执行文件
        与已知家族的三处手法指纹一致。
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "var(--kits-space-2xs)",
        }}
      >
        <EvidenceChip
          category="证据"
          evidenceId="e-41"
          label="原始报文"
          expanded={openId === "e-41"}
          drawerId="kits-demo-evidence-drawer"
          onActivate={setOpenId}
        />
        <EvidenceChip
          category="证据"
          evidenceId="e-77"
          label="进程链 tomcat→cmd"
          expanded={openId === "e-77"}
          drawerId="kits-demo-evidence-drawer"
          onActivate={setOpenId}
        />
        <EvidenceChip
          category="证据"
          evidenceId="e-79"
          label="文件 hash"
          expanded={openId === "e-79"}
          drawerId="kits-demo-evidence-drawer"
          onActivate={setOpenId}
        />
        {/* 无引用号的补充引用：同类手法指纹合并了 2 条 */}
        <EvidenceChip
          label="手法指纹匹配"
          count={2}
          onActivate={setOpenId}
        />
      </div>

      {/* 无 onActivate → 渲染静态标记而不是"点开不动的按钮" */}
      <p className="kits-body">
        只读视图里的引用不可点开，也不进入 Tab 顺序：
        <span
          style={{
            display: "inline-flex",
            gap: "var(--kits-space-2xs)",
            marginInlineStart: "var(--kits-space-2xs)",
            verticalAlign: "baseline",
          }}
        >
          <EvidenceChip category="证据" evidenceId="e-79" label="文件 hash" />
        </span>
      </p>
    </div>
  );
}

export default EvidenceChipDemo;
