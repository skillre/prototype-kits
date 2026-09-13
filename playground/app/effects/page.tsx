import effectManifest from "@kits/effects/manifest.json";

/**
 * /effects —— Effect Contract 的验收页（v0.1.1 新增）。
 *
 * 这一页回答一个问题：
 *
 *   **产品的浅色主题与品牌色，能不能在不改效果实现的前提下完成？**
 *
 * v0.1.0 的答案是"不能"：ambient-glow 的三个光源色是硬编码 RGB 写在
 * ::before 的 background-image 里的。真实消费立刻撞上了这堵墙 ——
 * 产品只好自己发明一套变量，并把整个渐变抄了一遍。
 *
 * v0.1.1 把它们收敛成 `--kits-effect-ambient-*`。下面的三块舞台用**同一份
 * markup、同一个效果类**，只是覆盖的变量不同：
 *
 *   默认       什么都不覆盖 → 出厂值（深色，与 v0.1.0 逐像素等价）
 *   浅色主题   只压强度 + 换成冷灰蓝
 *   品牌调色   只换主光色相
 *
 * 覆盖写在**祖先**上（舞台自身），而不是效果的类上 —— 这条能成立，
 * 正是因为默认值声明在 :root 而不是效果自己的类里。
 */

import "@kits/effects/ambient-glow.css";

export const metadata = {
  title: "Effect Contract · Prototype Kits Playground",
};

type VarRow = { name: string; default: string; what: string };

const ambient = effectManifest.effects.find((e) => e.id === "ambient-glow") as unknown as {
  id: string;
  class: string;
  modifiers?: Record<string, string>;
  variables?: VarRow[];
  variablesNote?: string;
  constraints: string[];
};

const VARIABLES: VarRow[] = ambient.variables ?? [];

/** 三种覆盖：键是效果自己的变量名（产品只允许动这些）。 */
const STAGES: Array<{
  key: string;
  title: string;
  note: string;
  vars: Record<string, string>;
  snippet: string;
}> = [
  {
    key: "default",
    title: "默认（cinematic 深色）",
    note: "一个变量都不覆盖 —— 出厂值，与 v0.1.0 的硬编码版本逐字等价。",
    vars: {},
    snippet: "/* 不写任何覆盖 */",
  },
  {
    key: "light",
    title: "浅色主题",
    note: "只压强度并换成冷灰蓝。深色光放在浅底上只会显得脏 —— 这是产品必须能调的第一个数。",
    vars: {
      "--kits-effect-ambient-strength": "0.45",
      "--kits-effect-ambient-primary": "rgb(0 92 175 / 0.1)",
      "--kits-effect-ambient-secondary": "rgb(180 83 9 / 0.08)",
      "--kits-effect-ambient-rim": "rgb(79 70 229 / 0.08)",
    },
    snippet: [
      ":root[data-theme=\"light\"] {",
      "  --kits-effect-ambient-strength: 0.45;",
      "  --kits-effect-ambient-primary: rgb(0 92 175 / 0.1);",
      "}",
    ].join("\n"),
  },
  {
    key: "brand",
    title: "品牌调色",
    note: "只换主光色相，几何与衰减完全不动 —— 光的方向感属于效果，颜色属于产品。",
    vars: {
      "--kits-effect-ambient-primary": "rgb(255 122 89 / 0.18)",
      "--kits-effect-ambient-secondary": "rgb(120 220 160 / 0.1)",
    },
    snippet: [
      ".my-banner {",
      "  --kits-effect-ambient-primary: rgb(255 122 89 / 0.18);",
      "}",
    ].join("\n"),
  },
];

export default function EffectsPage() {
  return (
    <>
      <h1 className="pg-title">Effect Contract · 环境光</h1>
      <p className="pg-lede">
        效果的全部视觉定义都收敛到 <code>--kits-effect-ambient-*</code>。
        产品**只覆盖这些变量**，不需要、也不应该去碰{" "}
        <code>::before</code> 里那个 background-image。
      </p>

      {/* ------------------------------------------------------------------ */}
      <section className="pg-section">
        <h2 className="pg-section__title">
          01 · 同一份调用，三种覆盖
        </h2>
        <p className="pg-note">
          下面三块的 markup 与类名完全相同（<code>{ambient.class}</code>），
          只有覆盖的变量不同。覆盖写在祖先元素上 —— 这能成立的前提是
          默认值声明在 <code>:root</code>：如果声明在效果自己的类上，
          元素自身的声明会压过继承，祖先作用域里的覆盖**永远不会生效**。
        </p>

        <div className="pg-grid pg-grid--3">
          {STAGES.map((stage) => (
            <div key={stage.key} className="pg-column">
              <div className="pg-column__head">
                <strong>{stage.title}</strong>
                <span>{stage.note}</span>
              </div>
              <div
                data-kits-pack="cinematic"
                data-effect-stage={stage.key}
                className={ambient.class}
                style={{
                  position: "relative",
                  minHeight: 220,
                  borderRadius: 12,
                  padding: "var(--kits-space-lg)",
                  background: "var(--kits-color-surface)",
                  ...(stage.vars as React.CSSProperties),
                }}
              >
                <p className="kits-label">Q3 · Net burn</p>
                <p className="kits-data">¥1.28M</p>
                <p className="kits-body">
                  环境光是**容器级**效果：一个容器一次绘制，所有子元素受益。
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="pg-matrix">
          {STAGES.map((stage) => (
            <div key={stage.key} className="pg-card">
              <h3>{stage.title}</h3>
              <pre className="pg-code">{stage.snippet}</pre>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="pg-section">
        <h2 className="pg-section__title">
          02 · 公开变量（{VARIABLES.length} 个）
        </h2>
        <p className="pg-note">
          这份表直接来自 <code>effects/manifest.json</code>，
          而 <code>tests/effects.spec.ts</code> 会逐字核对
          「清单里的默认值与 CSS 里的字面量一致」—— 也就是说：
          <strong>文档不可能与实现漂移</strong>。
        </p>
        <div style={{ overflowX: "auto" }}>
          <table className="pg-table">
            <thead>
              <tr>
                <th>变量</th>
                <th>默认值</th>
                <th>作用</th>
              </tr>
            </thead>
            <tbody>
              {VARIABLES.map((v) => (
                <tr key={v.name}>
                  <td>
                    <code>{v.name}</code>
                  </td>
                  <td>
                    <code>{v.default}</code>
                  </td>
                  <td>{v.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ambient.variablesNote ? <p className="pg-note">{ambient.variablesNote}</p> : null}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="pg-section">
        <h2 className="pg-section__title">03 · 约束（不因为可调就放宽）</h2>
        <div className="pg-matrix">
          <div className="pg-card">
            <h3>使用约束</h3>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {ambient.constraints.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <div className="pg-card">
            <h3>修饰类</h3>
            <p style={{ fontSize: 13 }}>
              默认静态。呼吸必须显式开启 —— 持续动画有真实成本：
            </p>
            <pre className="pg-code">
              {Object.values(ambient.modifiers ?? {}).join("\n") || "（无）"}
            </pre>
            <p className="pg-note" style={{ marginBottom: 0 }}>
              触屏与 reduced-motion 下呼吸自动关闭，静态光保留。
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
