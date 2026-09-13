/**
 * 移动端降级契约 · 指针能力优先于风格（K-02）。
 *
 * ===========================================================================
 * 这次修的是什么
 * ===========================================================================
 * v0.1.0 的 contracts/tokens.css 在 coarse pointer 下这样放大网格单元格：
 *
 *     @media (hover: none), (pointer: coarse) {
 *       :root, [data-kits-pack] {
 *         --kits-grid-cell: calc(var(--kits-grid-cell) * 1.5);
 *       }
 *     }
 *
 * 两处错，而且都**不会报错**：
 *
 *   1. **自引用**。`--kits-grid-cell` 在自己的值里引用自己 = 依赖环，
 *      这条声明在 computed-value 阶段被判无效。
 *   2. **特异性打平、源顺序在后**。就算不循环，`[data-kits-pack]` 与
 *      pack 自己的 `[data-kits-pack="cinematic"]` 都是 0-1-0，
 *      而 pack 在源顺序上更晚 → pack 的 `64px` 赢。
 *
 * 实测：期望 96px（64 × 1.5），得到 64px —— 移动端反摩尔纹降级被静默吃掉。
 *
 * ===========================================================================
 * 修法：拆成两个名字，乘法写在消费点上
 * ===========================================================================
 *   --kits-grid-cell         pack 的**基准**尺寸（48 / 64 / 32）
 *   --kits-grid-cell-scale   契约的**指针能力因子**（细指针 1，触屏 1.5）
 *
 * 两个名字不可能互相覆盖 —— 这是本次修复的核心，比加 !important 更根本。
 * 乘法写在 `.kits-grid` 自己身上（animated-grid.css），因为自定义属性在
 * **声明它的那个元素**上完成 var() 替换；写在 :root 就会认死 :root 的值，
 * 产品把 pack 作用域放到某个容器上时会拿到过期基准。
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const CONTRACT_RAW = read("packages/contracts/tokens.css");
/** 去掉注释后的契约 —— 断言"实现"，不是"文档里提到过什么"。 */
const CONTRACT = CONTRACT_RAW.replace(/\/\*[\s\S]*?\*\//g, "");
const GRID_CSS = read("components/animated-grid/animated-grid.css");

/** 取出某个 @media 块的正文（到下一个顶层 `}` 为止）。 */
function mediaBlock(css: string, query: string): string {
  const start = css.indexOf(query);
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

describe("K-02 · 契约把'基准'与'能力因子'分成两个变量", () => {
  it("契约声明了基准值与因子，且因子默认是 1", () => {
    expect(CONTRACT).toMatch(/--kits-grid-cell:\s*48px/);
    expect(CONTRACT).toMatch(/--kits-grid-cell-scale:\s*1;/);
  });

  it("coarse pointer 下因子变成 1.5，且带 !important", () => {
    const block = mediaBlock(CONTRACT, "@media (hover: none), (pointer: coarse)");
    expect(block).toContain("--kits-grid-cell-scale: 1.5 !important");
  });

  it("coarse pointer **不再**重新声明 --kits-grid-cell", () => {
    /*
     * 这一条正是旧的失败形态。只要它还出现在移动端块里，
     * 就说明有人又回到了"直接改 pack 的变量"那条路 —— 那条路一定会
     * 撞上特异性打平 + 源顺序，而且必然自引用。
     */
    const block = mediaBlock(CONTRACT, "@media (hover: none), (pointer: coarse)");
    expect(block).not.toMatch(/--kits-grid-cell\s*:/);
  });

  it("契约里不存在自引用的自定义属性（依赖环）", () => {
    /*
     * 通用守卫：任何 `--x: … var(--x) …` 都是无效声明。
     * 它不像语法错误那样会被构建拦下 —— 它只是**不生效**。
     */
    const offenders: string[] = [];
    const re = /(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(CONTRACT)) !== null) {
      const [, name, value] = m;
      if (value.includes(`var(${name})`) || value.includes(`var(${name},`)) {
        offenders.push(`${name}: ${value.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("reduced-motion 块不碰网格尺寸（它管动效，不管布局）", () => {
    const block = mediaBlock(CONTRACT, "@media (prefers-reduced-motion: reduce)");
    expect(block).not.toContain("--kits-grid-cell");
  });
});

describe("K-02 · 乘法写在消费点上，不在 :root", () => {
  it("animated-grid 用基准 × 因子 × 密度算出有效值", () => {
    expect(GRID_CSS).toContain("var(--kits-grid-cell) * var(--kits-grid-cell-scale, 1)");
    expect(GRID_CSS).toContain("var(--kits-grid-density, 1)");
  });

  it("乘法**在 .kits-grid 规则内**，不在 :root", () => {
    const gridRule = GRID_CSS.slice(GRID_CSS.indexOf(".kits-grid {"));
    const ruleBody = gridRule.slice(0, gridRule.indexOf("}"));
    expect(ruleBody).toContain("--kits-grid-cell-size");
    // :root 里出现这个乘法 = 又回到了"认死文档根元素的值"的坑
    expect(CONTRACT).not.toContain("--kits-grid-cell-size");
  });

  it("var() 带兜底值 1：没有契约文件时组件也不会算出 0 尺寸", () => {
    expect(GRID_CSS).toContain("var(--kits-grid-cell-scale, 1)");
    expect(GRID_CSS).toContain("var(--kits-grid-density, 1)");
  });

  it("组件只用行内样式贡献密度乘数，**不**重算 --kits-grid-cell-size", () => {
    /*
     * 这条来自 v0.1.1 的一次真实翻车：K-02 的 CSS 改对了，跑单元测试也全绿，
     * 但浏览器里量出来仍然是 64px。原因是组件在**行内样式**里又写了一遍
     *     "--kits-grid-cell-size": `calc(var(--kits-grid-cell) * 2)`
     * —— 行内样式优先级高于样式表，把契约的能力因子整个盖掉了。
     *
     * 只断言 CSS 是查不出来的：必须在组件侧也立一条。
     */
    const tsx = read("components/animated-grid/animated-grid.tsx")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    expect(tsx).toContain('["--kits-grid-density" as string]');
    expect(tsx).not.toContain("--kits-grid-cell-size");
    expect(tsx).not.toContain("--kits-grid-cell-scale");
  });

  it("密度乘数仍然是组件自己的语义（none/dense/normal/wide）", () => {
    const tsx = read("components/animated-grid/animated-grid.tsx");
    for (const key of ["none:", "dense:", "normal:", "wide:"]) {
      expect(tsx, key).toContain(key);
    }
    expect(tsx).toContain('none: "0px"');
    expect(tsx).toContain('dense: "0.5"');
    expect(tsx).toContain('wide: "2"');
  });

  it("网格线宽与淡出仍然由 pack 决定（这次改动没有顺手改风格）", () => {
    expect(GRID_CSS).toContain("var(--kits-grid-line-width)");
    expect(GRID_CSS).toContain("var(--kits-grid-line-color)");
  });
});

describe("K-02 · 移动端与 reduced-motion 的其余降级没有被削弱", () => {
  it("触屏下 drift / pulse 动画仍然关闭", () => {
    const block = mediaBlock(GRID_CSS, "@media (hover: none), (pointer: coarse)");
    expect(block).toContain(".kits-grid--motion-drift");
    expect(block).toContain(".kits-grid--motion-pulse");
    expect(block).toContain("animation: none");
  });

  it("reduced-motion 下同样关闭动效（但保留静态网格）", () => {
    const block = mediaBlock(GRID_CSS, "@media (prefers-reduced-motion: reduce)");
    expect(block).toContain("animation: none");
    // 静态网格是背景结构，不该被降级掉
    expect(block).not.toContain("background-image");
  });

  it("指针能力因子与指针视差因子是同一类契约（都受 !important 保护）", () => {
    const coarse = mediaBlock(CONTRACT, "@media (hover: none), (pointer: coarse)");
    expect(coarse).toContain("--kits-pointer-factor: 0 !important");
    expect(coarse).toContain("--kits-grid-cell-scale: 1.5 !important");
  });
});

describe("K-02 · pack 侧只声明基准，不知道因子的存在", () => {
  it("cinematic 声明 64px 基准，且不声明因子", () => {
    const cinematic = read("styles/cinematic/tokens.css");
    expect(cinematic).toMatch(/--kits-grid-cell:\s*64px/);
    expect(cinematic).not.toContain("--kits-grid-cell-scale");
  });

  it("instrument 声明 32px 基准，且不声明因子", () => {
    const instrument = read("styles/instrument/tokens.css");
    expect(instrument).toMatch(/--kits-grid-cell:\s*32px/);
    expect(instrument).not.toContain("--kits-grid-cell-scale");
  });

  it("没有任何 pack 覆盖因子 —— 那是契约的地盘", () => {
    for (const pack of ["editorial", "cinematic", "instrument"]) {
      expect(read(`styles/${pack}/tokens.css`)).not.toContain("--kits-grid-cell-scale");
    }
  });
});
