import { chromium } from "@playwright/test";

/**
 * QA · 步进链路的活体检查。
 *
 *   node .qa/reveal-probe.mjs          (需要 Playground 已在 3200 起服务)
 *
 * 为什么需要它 —— 一个只有浏览器能量出来的 bug：
 *
 * `InsightReveal` 的 `step="group"` 靠三跳把"顺序"变成"延迟"：
 *
 *   JS 序号  →  --kits-reveal-index  →  transition-delay
 *   (React)      (写在宿主元素上)        (CSS: 序号 × pack 的 stagger)
 *
 * 旧实现在第一跳就断了：序号写在**子元素**的 style 上，而产品的子元素
 * 是自定义组件、不转发 style，于是变量被静默丢弃。
 * 不报错、不警告、DOM 里什么痕迹都没有 —— 只有量 computed style 才能发现。
 *
 * 静态审计（vitest 的 insight-reveal-group.spec.ts）覆盖了第一跳与第二跳；
 * 这里补上第三跳：**浏览器实际算出来的 transition-delay 是否递增**。
 */

const BASE = process.env.KITS_BASE ?? "http://localhost:3200";
const ROUTES = ["/components", "/"];

const browser = await chromium.launch();
const problems = [];

for (const route of ROUTES) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });

  const reveals = page.locator("[data-kits-component='insight-reveal']");
  const count = await reveals.count();

  if (count === 0) {
    problems.push(`${route}：没有找到 InsightReveal 实例（样张是否还在？）`);
    await context.close();
    continue;
  }

  for (let i = 0; i < count; i += 1) {
    const element = reveals.nth(i);
    await element.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);

    const probe = await element.evaluate((root) => {
      const hosts = [...root.querySelectorAll("[data-kits-reveal-item]")];
      const step = root.getAttribute("data-kits-step");
      return {
        step,
        visible: root.getAttribute("data-kits-visible"),
        hostCount: hosts.length,
        rows: hosts.map((host) => {
          const child = host.firstElementChild ?? host;
          const style = getComputedStyle(child);
          return {
            index: host.style.getPropertyValue("--kits-reveal-index"),
            delay: style.transitionDelay,
            display: getComputedStyle(host).display,
          };
        }),
      };
    });

    if (probe.step !== "group") continue;

    // ① 每个直接子元素都必须有宿主
    const directChildren = await element.evaluate((root) => root.children.length);
    if (probe.hostCount !== directChildren) {
      problems.push(
        `${route} [${i}]：宿主数量 ${probe.hostCount} ≠ 直接子元素 ${directChildren}`,
      );
    }

    // ② 序号必须真的存在
    const missingIndex = probe.rows.filter((r) => r.index === "").length;
    if (missingIndex > 0) {
      problems.push(`${route} [${i}]：${missingIndex} 个宿主没有 --kits-reveal-index`);
    }

    // ③ 宿主必须对布局不可见（否则会改变产品的间距/列数）
    const wrongDisplay = probe.rows.filter((r) => r.display !== "contents").length;
    if (wrongDisplay > 0) {
      problems.push(`${route} [${i}]：${wrongDisplay} 个宿主的 display 不是 contents`);
    }

    // ④ 第三跳：transition-delay 必须随序号递增，否则步进等于没装
    const delays = probe.rows
      .map((r) => r.delay)
      .map((d) => (d.includes(",") ? d.split(",")[0].trim() : d))
      .map((d) => (d.endsWith("ms") ? Number.parseFloat(d) : Number.parseFloat(d) * 1000));
    const strictlyIncreasing = delays.every(
      (value, index) => index === 0 || value > delays[index - 1],
    );
    if (!strictlyIncreasing) {
      problems.push(
        `${route} [${i}]：transition-delay 没有随序号递增 → [${probe.rows
          .map((r) => `${r.index}→${r.delay}`)
          .join(", ")}]`,
      );
    }
  }

  await context.close();
}

await browser.close();

if (problems.length) {
  console.log("步进链路有问题：");
  for (const problem of problems) console.log(`  ✗ ${problem}`);
  process.exit(1);
}
console.log(
  "步进链路 OK —— 宿主存在 · 序号落到 DOM · display:contents 不破坏布局 · transition-delay 随序号递增",
);
