/**
 * InsightReveal · 无障碍回归（K-01）。
 *
 * ===========================================================================
 * 这次修的是哪一类失败
 * ===========================================================================
 * v0.1.0 的 `step="group"` 宿主带了 `aria-hidden="true"`：
 *
 *     <div aria-hidden="true" class="kits-reveal__item" data-kits-reveal-index="0">
 *       <h3>…</h3><button>…</button>          ← 真实内容
 *     </div>
 *
 * 组件的注释当时写着「display:contents 不剪枝，子元素照常暴露」——
 * 前半句对（布局确实不受影响），后半句错：`aria-hidden` 剪掉的是**整棵子树**，
 * display:contents 拦不住它。
 *
 * 真实证据来自第二次 Source Installation 实验：DOM 里按钮存在，
 * 而 `getByRole("button")` 命中 **0**。整个洞察层从无障碍树消失，
 * 屏幕阅读器用户看到的是空白，键盘用户可以聚焦到"不存在"的控件上。
 *
 * ===========================================================================
 * 为什么这一组测试不能只断言"代码里写了什么"
 * ===========================================================================
 * 因为 bug 恰恰是"写了，但渲染出来的东西不对"。
 * 所以断言对象是 `renderToStaticMarkup` 的**真实产物** —— 它也顺便覆盖了
 * SSR 路径（服务端产物里宿主长什么样）。
 *
 * 浏览器里的 role 查询（真正的无障碍树）由 .qa/ 的 Playwright 探针覆盖：
 * vitest 跑在 node 环境，没有无障碍树。两层合起来才是完整证据。
 */

import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createElement as h, type ReactNode } from "react";

import { InsightReveal } from "../components/insight-reveal/insight-reveal.tsx";

/** 不转发 style 的自定义子组件 —— 真实产品里最常见的形态。 */
function StubbornRow({ children }: { children?: ReactNode }) {
  return h("div", { className: "stubborn-row" }, children);
}

const render = (props: Parameters<typeof InsightReveal>[0]) =>
  renderToStaticMarkup(h(InsightReveal, props));

/** 去掉注释后的组件源码 —— 断言"实现"，不是"注释里提到过什么"。 */
const source = (() => {
  const raw = readFileSync(
    new URL("../components/insight-reveal/insight-reveal.tsx", import.meta.url),
    "utf8",
  );
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
})();

describe("K-01 · 宿主不得剪掉内容语义", () => {
  it("宿主声明 role=presentation（无语义），不是 aria-hidden（剪枝）", () => {
    const html = render({
      step: "group",
      children: [h(StubbornRow, { key: 0 }, "a")],
    });
    expect(html).toContain('role="presentation"');
    expect(html).not.toContain("aria-hidden");
  });

  it("实现源码里不再出现 aria-hidden（注释不算）", () => {
    expect(source).not.toContain("aria-hidden");
    expect(source).toContain('role="presentation"');
  });

  it("heading / button / link 都留在产物里，且宿主没有把它们藏起来", () => {
    const html = render({
      step: "group",
      children: [
        h("h3", { key: 0 }, "第三季度结论"),
        h("button", { key: 1 }, "查看明细"),
        h("a", { key: 2, href: "/detail" }, "跳转到明细页"),
      ],
    });
    expect(html).toContain("<h3>第三季度结论</h3>");
    expect(html).toContain("<button>查看明细</button>");
    expect(html).toContain('href="/detail"');
    // 关键：这三个都被同一个宿主包着，而宿主上没有任何剪枝属性
    const hostSection = html.slice(0, html.indexOf("kits-reveal--group"));
    expect(hostSection).not.toContain("aria-hidden");
  });

  it("listitem 仍是 ul 的后代（列表语义不因宿主而断链）", () => {
    const html = render({
      as: "ul",
      step: "group",
      children: [
        h("li", { key: 0 }, "第一条"),
        h("li", { key: 1 }, "第二条"),
      ],
    });
    /* 根是 ul，宿主是它唯一的直接子元素，两个 li 都在宿主里 */
    expect(html.startsWith("<ul")).toBe(true);
    expect((html.match(/<li>/g) ?? []).length).toBe(2);
    expect(html).toContain('role="presentation"');
    expect(html).not.toContain("aria-hidden");
  });

  it("ol 语义同样保留（有序列表的序号由浏览器给出，不能被剪枝）", () => {
    const html = render({
      as: "ol",
      step: "group",
      children: [h("li", { key: 0 }, "第一步"), h("li", { key: 1 }, "第二步")],
    });
    expect(html.startsWith("<ol")).toBe(true);
    expect(html).toContain("第一步");
    expect(html).not.toContain("aria-hidden");
  });

  it("ARIA 属性写在子元素上时不被吞掉", () => {
    const html = render({
      step: "group",
      children: [
        h("button", { key: 0, "aria-expanded": "false", "aria-controls": "panel-1" }, "展开"),
      ],
    });
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="panel-1"');
  });

  it("键盘可达性不依赖可见性：未揭示时也没有 display:none / visibility:hidden", () => {
    const html = render({
      step: "group",
      children: [h("button", { key: 0 }, "可聚焦")],
    });
    expect(html).not.toContain("display:none");
    expect(html).not.toContain("visibility:hidden");
    expect(html).toContain("<button");
  });
});

describe("K-01 · 步进序号与无障碍是两个互不干扰的关注点", () => {
  it("不转发 style 的自定义子元素仍然拿到序号", () => {
    const html = render({
      step: "group",
      children: [h(StubbornRow, { key: 0 }, "a"), h(StubbornRow, { key: 1 }, "b")],
    });
    expect(html).toContain('data-kits-reveal-index="0"');
    expect(html).toContain('data-kits-reveal-index="1"');
    expect(html).toContain("--kits-reveal-index:1");
  });

  it("宿主仍然是 display:contents 的落点（CSS 侧契约不变）", () => {
    const css = readFileSync(
      new URL("../components/insight-reveal/insight-reveal.css", import.meta.url),
      "utf8",
    );
    expect(css).toContain(".kits-reveal--group > .kits-reveal__item");
    expect(css).toContain("display: contents");
    // CSS 里也不再要求宿主剪枝
    expect(css).not.toMatch(/kits-reveal__item[^{]*\{[^}]*aria/);
  });
});

describe("K-01 · 降级路径下内容依然可访问", () => {
  it("SSR 产物默认可见：没有 animated 类，但内容完整", () => {
    const html = render({
      step: "group",
      children: [h("h3", { key: 0 }, "服务端就可见的标题")],
    });
    expect(html).not.toContain("kits-reveal--animated");
    expect(html).toContain("服务端就可见的标题");
  });

  it("reduced-motion 只关动效，不关内容（CSS 层只动 transform/filter）", () => {
    const css = readFileSync(
      new URL("../components/insight-reveal/insight-reveal.css", import.meta.url),
      "utf8",
    );
    const reducedBlock = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reducedBlock).toContain("transform: none");
    expect(reducedBlock).toContain("filter: none");
    // reduced-motion 段不得出现隐藏内容的规则
    expect(reducedBlock).not.toMatch(/content-visibility|display:\s*none|visibility:\s*hidden/);
  });

  it("scripting:none 兜底把所有隐藏规则拉回可见（且宿主不参与剪枝）", () => {
    const css = readFileSync(
      new URL("../components/insight-reveal/insight-reveal.css", import.meta.url),
      "utf8",
    );
    const block = css.slice(css.indexOf("@media (scripting: none)"));
    expect(block).toContain(".kits-reveal > .kits-reveal__item");
    expect(block).toContain("opacity: 1");
  });
});

describe("K-01 · 对照：装饰节点仍然允许（并且应该）aria-hidden", () => {
  it("AnimatedGrid 是纯装饰，它自带 aria-hidden —— 这不是违规", () => {
    /*
     * 这条不是"顺便测一下别的组件"，它划出规则的另一半：
     * **装饰节点必须退出无障碍树，内容宿主绝不能退出**。
     * 把两者混为一谈，就会像 v0.1.0 那样"统一加 aria-hidden"，
     * 然后剪掉一整个内容区。
     */
    const src = readFileSync(
      new URL("../components/animated-grid/animated-grid.tsx", import.meta.url),
      "utf8",
    );
    expect(src).toContain('aria-hidden="true"');
  });
});
