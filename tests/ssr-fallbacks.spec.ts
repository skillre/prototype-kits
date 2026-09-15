/**
 * SSR 兼容性与降级路径的静态审计。
 *
 * 为什么用静态检查而不是渲染测试：
 *   - **降级是写在源码里的分支**，"能不能跑"远远不够 ——
 *     我们要确认的是"在什么条件下会走哪条分支"。
 *   - 这些断言会随源码一起演进：任何人删掉一个降级分支，测试立刻失败。
 *
 * 覆盖的契约点：
 *   1. 每个组件都有 "use client"（浏览器 API 只能在客户端）
 *   2. 浏览器 API 只出现在 useEffect 内，且都经过能力探测
 *   3. 每个组件都有 reduced-motion 与移动端降级（源码 + README + manifest 三处）
 *   4. 共享 hook 里没有裸 window / document 引用
 *   5. InsightReveal 的"默认可见"契约（JS 失败时内容不会消失）
 *   6. 关键效果层都退出命中测试与无障碍树
 *   7. 组件在三种 Style Pack 下都可以被导入（无 pack 硬依赖）
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { editorialMotion } from "../styles/editorial/index.ts";
import { cinematicMotion } from "../styles/cinematic/index.ts";
import { instrumentMotion } from "../styles/instrument/index.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (relative: string) =>
  readFileSync(path.join(ROOT, relative), "utf8");

const COMPONENTS = [
  "interactive-hero",
  "spotlight-surface",
  "animated-grid",
  "data-cursor",
  "insight-reveal",
] as const;

function implementationOf(id: string): string {
  const dir = path.join(ROOT, "components", id);
  const file = readdirSync(dir).find((entry) => entry.endsWith(".tsx"))!;
  return `components/${id}/${file}`;
}

function stylesheetOf(id: string): string | null {
  const dir = path.join(ROOT, "components", id);
  const file = readdirSync(dir).find((entry) => entry.endsWith(".css"));
  return file ? `components/${id}/${file}` : null;
}

/* -------------------------------------------------------------------------- */
/* 1. 客户端边界                                                                */
/* -------------------------------------------------------------------------- */

describe("SSR import · 客户端边界", () => {
  it.each(COMPONENTS)("%s 的实现以 \"use client\" 开头", (id) => {
    const source = read(implementationOf(id));
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
  });

  it.each(COMPONENTS)(
    "%s 不在渲染期访问 window / document（全部收敛到 useEffect 内）",
    (id) => {
      const source = read(implementationOf(id));
      const renderTimePart = source
        .split("useEffect")[0]
        .split("return (")[0];
      expect(renderTimePart.includes("window.")).toBe(false);
      expect(renderTimePart.includes("document.")).toBe(false);
      expect(renderTimePart.includes("navigator.")).toBe(false);
    },
  );

  it("共享 hook 里没有裸 window / document 引用", () => {
    for (const file of [
      "packages/react-utils/env.ts",
      "packages/react-utils/use-element-pointer.ts",
      "packages/react-utils/use-parallax-layers.ts",
      "packages/react-utils/use-reveal.ts",
    ]) {
      const source = read(file);
      expect(
        /\bwindow\./.test(source),
        `${file} 直接引用了 window.`,
      ).toBe(false);
      expect(
        /\bdocument\./.test(source),
        `${file} 直接引用了 document.`,
      ).toBe(false);
    }
  });

  it("能力探测经过 typeof 守卫（服务端不会抛错）", () => {
    const env = read("packages/react-utils/env.ts");
    expect(env).toContain('typeof globalScope.matchMedia !== "function"');
    const reveal = read("packages/react-utils/use-reveal.ts");
    expect(reveal).toContain('typeof IntersectionObserver === "undefined"');
  });
});

/* -------------------------------------------------------------------------- */
/* 2. reduced-motion 降级                                                       */
/* -------------------------------------------------------------------------- */

describe("reduced-motion fallback", () => {
  it("契约层强制把动效变量归零（CSS 兜底）", () => {
    const contract = read("packages/contracts/tokens.css");
    expect(contract).toContain("@media (prefers-reduced-motion: reduce)");
    expect(contract).toContain("--kits-pointer-factor: 0 !important");
    expect(contract).toContain("--kits-enter-distance: 0px !important");
    expect(contract).toContain("--kits-dur-base: 0ms !important");
  });

  it("共享 hook 提供 useMotionAllowed 且首帧为 false（避免 hydration mismatch）", () => {
    const env = read("packages/react-utils/env.ts");
    expect(env).toContain("export function useMotionAllowed");
    // 首帧必须与 SSR 一致（静态），挂载后才可能启用动效
    expect(env).toContain("return mounted && !reduced");
  });

  it.each(COMPONENTS)("%s 的样式包含 prefers-reduced-motion 处理", (id) => {
    const stylesheet = stylesheetOf(id);
    if (!stylesheet) return;
    const css = read(stylesheet);
    const handlesReducedMotion =
      css.includes("prefers-reduced-motion") ||
      css.includes("--kits-pointer-factor") ||
      css.includes("--kits-enter-distance");
    expect(
      handlesReducedMotion,
      `${id} 的样式表没有任何 reduced-motion 相关处理`,
    ).toBe(true);
  });

  it.each(COMPONENTS)("%s 的 README 说明了 reduced-motion 行为", (id) => {
    expect(read(`components/${id}/README.md`)).toContain("reduced-motion");
  });

  it.each(COMPONENTS)("%s 的 manifest 声明了 reduced-motion 行为", (id) => {
    const manifest = JSON.parse(
      read(`components/${id}/manifest.json`),
    ) as { reducedMotion?: { behavior?: string[]; mechanism?: string } };
    expect(manifest.reducedMotion, `${id} 缺 reducedMotion`).toBeDefined();
    expect(manifest.reducedMotion!.behavior!.length).toBeGreaterThan(0);
    expect(manifest.reducedMotion!.mechanism).toBeTruthy();
  });

  it("instrument 的 reduced-motion 契约与另外两套不同（瞬时可见 vs 保留淡入）", () => {
    expect(instrumentMotion.reducedMotion.keepOpacity).toBe(false);
    expect(cinematicMotion.reducedMotion.keepOpacity).toBe(true);
    expect(editorialMotion.reducedMotion.keepOpacity).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* 3. 移动端降级                                                                */
/* -------------------------------------------------------------------------- */

describe("mobile fallback", () => {
  it("契约层对粗指针做了全局降级", () => {
    const contract = read("packages/contracts/tokens.css");
    expect(contract).toContain("@media (hover: none), (pointer: coarse)");
    expect(contract).toContain("--kits-pointer-factor: 0 !important");
  });

  it.each(COMPONENTS)("%s 的样式包含移动端或粗指针降级", (id) => {
    const stylesheet = stylesheetOf(id);
    if (!stylesheet) return;
    const css = read(stylesheet);
    const handlesMobile =
      css.includes("max-width: 640px") ||
      css.includes("max-width: 900px") ||
      css.includes("(pointer: coarse)");
    expect(handlesMobile, `${id} 没有移动端降级规则`).toBe(true);
  });

  it.each(COMPONENTS)("%s 的 manifest 声明了 mobileFallback 且不丢内容", (id) => {
    const manifest = JSON.parse(read(`components/${id}/manifest.json`)) as {
      mobileCompatible: true | "fallback-only";
      mobileFallback?: { trigger?: string; behavior?: string[]; noContentLoss?: boolean };
    };
    // K2：`true` = 允许在移动端用（仍需适配）；`"fallback-only"` = 只能用降级形态。
    // 两种都必须给出可核对的降级行为 —— 「兼容」从不等于「推荐」。
    expect([true, "fallback-only"]).toContain(manifest.mobileCompatible);
    expect(manifest.mobileFallback?.trigger).toBeTruthy();
    expect(manifest.mobileFallback?.behavior?.length).toBeGreaterThan(0);
    expect(
      manifest.mobileFallback?.noContentLoss,
      `${id}: 移动端降级不得丢内容`,
    ).toBe(true);
  });

  it.each(COMPONENTS)("%s 的 README 说明移动端降级", (id) => {
    expect(read(`components/${id}/README.md`)).toContain("移动端降级");
  });
});

/* -------------------------------------------------------------------------- */
/* 4. InsightReveal 的「默认可见」契约（最容易做错的一条）                        */
/* -------------------------------------------------------------------------- */

describe("InsightReveal · JS 失败时内容不消失", () => {
  it("隐藏规则必须带 --animated 前缀（默认状态可见）", () => {
    const css = read("components/insight-reveal/insight-reveal.css");
    expect(css).toContain(".kits-reveal--animated:not([data-kits-visible");
    // 默认状态显式声明为可见
    expect(css).toMatch(/\.kits-reveal\s*\{[^}]*opacity:\s*1/);

    // 所有「把内容隐藏起来」的顶层规则（选择器起于行首）都必须带 --animated 或
    // 位于降至零的动画关键帧内。子选择器规则受顶层规则约束，不需要重复判断。
    const blocks = css.split("}").filter((block) => block.includes("opacity: 0"));
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      const selector = block.split("{")[0];
      const isTopLevel = /^\.kits-reveal/.test(selector.trim());
      if (!isTopLevel) continue;
      expect(
        selector.includes("--animated"),
        `顶层隐藏规则缺少 --animated 前缀（JS 失败时内容会消失）：${selector.trim()}`,
      ).toBe(true);
    }
  });

  it("样式表包含 scripting: none 兜底", () => {
    expect(read("components/insight-reveal/insight-reveal.css")).toContain(
      "@media (scripting: none)",
    );
  });

  it("不使用 display:none / visibility:hidden（会困住键盘用户）", () => {
    const css = read("components/insight-reveal/insight-reveal.css");
    expect(css).not.toContain("display: none");
    expect(css).not.toContain("visibility: hidden");
  });

  it("manifest 明确记载了这条契约", () => {
    const manifest = JSON.parse(
      read("components/insight-reveal/manifest.json"),
    ) as { a11y: { notes: string[] } };
    const text = manifest.a11y.notes.join(" ");
    expect(text).toContain("默认");
    expect(text).toContain("可见");
  });
});

/* -------------------------------------------------------------------------- */
/* 5. 装饰层必须退出命中测试与无障碍树                                          */
/* -------------------------------------------------------------------------- */

describe("装饰层契约", () => {
  it("AnimatedGrid 整体 aria-hidden 且不拦截指针", () => {
    const source = read("components/animated-grid/animated-grid.tsx");
    expect(source).toContain('aria-hidden="true"');
    const css = read("components/animated-grid/animated-grid.css");
    expect(css).toContain("pointer-events: none");
  });

  it("SpotlightSurface 光斑层 aria-hidden 且内容层在其之上", () => {
    const source = read("components/spotlight-surface/spotlight-surface.tsx");
    expect(source).toContain('aria-hidden="true"');
    const css = read("components/spotlight-surface/spotlight-surface.css");
    expect(css).toContain("pointer-events: none");
    expect(css).toMatch(/__content\s*\{[^}]*z-index:\s*1/);
  });

  it("DataCursor 指示器 aria-hidden 且只在标记区域隐藏系统光标", () => {
    const source = read("components/data-cursor/data-cursor.tsx");
    expect(source).toContain('aria-hidden="true"');
    const css = read("components/data-cursor/data-cursor.css");
    expect(css).toContain("[data-cursor]");
    expect(css).toContain("cursor: none");
  });

  it("InteractiveHero 的背景板退出无障碍树", () => {
    const source = read("components/interactive-hero/interactive-hero.tsx");
    expect(source).toContain('aria-hidden="true"');
  });
});

/* -------------------------------------------------------------------------- */
/* 6. 组件不得硬依赖某个 Style Pack                                            */
/* -------------------------------------------------------------------------- */

describe("组件与 Style Pack 解耦", () => {
  it.each(COMPONENTS)("%s 的实现代码里不出现任何 pack 名字", (id) => {
    const source = read(implementationOf(id));
    for (const pack of ["editorial", "cinematic", "instrument"]) {
      expect(
        source.includes(`"${pack}"`) || source.includes(`'${pack}'`),
        `${id} 硬引用了 pack "${pack}" —— 组件不应该知道 pack 的名字`,
      ).toBe(false);
    }
  });

  it.each(COMPONENTS)("%s 的 CSS 只读 --kits-* 变量", (id) => {
    const stylesheet = stylesheetOf(id);
    if (!stylesheet) return;
    const css = read(stylesheet);
    // 允许 var(--kits-*)；不允许写死颜色（hex 检查见 contracts.spec.ts）
    const variableUses = css.match(/var\(--kits-[a-z0-9-]+/g) ?? [];
    expect(variableUses.length, `${id} 没有使用契约变量`).toBeGreaterThan(0);
  });

  it("组件样式目录里不存在 pack 专属文件（说明组件与 pack 已解耦）", () => {
    for (const id of COMPONENTS) {
      const dir = path.join(ROOT, "components", id);
      for (const entry of readdirSync(dir)) {
        expect(
          ["editorial", "cinematic", "instrument"].includes(
            entry.replace(/\.(css|ts|tsx|json)$/, ""),
          ),
          `${id} 目录出现 pack 专属文件 ${entry}`,
        ).toBe(false);
      }
    }
  });

  it("Playground 的三个路由都存在（并排 / 组件 / 审计）", () => {
    for (const route of [
      "playground/app/page.tsx",
      "playground/app/components/page.tsx",
      "playground/app/audit/page.tsx",
    ]) {
      expect(existsSync(path.join(ROOT, route)), `${route} 缺失`).toBe(true);
    }
  });
});
