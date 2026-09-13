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
 *   node .qa/kits-shots.mjs                 # 默认打生产预览 http://localhost:3200
 *   KITS_BASE=http://localhost:3000 node .qa/kits-shots.mjs
 *
 * 截图落在 .qa/out/（已在 .gitignore 中忽略），末尾打印 QA OK 或问题清单。
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.KITS_BASE ?? "http://localhost:3200";
const OUT = path.join(process.cwd(), ".qa", "out");

const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1440, height: 900, isMobile: false },
  { name: "mobile-390x844", width: 390, height: 844, isMobile: true },
];

const ROUTES = [
  { name: "home", path: "/", expect: ["Style Packs"] },
  { name: "components", path: "/components", expect: ["Signature Components"] },
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

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report = { base: BASE, routes: {}, reducedMotion: null };

  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      const key = `${viewport.name} ${route.path}`;
      report.routes[key] = await checkRoute(browser, route, viewport);
    }
  }

  report.reducedMotion = await checkReducedMotion(browser);
  await browser.close();

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
    "\nQA OK —— 3 个路由 × 2 个视口：无控制台报错 / 无页面异常 / 无横向溢出；三套 pack 计算样式确有差异；reduced-motion 下降级正确",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
