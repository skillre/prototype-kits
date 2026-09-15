/**
 * Browser QA —— Prototype Kits Playground。
 *
 * 立场：**测试通过不等于画面成立**。
 * 这个脚本把三个路由真正渲染出来，检查四件在单元测试里看不到的事：
 *   1. 三套 Style Pack 在同一页里并排时，是否真的渲染出了**不同**的视觉结果；
 *   2. 是否有横向溢出 / 控制台报错 / 页面异常 / 请求失败；
 *   3. 组件在三种 pack 下是否都真正挂载（而不是静默失败成空白）；
 *   4. 降级路径是否生效（例如 reduced-motion 下 InsightReveal 内容必须可见）。
 *
 * 用法：
 *   node .qa/kits-shots.mjs                 # 自己起 Playground（端口 3300）并自己停
 *   KITS_BASE=http://host:port node .qa/kits-shots.mjs
 *                                           # EXTERNAL：不起也不停 server，但身份检查照跑
 *
 * server 归本次运行管：端口取自 .qa/qa.config.mjs 的 QA_PORT，起完先验身份
 * （页面必须带着 Kits 自己的标记），再跑断言。不复用未知 server —— 见 .qa/qa-server.mjs。
 *
 * 截图落在 .qa/out/（已在 .gitignore 中忽略），末尾打印 QA OK 或问题清单。
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { QA_ORIGIN } from "./qa.config.mjs";
import { withQaServer } from "./qa-server.mjs";

/**
 * `let`，不是 `const`：真正的值在身份检查通过之后由 `main()` 写入。
 * 模块级默认值只是「没被赋值时该打哪里」的兜底，不是事实来源。
 */
let BASE = process.env.KITS_BASE ?? QA_ORIGIN;
const OUT = path.join(process.cwd(), ".qa", "out");

const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1440, height: 900, isMobile: false },
  { name: "mobile-390x844", width: 390, height: 844, isMobile: true },
];

const ROUTES = [
  { name: "home", path: "/", expect: ["Style Packs"] },
  { name: "components", path: "/components", expect: ["Signature Components"] },
  { name: "effects", path: "/effects", expect: ["Effect Contract"] },
  { name: "audit", path: "/audit", expect: ["Asset Registry"] },
];

const PACKS = ["editorial", "cinematic", "instrument"];

const problems = [];

async function checkRoute(browser, route, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    // 浏览器对 data: / favicon 的可选失败不计入（不影响页面成立）
    const url = request.url();
    if (url.startsWith("data:")) return;
    failedRequests.push(`${url} :: ${request.failure()?.errorText}`);
  });

  const response = await page.goto(`${BASE}${route.path}`, {
    waitUntil: "load",
  });
  if (response?.status() !== 200) {
    problems.push(
      `${viewport.name} ${route.path}: HTTP ${response?.status()}`,
    );
  }

  // 让所有 pack 舞台进入过视口（否则揭示动画停在 opacity 0 的起手态）
  const stages = page.locator("[data-kits-pack]");
  const stageCount = await stages.count();
  for (let index = 0; index < stageCount; index += 1) {
    await stages.nth(index).scrollIntoViewIfNeeded();
    await page.waitForTimeout(160);
  }
  await page.waitForTimeout(700);

  for (const text of route.expect) {
    const found = await page.locator(`text=${text}`).first().count();
    if (found === 0) {
      problems.push(`${viewport.name} ${route.path}: 缺少预期内容「${text}」`);
    }
  }

  // ---- 组件是否真的渲染出来（不是静默失败） ----
  if (route.path === "/") {
    const mounted = await page.evaluate(() =>
      ["interactive-hero", "spotlight-surface", "animated-grid", "data-cursor", "insight-reveal"].map(
        (id) =>
          document.querySelectorAll(`[data-kits-component="${id}"]`).length,
      ),
    );
    mounted.forEach((count, index) => {
      const id = [
        "interactive-hero",
        "spotlight-surface",
        "animated-grid",
        "data-cursor",
        "insight-reveal",
      ][index];
      if (count < 3) {
        problems.push(
          `${viewport.name} /: 组件 ${id} 只渲染了 ${count} 个实例（应为 3 —— 每个 pack 一个）`,
        );
      }
    });

    // 三套 pack 的计算样式必须真的不同
    const perPack = {};
    for (const pack of PACKS) {
      const sample = page.locator(`[data-kits-pack="${pack}"]`).first();
      perPack[pack] = await sample.evaluate((element) => {
        const styles = getComputedStyle(element);
        return {
          displayFont: styles.getPropertyValue("--kits-font-display").trim(),
          displayLine: styles.getPropertyValue("--kits-display-line").trim(),
          radius: styles.getPropertyValue("--kits-radius-surface").trim(),
          borderWidth: styles.getPropertyValue("--kits-border-width").trim(),
          spaceUnit: styles.getPropertyValue("--kits-space-unit").trim(),
          canvas: styles.getPropertyValue("--kits-color-canvas").trim(),
          bodySize: styles.getPropertyValue("--kits-body-size").trim(),
        };
      });
    }
    for (const key of [
      "displayFont",
      "displayLine",
      "radius",
      "spaceUnit",
      "canvas",
      "bodySize",
    ]) {
      const values = PACKS.map((pack) => perPack[pack][key]);
      if (new Set(values).size < 2) {
        problems.push(
          `${viewport.name} /: 维度 ${key} 在三套 pack 下取值相同 → ${values.join(" | ")}`,
        );
      }
    }
    if (new Set(PACKS.map((pack) => perPack[pack].canvas)).size !== 3) {
      problems.push(
        `${viewport.name} /: 三套 pack 的画布色没有全部不同 → ${PACKS.map((p) => perPack[p].canvas).join(" | ")}`,
      );
    }
    if (perPack.editorial.displayFont === perPack.instrument.displayFont) {
      problems.push(
        `${viewport.name} /: editorial 与 instrument 的 display 字体相同（editorial 应为衬线，instrument 应为等宽）`,
      );
    }
  }

  // ---- 横向溢出 ----
  const overflow = await page.evaluate(() => ({
    documentOverflow:
      document.documentElement.scrollWidth - window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  if (overflow.documentOverflow > 1) {
    const offenders = await page.evaluate((width) => {
      const found = [];
      for (const element of document.querySelectorAll("body *")) {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0) continue;
        if (rect.right > width + 1 || rect.left < -1) {
          found.push(
            `${element.tagName.toLowerCase()}[${element.getAttribute("data-kits-component") ?? element.className.toString().slice(0, 40)}] → ${Math.round(rect.left)}..${Math.round(rect.right)}`,
          );
        }
      }
      return found.slice(0, 8);
    }, viewport.width);
    problems.push(
      `${viewport.name} ${route.path}: 横向溢出 ${overflow.documentOverflow}px（scrollWidth ${overflow.scrollWidth} vs ${overflow.innerWidth}）→ ${offenders.join(" ; ")}`,
    );
  }

  /*
   * ---- 布局视口扩张（上面那条检查**看不见**的一类溢出 ----
   *
   * 这是一个真实踩到的盲点（v0.1.0 发布验证时发现）：
   *
   * 移动端上下文（isMobile: true）里，若内容宽于设备宽度，Chromium 会**扩大
   * 布局视口**去容纳它（于是页面被缩放显示，而不是出现横向滚动条）。
   * 结果是 `window.innerWidth` 从 390 变成 679，而
   * `scrollWidth - innerWidth` 恰好等于 0 —— 相对比较把问题抵消掉了。
   *
   * 实测案例：/audit 页的一张卡片里有约 130 字符的不含空格的 ASCII 长串，
   * 在 390px 下把内容撑到 666px，`innerWidth` 悄悄变成 679，
   * 上面那条检查一路绿灯，而页面在真机上是被缩小到看不清的。
   *
   * 修法：**绝对**比较 —— 布局视口必须等于请求的设备宽度。
   */
  if (Math.abs(overflow.innerWidth - viewport.width) > 1) {
    problems.push(
      `${viewport.name} ${route.path}: 布局视口被内容撑大 —— innerWidth ${overflow.innerWidth} ≠ 设备宽度 ${viewport.width}` +
        `（页面在真机上会被缩放，内容宽 ${overflow.scrollWidth}px）`,
    );
  }

  /*
   * ---- 第三条判据：真的滚一下 ----
   *
   * 前两条都是"量宽度"。它们仍然可能同时撒谎：一个 `position: fixed` 的
   * 元素或某个 `overflow-x: hidden` 的外壳，可以让 scrollWidth 读起来正好
   * 等于视口，而页面**仍然能横向滚动**。
   *
   * 真正无法伪造的判据是：把滚动位置推到极限，然后看它停在哪。
   * scrollTo(9999, 0) 之后 scrollX 仍然 ≈ 0，才说明横向根本滚不动。
   *
   * 这三条互不替代：
   *   1. innerWidth === 设备宽度      （布局视口没被撑大）
   *   2. scrollWidth <= 设备宽度      （内容没有超出）
   *   3. scrollTo 之后 scrollX ≈ 0    （确实滚不动）
   */
  const scrolled = await page.evaluate(() => {
    window.scrollTo(9999, 0);
    const x = window.scrollX;
    window.scrollTo(0, 0);
    return { scrollX: x, maxScroll: document.documentElement.scrollWidth - window.innerWidth };
  });
  if (Math.abs(scrolled.scrollX) > 1) {
    problems.push(
      `${viewport.name} ${route.path}: 推到最右后 scrollX=${Math.round(scrolled.scrollX)}（应当 ≈ 0）` +
        ` —— 页面真的能横向滚动，即使宽度比较看不出来`,
    );
  }

  if (consoleErrors.length) {
    problems.push(
      `${viewport.name} ${route.path}: 控制台报错 → ${consoleErrors.join(" | ")}`,
    );
  }
  if (pageErrors.length) {
    problems.push(
      `${viewport.name} ${route.path}: 页面异常 → ${pageErrors.join(" | ")}`,
    );
  }
  if (failedRequests.length) {
    problems.push(
      `${viewport.name} ${route.path}: 请求失败 → ${failedRequests.join(" | ")}`,
    );
  }

  const slug = route.path === "/" ? "home" : route.path.replace(/\//g, "");
  await page.screenshot({
    path: path.join(OUT, `${viewport.name}-${slug}-full.png`),
    fullPage: true,
  });
  await page.screenshot({
    path: path.join(OUT, `${viewport.name}-${slug}-top.png`),
    clip: { x: 0, y: 0, width: viewport.width, height: viewport.height },
  });

  const report = { overflow, consoleErrors, pageErrors, failedRequests };
  await context.close();
  return report;
}

/**
 * 降级验证：reduced-motion 下 InsightReveal 的内容必须可见。
 * 这是整套 Kits 里最容易做错的一条契约（隐藏是 CSS 默认、显示依赖 JS）。
 */
async function checkReducedMotion(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(600);

  const revealState = await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll('[data-kits-component="insight-reveal"]'),
    );
    return nodes.map((node) => {
      const first = node.firstElementChild;
      return {
        animated: node.classList.contains("kits-reveal--animated"),
        visible: node.getAttribute("data-kits-visible"),
        childOpacity: first ? getComputedStyle(first).opacity : null,
      };
    });
  });

  if (revealState.length < 3) {
    problems.push(
      `reduced-motion: InsightReveal 实例数 ${revealState.length}（应为 3）`,
    );
  }
  for (const state of revealState) {
    if (state.animated) {
      problems.push("reduced-motion: 仍带有 --animated 类（应当完全不启用动效）");
    }
    if (state.childOpacity !== "1") {
      problems.push(
        `reduced-motion: 揭示内容 opacity=${state.childOpacity}（应当可见）`,
      );
    }
  }

  // 指针动效必须关闭：三套 pack 的 --kits-pointer-factor 归零
  const factors = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-kits-pack]")).map((element) =>
      getComputedStyle(element).getPropertyValue("--kits-pointer-factor").trim(),
    ),
  );
  for (const factor of factors) {
    if (factor !== "0" && factor !== "") {
      problems.push(`reduced-motion: --kits-pointer-factor=${factor}（应为 0）`);
    }
  }

  await page.screenshot({
    path: path.join(OUT, "reduced-motion-home-top.png"),
    clip: { x: 0, y: 0, width: 1440, height: 900 },
  });
  await context.close();
  return { revealState, factors };
}

/* --------------------------------------------------------------------------
 * v0.1.1 新增的四组探针
 * ----------------------------------------------------------------------- */

/**
 * K-01 · 无障碍树探针。
 *
 * 这是整个 v0.1.1 里最需要"真的量一次"的一条：aria-hidden 造成的剪枝
 * 在单元测试里完全看不出来（DOM 里按钮明明在），只有无障碍树知道。
 *
 * 用 Playwright 的 role 查询来问浏览器：**这些内容还在无障碍树里吗？**
 * 单位测试断言的是"标记里没有 aria-hidden"，那只是必要条件；
 * 这里断言的是结论。
 */
async function checkInsightRevealA11y(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/components`, { waitUntil: "load" });

  // 让揭示跑完（否则停在起手态，量到的是动画中间值）
  const stages = page.locator("[data-kits-pack]");
  const stageCount = await stages.count();
  for (let index = 0; index < stageCount; index += 1) {
    await stages.nth(index).scrollIntoViewIfNeeded();
    await page.waitForTimeout(140);
  }
  await page.waitForTimeout(800);

  const reveals = page.locator('[data-kits-component="insight-reveal"]');
  const revealCount = await reveals.count();
  if (revealCount === 0) {
    problems.push("a11y: /components 上没有 InsightReveal 实例");
    await context.close();
    return { revealCount, perReveal: [] };
  }

  const perReveal = [];
  for (let index = 0; index < revealCount; index += 1) {
    const reveal = reveals.nth(index);
    const buttons = await reveal.getByRole("button").count();
    const headings = await reveal.getByRole("heading").count();
    const links = await reveal.getByRole("link").count();
    const listitems = await reveal.getByRole("listitem").count();
    const domButtons = await reveal.locator("button").count();
    const domHeadings = await reveal.locator("h1,h2,h3,h4,h5,h6").count();
    const domLinks = await reveal.locator("a[href]").count();

    perReveal.push({
      buttons,
      headings,
      links,
      listitems,
      domButtons,
      domHeadings,
      domLinks,
    });

    /*
     * 判据不是"数量大于零"这么弱，而是**无障碍树与 DOM 一致**：
     * DOM 里有的可交互元素，必须都能被 role 查到。
     * aria-hidden 剪枝会让右边的数字变成 0，而左边照常有值。
     */
    if (domButtons > 0 && buttons !== domButtons) {
      problems.push(
        `a11y: InsightReveal#${index} 的 button 在 DOM 里有 ${domButtons} 个，但无障碍树里只有 ${buttons} 个`,
      );
    }
    if (domHeadings > 0 && headings !== domHeadings) {
      problems.push(
        `a11y: InsightReveal#${index} 的 heading 在 DOM 里有 ${domHeadings} 个，但无障碍树里只有 ${headings} 个`,
      );
    }
    if (domLinks > 0 && links !== domLinks) {
      problems.push(
        `a11y: InsightReveal#${index} 的 link 在 DOM 里有 ${domLinks} 个，但无障碍树里只有 ${links} 个`,
      );
    }
  }

  // 宿主自身不得带 aria-hidden
  const hiddenHosts = await page.locator(".kits-reveal__item[aria-hidden]").count();
  if (hiddenHosts > 0) {
    problems.push(`a11y: 有 ${hiddenHosts} 个揭示宿主带 aria-hidden（会剪掉整棵子树）`);
  }
  const presentationHosts = await page
    .locator('.kits-reveal__item[role="presentation"]')
    .count();
  if (presentationHosts === 0) {
    problems.push('a11y: 揭示宿主没有 role="presentation"');
  }

  await context.close();
  return { revealCount, perReveal, hiddenHosts, presentationHosts };
}

/**
 * K-02 · coarse pointer 探针。
 *
 * 直接量**有效单元格尺寸**，而不是读 CSS 文本。
 * 触发条件用真实设备特征（hasTouch + isMobile），不是伪造的 media query。
 */
async function checkCoarsePointer(browser) {
  const measure = async (context) => {
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForTimeout(400);
    const result = await page.evaluate(() => {
      const out = {};
      for (const pack of ["editorial", "cinematic", "instrument"]) {
        const grid = document.querySelector(`[data-kits-pack="${pack}"] .kits-grid`);
        if (!grid) continue;
        const cs = (p) => getComputedStyle(grid).getPropertyValue(p).trim();

        /*
         * 量"用出来的长度"，不量自定义属性的文本 ——
         * 自定义属性的计算值会停在 `calc(64px * 1.5)`，那既不是 px 也不能直接比较。
         *
         * 两个细节都是踩过的坑：
         *   1. 用 offsetWidth 而不是 getBoundingClientRect().width ——
         *      后者含 transform，而 drift 动画把网格 scale(1.02) 过，
         *      会把 64px 量成 65.28px。
         *   2. 把密度钉成 1 —— 密度是组件贡献的乘数（playground 的样例用了
         *      wide = ×2），不归一化就量不到"基准 × 指针因子"这个契约行为。
         */
        grid.style.setProperty("--kits-grid-density", "1");
        let probe = grid.querySelector(".qa-cell-probe");
        if (!probe) {
          probe = document.createElement("i");
          probe.className = "qa-cell-probe";
          probe.style.width = "var(--kits-grid-cell-size)";
          probe.style.display = "block";
          grid.appendChild(probe);
        }
        out[pack] = {
          base: cs("--kits-grid-cell"),
          scale: cs("--kits-grid-cell-scale"),
          effectivePx: probe.offsetWidth,
          animationName: getComputedStyle(grid).animationName,
        };
        grid.style.removeProperty("--kits-grid-density");
      }
      return {
        coarse: matchMedia("(pointer: coarse)").matches,
        hoverNone: matchMedia("(hover: none)").matches,
        packs: out,
      };
    });
    await context.close();
    return result;
  };

  const fineContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const fine = await measure(fineContext);

  const coarseContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const coarse = await measure(coarseContext);

  if (!coarse.coarse || !coarse.hoverNone) {
    problems.push(
      `coarse-pointer: 设备特征没生效（pointer:coarse=${coarse.coarse} hover:none=${coarse.hoverNone}）`,
    );
  }

  for (const pack of ["editorial", "cinematic", "instrument"]) {
    const f = fine.packs[pack];
    const c = coarse.packs[pack];
    if (!f || !c) {
      problems.push(`coarse-pointer: ${pack} 列里没有 .kits-grid`);
      continue;
    }
    if (f.scale !== "1") {
      problems.push(`coarse-pointer: 细指针下 ${pack} 的因子是 ${f.scale}（应为 1）`);
    }
    if (c.scale !== "1.5") {
      problems.push(`coarse-pointer: 触屏下 ${pack} 的因子是 ${c.scale}（应为 1.5）`);
    }
    if (c.effectivePx !== Math.round(f.effectivePx * 1.5)) {
      problems.push(
        `coarse-pointer: ${pack} 的有效单元格 ${c.effectivePx}px ≠ 细指针 ${f.effectivePx}px × 1.5`,
      );
    }
    /*
     * 动效降级：只比较"细指针下本来有动画"的那些。
     * playground 的样例里有的 pack 用 motion="none"（那是 pack 语义，不是缺陷），
     * 所以不能断言"细指针下必须有动画"。
     */
    if (f.animationName !== "none" && c.animationName !== "none") {
      problems.push(
        `coarse-pointer: ${pack} 的网格动画在触屏下仍然开着（${c.animationName}）`,
      );
    }
  }

  if (coarse.packs.cinematic?.effectivePx !== 96) {
    problems.push(
      `coarse-pointer: cinematic 的有效单元格是 ${coarse.packs.cinematic?.effectivePx}px（应为 96 = 64 × 1.5）`,
    );
  }
  if (fine.packs.cinematic?.effectivePx !== 64) {
    problems.push(
      `coarse-pointer: 细指针下 cinematic 的有效单元格是 ${fine.packs.cinematic?.effectivePx}px（应为 64）`,
    );
  }

  return { fine, coarse };
}

/**
 * K-05 · Effect 覆盖探针。
 *
 * 判据：在**祖先作用域**里改公开变量，效果的绘制结果真的跟着变。
 * 如果默认值声明在效果自己的类上（而不是 :root），祖先覆盖会被
 * 元素自身的声明压过去 —— 那正是要防的回归。
 */
async function checkEffectOverride(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/effects`, { waitUntil: "load" });
  await page.waitForTimeout(400);

  const result = await page.evaluate(() => {
    const stage = document.querySelector("[data-effect-stage]");
    if (!stage) return null;
    const read = () => {
      const before = getComputedStyle(stage, "::before");
      return {
        opacity: before.opacity,
        backgroundImage: before.backgroundImage,
        strength: getComputedStyle(stage).getPropertyValue("--kits-effect-ambient-strength").trim(),
        primary: getComputedStyle(stage).getPropertyValue("--kits-effect-ambient-primary").trim(),
      };
    };

    const base = read();

    // 在**祖先**上覆盖（不是效果自己的类）—— 这是 K-05 的关键判据
    const scope = stage.parentElement ?? document.documentElement;
    scope.style.setProperty("--kits-effect-ambient-strength", "0.25");
    scope.style.setProperty("--kits-effect-ambient-primary", "rgb(255 0 0 / 0.9)");
    const overridden = read();

    scope.style.removeProperty("--kits-effect-ambient-strength");
    scope.style.removeProperty("--kits-effect-ambient-primary");
    const restored = read();

    return { base, overridden, restored };
  });

  if (!result) {
    problems.push("effect: /effects 上找不到 [data-effect-stage]");
    await context.close();
    return null;
  }

  if (result.base.opacity !== "1") {
    problems.push(`effect: 默认强度下 ::before 的 opacity 是 ${result.base.opacity}（应为 1）`);
  }
  if (result.overridden.opacity !== "0.25") {
    problems.push(
      `effect: 祖先覆盖强度后 opacity 是 ${result.overridden.opacity}（应为 0.25）—— 祖先覆盖不生效`,
    );
  }
  if (!result.overridden.backgroundImage.includes("255, 0, 0")) {
    problems.push("effect: 祖先覆盖主光颜色后 background-image 没有变化");
  }
  if (result.restored.opacity !== "1") {
    problems.push(`effect: 移除覆盖后没有回到默认值（opacity=${result.restored.opacity}）`);
  }

  await context.close();
  return result;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  /*
   * server 由本次运行自己起、自己停、并**验身份**（`.qa/qa-server.mjs`）。
   *
   * 不复用任何已存在的 server：就绪探针只判断「有东西应答」，不判断「是不是这个
   * 应用」。同机跑着多个原型，一旦复用命中别的 server，下面全套断言会在**错误的
   * 页面**上变绿而且不报错。端口被占用时 fail loudly —— 不 adopt、不猜、不替人杀进程。
   */
  const run = await withQaServer(async (origin, info) => {
    BASE = origin;
    const browser = await chromium.launch();
    const report = { base: BASE, mode: info.mode, routes: {}, reducedMotion: null };
    try {
      for (const viewport of VIEWPORTS) {
        for (const route of ROUTES) {
          const key = `${viewport.name} ${route.path}`;
          report.routes[key] = await checkRoute(browser, route, viewport);
        }
      }

      report.reducedMotion = await checkReducedMotion(browser);
      report.a11y = await checkInsightRevealA11y(browser);
      report.coarsePointer = await checkCoarsePointer(browser);
      report.effectOverride = await checkEffectOverride(browser);
    } finally {
      await browser.close();
    }
    return report;
  });

  const report = run.result;
  await writeFile(
    path.join(OUT, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  if (problems.length) {
    console.error("\nQA 发现问题：");
    for (const problem of problems) console.error(`  ✗ ${problem}`);
    process.exit(1);
  }
  console.log(
    `\nQA OK —— mode ${run.mode} · origin ${run.origin}（身份检查已通过）\n` +
      `  ${ROUTES.length} 个路由 × ${VIEWPORTS.length} 个视口：无控制台报错 / 无页面异常 / 无横向溢出（三条判据）；` +
      "三套 pack 计算样式确有差异；reduced-motion 降级正确；" +
      "InsightReveal 无障碍树与 DOM 一致；coarse pointer 因子生效（64 → 96px）；" +
      "effect 公开变量可在祖先作用域覆盖",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
