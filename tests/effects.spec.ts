/**
 * Effect Contract · 公开变量（K-05）。
 *
 * ===========================================================================
 * 这次修的是什么
 * ===========================================================================
 * `ambient-glow` 的三个光源色是**硬编码 RGB 字面量**写在 ::before 的
 * background-image 里。v0.1.0 的理由是"光属于 cinematic 的物理设定，
 * 不该被换色"—— 在**深色单模式**下成立，但真实消费立刻证明它不够：
 *
 *   - 浅色主题需要完全不同的光（深色光在浅底上只会显得脏）；
 *   - 品牌调色也想参与。
 *
 * 硬编码的结果是产品**没有合规的出口**，只好自己发明 `--finance-ambient-*`
 * 并把整个渐变抄一遍 —— 等于把效果的实现细节复制进了产品。
 * 契约不成立的地方，产品就会绕过去（和 K-04 是同一个教训）。
 *
 * 修法：把视觉定义收敛到 `--kits-effect-ambient-*` 公开变量，产品只 override
 * 这些，不碰实现。默认值必须与 v0.1.0 **逐字等价**。
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../", import.meta.url);
const read = (rel: string) => readFileSync(new URL(rel, ROOT), "utf8");

const CSS_RAW = read("effects/ambient-glow.css");
const CSS = CSS_RAW.replace(/\/\*[\s\S]*?\*\//g, "");
const MANIFEST = JSON.parse(read("effects/manifest.json")) as {
  effects: Array<{
    id: string;
    class: string;
    modifiers?: Record<string, string>;
    variables?: Array<{ name: string; default: string; what: string }>;
    variablesNote?: string;
  }>;
  contract: { variableConvention: string[] };
};

const ambient = MANIFEST.effects.find((e) => e.id === "ambient-glow")!;
const variables = ambient.variables ?? [];

/** 取出 :root 块（默认值应该住在这里）。 */
function rootBlock(css: string): string {
  const start = css.indexOf(":root {");
  if (start < 0) return "";
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return "";
}

/* -------------------------------------------------------------------------- */

describe("K-05 · 公开变量与实现一致（文档不能与代码漂移）", () => {
  it("清单里登记了变量，数量与命名空间一致", () => {
    expect(variables.length).toBeGreaterThan(0);
    for (const v of variables) {
      expect(v.name).toMatch(/^--kits-effect-ambient-/);
      expect(v.default.length).toBeGreaterThan(0);
      expect(v.what.length).toBeGreaterThan(0);
    }
  });

  it("每个变量的**默认值逐字**出现在 CSS 里", () => {
    for (const v of variables) {
      expect(CSS_RAW, `${v.name} 的默认值 ${v.default} 没在 CSS 里`).toContain(v.default);
    }
  });

  it("每个变量名都在 CSS 里被声明，且被 ::before 消费", () => {
    const root = rootBlock(CSS);
    for (const v of variables) {
      expect(root, `${v.name} 没有在 :root 里声明`).toContain(`${v.name}:`);
    }
    const before = CSS.slice(CSS.indexOf(".kits-effect-ambient-glow::before"));
    for (const v of variables) {
      if (v.name === "--kits-effect-ambient-strength") continue; // 作用在 opacity 上
      expect(before, `${v.name} 没有被 ::before 使用`).toContain(`var(${v.name})`);
    }
  });

  it("变量命名空间与清单声明一致", () => {
    expect(ambient.class).toBe("kits-effect-ambient-glow");
    expect(ambient.modifiers?.breathing).toBe("kits-effect-ambient-glow--breathing");
  });
});

describe("K-05 · 默认值声明在 :root（这是产品能覆盖的前提）", () => {
  it("默认值住在 :root，而不是效果自己的类上", () => {
    /*
     * 如果声明在 `.kits-effect-ambient-glow` 自己身上，元素自身的声明会
     * 压过继承 —— 产品在 `body` 或 `[data-theme]` 上写的覆盖**永远不生效**，
     * 只能在那个类上按更高特异性去改。放在 :root（所有人的祖先）之后，
     * "元素自己 > 更近的祖先 > :root" 才是预期的覆盖链。
     */
    const root = rootBlock(CSS);
    expect(root).toContain("--kits-effect-ambient-primary:");
    expect(root).toContain("--kits-effect-ambient-strength:");

    // 效果自己的类块里不得再声明这些变量
    const classRule = CSS.slice(
      CSS.indexOf(".kits-effect-ambient-glow {"),
      CSS.indexOf(".kits-effect-ambient-glow::before"),
    );
    expect(classRule).not.toContain("--kits-effect-ambient-primary:");
    expect(classRule).not.toContain("--kits-effect-ambient-strength:");
  });

  it("::before 里没有留下任何颜色字面量（那才是'只能改实现'）", () => {
    const before = CSS.slice(CSS.indexOf(".kits-effect-ambient-glow::before"));
    const rules = before.slice(0, before.indexOf("/*"));
    expect(rules).not.toMatch(/rgb\(|#[0-9a-f]{3,8}\b|hsl\(/);
    expect(rules).toContain("var(--kits-effect-ambient-primary)");
    expect(rules).toContain("var(--kits-effect-ambient-secondary)");
    expect(rules).toContain("var(--kits-effect-ambient-rim)");
  });

  it("几何也全部变量化（位置 / 尺寸 / 衰减）", () => {
    const before = CSS.slice(CSS.indexOf(".kits-effect-ambient-glow::before"));
    for (const light of ["primary", "secondary", "rim"]) {
      expect(before).toContain(`var(--kits-effect-ambient-${light}-size)`);
      expect(before).toContain(`var(--kits-effect-ambient-${light}-position)`);
      expect(before).toContain(`var(--kits-effect-ambient-${light}-falloff)`);
    }
  });
});

describe("K-05 · 与 v0.1.0 视觉等价", () => {
  /* v0.1.0 的三个光源，逐字抄自当时的 background-image */
  const LEGACY = [
    { light: "primary", color: "rgb(79 214 255 / 0.16)", size: "60% 50%", at: "18% 8%", stop: "62%" },
    { light: "secondary", color: "rgb(255 182 79 / 0.1)", size: "50% 45%", at: "85% 20%", stop: "60%" },
    { light: "rim", color: "rgb(139 123 255 / 0.12)", size: "70% 55%", at: "50% 105%", stop: "65%" },
  ];

  it("每个光的默认值都与旧实现逐字相同", () => {
    for (const l of LEGACY) {
      const find = (suffix: string) =>
        variables.find((v) => v.name === `--kits-effect-ambient-${l.light}${suffix}`)?.default;
      expect(find(""), l.light).toBe(l.color);
      expect(find("-size"), l.light).toBe(l.size);
      expect(find("-position"), l.light).toBe(l.at);
      expect(find("-falloff"), l.light).toBe(l.stop);
    }
  });

  it("整体强度默认 1 → 默认渲染与旧实现完全一致", () => {
    expect(variables.find((v) => v.name === "--kits-effect-ambient-strength")?.default).toBe("1");
    expect(CSS).toMatch(/opacity:\s*var\(--kits-effect-ambient-strength\)/);
  });

  it("呼吸振幅是相对的（0.85 ↔ 1.0 的**比例**，不是绝对值）", () => {
    /*
     * 如果 keyframes 写死 opacity: 0.85 / 1，产品把强度调到 0.4 之后，
     * 呼吸会把它"提"回 1 —— 覆盖被动画吃掉。按比例写才不会。
     */
    const keyframes = CSS.slice(CSS.indexOf("@keyframes kits-ambient-breathe"));
    expect(keyframes).toContain(
      "calc(var(--kits-effect-ambient-strength) * 0.85)",
    );
    expect(keyframes).toContain("opacity: var(--kits-effect-ambient-strength)");
  });

  it("没有新增 blur 变量（当前效果没有模糊，补一个就是新能力）", () => {
    expect(variables.map((v) => v.name)).not.toContain("--kits-effect-ambient-blur");
    expect(CSS).not.toContain("filter:");
    // 但清单要把这个决定写出来，否则下一个人会以为是漏了
    expect(ambient.variablesNote).toContain("blur");
  });
});

describe("K-05 · 降级路径没有被削弱", () => {
  it("触屏与 reduced-motion 下仍然关闭呼吸，保留静态光", () => {
    const coarse = CSS.slice(CSS.indexOf("@media (hover: none), (pointer: coarse)"));
    expect(coarse).toContain("animation: none");
    const reduced = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain("animation: none");
  });

  it("两个降级块都只关呼吸，不动颜色与强度（静态光保留）", () => {
    for (const query of [
      "@media (hover: none), (pointer: coarse)",
      "@media (prefers-reduced-motion: reduce)",
    ]) {
      const start = CSS.indexOf(query);
      const block = CSS.slice(start, CSS.indexOf("\n}", start));
      expect(block).not.toContain("background-image");
      expect(block).not.toContain("--kits-effect-ambient-primary");
    }
  });
});

describe("K-05 · 契约的其余部分", () => {
  it("清单里写明了变量约定（含'默认值必须声明在 :root'这条）", () => {
    const convention = MANIFEST.contract.variableConvention.join("\n");
    expect(convention).toContain("--kits-effect-<namespace>-*");
    expect(convention).toContain(":root");
    expect(convention).toContain("不得重写效果内部的实现细节");
  });

  it("README 里有浅色主题的覆盖示例（产品可照抄）", () => {
    const readme = read("effects/README.md");
    expect(readme).toContain("--kits-effect-ambient-strength: 0.45");
    expect(readme).toContain('data-theme="light"');
    expect(readme).toContain("为什么没有 `--kits-effect-ambient-blur`");
  });

  it("没有把 Finance 的色值搬进 Kits", () => {
    /*
     * 注意判据是"**产品侧的东西**没有进来"，不是"不能提到这件事"。
     * CSS 注释里写明"上一版产品只能自己发明 --finance-ambient-*"是**文档**，
     * 正是它解释了这次为什么改 —— 把它禁掉等于禁止记录历史。
     *
     * 要禁的是：Kits 里出现 `--finance-*` 的**声明**，或者任何以
     * finance 命名的变量/类被真的定义出来。
     */
    expect(CSS, "ambient-glow.css 里出现了 --finance-* 的声明").not.toMatch(
      /--finance-[a-z-]+\s*:/,
    );
    const manifest = read("effects/manifest.json");
    expect(manifest.toLowerCase()).not.toContain("finance");
    // README 允许解释历史，但不允许出现可复制的产品变量名
    const readme = read("effects/README.md");
    expect(readme).not.toMatch(/--finance-[a-z-]+\s*:/);
  });
});
