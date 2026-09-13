/**
 * InsightReveal · step="group" 的宿主 wrapper 回归测试。
 *
 * ===========================================================================
 * 这次修复的是哪一类失败
 * ===========================================================================
 * 旧实现用 `cloneElement(child, { style: { "--kits-reveal-index": … } })`
 * 把步进序号写给**子元素**。这要求消费方的子元素把 `style` 原样转发到
 * 自己的宿主元素上 —— 而产品里的子元素通常是自定义组件
 * （有自己的 props、不接收 style），于是变量被 React **静默丢弃**：
 *
 *     children[0].getAttribute("style")  →  null
 *     --kits-reveal-index                →  ""     ← 步进彻底失效
 *
 * 不报错、不警告，只是不生效。第一次真实集成里，这个 bug 只有在浏览器中
 * 量过 DOM 才发现（`--kits-reveal-index` 为空字符串）。
 *
 * 修复方式：序号改由**组件自己建立的宿主**承载，消费方不需要知道这件事。
 *
 * ===========================================================================
 * 为什么这里用 renderToStaticMarkup 而不是源码断言
 * ===========================================================================
 * 源码断言只能证明"代码里写了某个字符串"，证明不了"它出现在输出里"。
 * 而这个 bug 的本质恰恰是**写了但没出现在输出里** ——
 * 所以必须以真实渲染的 HTML 为断言对象。
 *
 * `renderToStaticMarkup` 不需要 DOM 环境，且正好走的是 SSR 路径，
 * 因此它同时覆盖了"服务端产物里序号是否存在"。
 */

import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createElement as h, type ReactNode } from "react";

import { InsightReveal } from "../components/insight-reveal/insight-reveal.tsx";

/**
 * 一个**不转发 style** 的自定义子组件 —— 正是旧实现失败的场景。
 *
 * children 声明为可选，是为了能走 `h(type, props, ...children)` 这个重载；
 * 真实的失败场景正是"子组件有自己的 props 形状，不接收任意 style"。
 */
function StubbornRow({ children }: { children?: ReactNode }) {
  return h("div", { className: "stubborn-row" }, children);
}

const render = (props: Parameters<typeof InsightReveal>[0]) =>
  renderToStaticMarkup(h(InsightReveal, props));

describe("InsightReveal · step=group 的序号必须落到 DOM", () => {
  it("每一个直接子元素都有一个带序号的宿主 wrapper", () => {
    const html = render({
      step: "group",
      children: [
        h(StubbornRow, { key: 0 }, "第一条"),
        h(StubbornRow, { key: 1 }, "第二条"),
        h(StubbornRow, { key: 2 }, "第三条"),
      ],
    });

    expect(html).toContain('data-kits-reveal-item=""');
    expect(html).toContain('data-kits-reveal-index="0"');
    expect(html).toContain('data-kits-reveal-index="1"');
    expect(html).toContain('data-kits-reveal-index="2"');
  });

  it("序号同时写入 CSS 变量（CSS 靠它算 transition-delay）", () => {
    const html = render({
      step: "group",
      children: [h(StubbornRow, { key: 0 }, "a"), h(StubbornRow, { key: 1 }, "b")],
    });
    expect(html).toContain("--kits-reveal-index:0");
    expect(html).toContain("--kits-reveal-index:1");
  });

  it("子元素**不**需要转发 style —— 这正是旧实现失败的地方", () => {
    const html = render({
      step: "group",
      children: [h(StubbornRow, { key: 0 }, "第一条")],
    });
    // 子组件本身没有 style 属性（它不转发），但序号依然存在
    expect(html).not.toMatch(/<div class="stubborn-row" style=/);
    expect(html).toContain('data-kits-reveal-index="0"');
  });

  it("步进序号被 maxStagger 截断（避免第 20 段等太久）", () => {
    const children = Array.from({ length: 6 }, (_, i) =>
      h(StubbornRow, { key: i }, `第 ${i}`),
    );
    const html = render({ step: "group", maxStagger: 2, children });
    expect(html).toContain('data-kits-reveal-index="2"');
    // 第 3..5 个的**属性**序号仍然真实（便于调试），但 CSS 变量被截断
    expect(html).toContain("--kits-reveal-index:2");
    expect(html).not.toContain("--kits-reveal-index:3");
  });

  it("宿主带 role=presentation，且**绝不**带 aria-hidden", () => {
    /*
     * v0.1.0 的这条测试断言的是 `aria-hidden="true"` —— 它把 bug 写进了
     * 期望值里，于是一整轮真实消费之后，测试仍然是绿的，而屏幕阅读器
     * 读不到整个揭示区。见 CHANGELOG K-01。
     *
     * 正确的判据是**否定的**：宿主可以声明"我不承载语义"（presentation），
     * 但不允许剪枝（aria-hidden），因为宿主里包的是真实内容。
     */
    const html = render({
      step: "group",
      children: [h(StubbornRow, { key: 0 }, "a"), h(StubbornRow, { key: 1 }, "b")],
    });
    const hosts = html.match(/<div role="presentation" class="kits-reveal__item"/g) ?? [];
    expect(hosts.length).toBe(2);
    // 这一条是本次修复的核心：宿主里包的是内容，不是装饰
    expect(html).not.toContain("aria-hidden");
  });

  it("group 模式在根元素上标记 kits-reveal--group（CSS 据此切选择器）", () => {
    const html = render({ step: "group", children: [h("div", { key: 0 }, "a")] });
    expect(html).toContain("kits-reveal--group");
  });

  it("step=one 不建立宿主 wrapper（整体揭示不需要序号）", () => {
    const html = render({ step: "one", children: [h(StubbornRow, { key: 0 }, "a")] });
    expect(html).not.toContain("data-kits-reveal-item");
    expect(html).not.toContain("kits-reveal--group");
  });
});

describe("InsightReveal · 三层降级在 SSR 产物里成立", () => {
  it("脚本未执行时内容默认可见（不含 kits-reveal--animated）", () => {
    const html = render({
      step: "group",
      children: [h(StubbornRow, { key: 0 }, "第一条")],
    });

    /*
     * 这两条一起才构成"默认可见"：
     *   - `data-kits-visible="false"`：观察器还没跑（水合前），如实反映状态
     *   - 没有 `kits-reveal--animated`：CSS 的隐藏规则全部带这个类，
     *     因此内容**不会被藏起来**（`.kits-reveal { opacity: 1 }` 是静止态）
     *
     * 关键：隐藏是**有条件**的，显示是无条件的。如果反过来
     * （隐藏无条件、显示依赖 JS），一次脚本错误就会让整页空白。
     */
    expect(html).not.toContain("kits-reveal--animated");
    expect(html).toContain('data-kits-visible="false"');
    expect(html).toContain("第一条");
  });

  it("内容本身始终渲染（降级后信息零损失）", () => {
    const html = render({
      step: "group",
      children: [
        h(StubbornRow, { key: 0 }, "第三条结论：软件科目环比增长 92.5%"),
      ],
    });
    expect(html).toContain("软件科目环比增长 92.5%");
  });

  it("位移与模糊的档位乘数写在根元素的 CSS 变量上", () => {
    const html = render({
      step: "group",
      shift: "strong",
      blur: true,
      children: [h(StubbornRow, { key: 0 }, "a")],
    });
    expect(html).toContain("--kits-reveal-shift-scale:1.8");
    expect(html).toContain("kits-reveal--blur");
    expect(html).toContain("kits-reveal--shift");
  });
});

describe("InsightReveal · 实现不再依赖子元素配合", () => {
  /**
   * 只断言**代码**，不断言注释。
   *
   * 本组件的文件头注释里**故意**解释了旧实现与那个 TS2322 事故 ——
   * 那是文档，不是实现。把注释算进来会让这条测试变成"禁止记录历史"。
   */
  const source = (() => {
    const raw = readFileSync(
      new URL("../components/insight-reveal/insight-reveal.tsx", import.meta.url),
      "utf8",
    );
    return raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  })();

  it("源码里不再使用 cloneElement 改子元素", () => {
    expect(source).not.toContain("cloneElement");
    expect(source).not.toContain("isValidElement");
  });

  it("ref 收窄不再对联合根元素写成交叉类型", () => {
    /*
     * 这条断言的是**类型策略**，不是"某个字符串不存在"。
     *
     * 历史：消费方的 tsc 曾在 `ref={ref as React.Ref<never>}` 这行报 TS2322，
     * 看起来像这行的锅，真实根因是 @types/react 版本漂移
     * （产品 19.2.18 / Kits 19.3.0）。修法是对齐依赖版本，
     * 守卫在 kits doctor 的 react-types-major-parity 检查里，
     * 而不是在这里加一个只会掩盖问题的断言。
     *
     * 因此这里只保证：ref 被显式收窄过（而不是直接把联合类型的 ref 交出去）。
     */
    expect(source).toContain("ref as React.Ref<");
  });

  it("CSS 用 display:contents 让宿主对布局不可见", () => {
    const css = readFileSync(
      new URL("../components/insight-reveal/insight-reveal.css", import.meta.url),
      "utf8",
    );
    expect(css).toContain("display: contents");
  });
});
