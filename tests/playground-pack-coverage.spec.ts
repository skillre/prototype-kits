/**
 * Playground 的 pack 覆盖 —— 静态门禁。
 *
 * ===========================================================================
 * 这组测试的存在理由
 * ===========================================================================
 * `registry/assets.json` 是「有哪些 Style Pack」的唯一权威，Playground 只是它的
 * 一个视图。视图会过期，而且**过期的方式很难被现有的门禁看见**：
 *
 *   K1 新增了第四套 pack `console`，registry 里它状态是 approved，
 *   而 Playground 的并排舞台是按三列写死的 —— 于是 `console` 在**它自己的仓里
 *   从来没有上过屏**，`pnpm lint / typecheck / test / build` 全绿，
 *   `pnpm qa` 也全绿（因为它扫的仍然是写死的那三套）。
 *   缺口不在"没人检查"，而在"检查的名单和权威的名单不是同一份"。
 *
 * 所以这里把「registry → 视图」这条链路的每一环钉住：
 *   ① 名单：视图与 QA 的 pack 名单都从 registry 派生，不许写死；
 *   ② 接线：每一套 pack 的 CSS 与包依赖都真的接上了（漏了不报错，但会静默退化成兜底样式）；
 *   ③ 人工说明：每套 pack 都有一句人写的性格描述（这是唯一需要人补的一件事，
 *      所以必须由门禁逼着补，而不是靠记得）；
 *   ④ 网格：列数不再写死套数（否则第五套 pack 会重演同一个问题）。
 *
 * 与仓里其它 `tests/**` 一样，这全是**静态审计**（读文件、解析 JSON，不起服务）。
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");

const readText = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

type RegistryAsset = {
  id: string;
  type: string;
  status: string;
  cssEntry?: string;
  entry?: string;
  path?: string;
};

const registry = JSON.parse(readText("registry/assets.json")) as {
  assets: RegistryAsset[];
};

/** 权威名单：registry 里已批准的 style 资产，保持登记顺序。 */
const APPROVED_PACKS = registry.assets.filter(
  (asset) => asset.type === "style" && asset.status === "approved",
);

const PACK_STAGE = "playground/components/pack-stage.tsx";
const REGISTRY_VIEW = "playground/components/registry-view.ts";
const HOME = "playground/app/page.tsx";
const COMPONENTS_PAGE = "playground/app/components/page.tsx";
const GLOBALS_CSS = "playground/app/globals.css";
const PLAYGROUND_PKG = "playground/package.json";
const QA_SCRIPT = ".qa/kits-shots.mjs";

/** 旧写法：任何一处再出现这个字面量三元组，就是在把「三套」重新钉回代码里。 */
const HARDCODED_TRIPLE = /\[\s*"editorial"\s*,\s*"cinematic"\s*,\s*"instrument"\s*\]/;

/** `@kits/style-console/tokens.css` → `@kits/style-console` */
const packageOf = (asset: RegistryAsset) => {
  const cssEntry = asset.cssEntry ?? "";
  return cssEntry.split("/").slice(0, 2).join("/");
};

/**
 * 去掉注释再断言：本仓的注释会**解释历史**（例如"这里曾经写死三列"），
 * 直接对全文 grep 会把解释本身当成违规。断言的对象是规则，不是散文。
 */
const stripCssComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "");

describe("Playground 覆盖 registry 里的每一套已批准 pack", () => {
  it("前置：registry 的名单非空（空名单会让下面每一条空跑成绿）", () => {
    expect(APPROVED_PACKS.length).toBeGreaterThan(1);
    for (const asset of APPROVED_PACKS) {
      expect(packageOf(asset), `${asset.id} 缺少 cssEntry`).toMatch(/^@kits\//);
    }
  });

  it("名单来自 registry：视图、并排舞台与 QA 都不写死 pack 三元组", () => {
    const registryView = readText(REGISTRY_VIEW);
    expect(registryView).toContain("registry/assets.json");

    for (const file of [PACK_STAGE, REGISTRY_VIEW, HOME, COMPONENTS_PAGE, QA_SCRIPT]) {
      const source = readText(file);
      expect(HARDCODED_TRIPLE.test(source), `${file} 里还有写死的三套 pack 名单`).toBe(
        false,
      );
    }

    // QA 的扫描名单必须来自 registry —— 否则「扫了几套」这件事本身就是过期信息。
    expect(readText(QA_SCRIPT)).toMatch(/registry\/assets\.json/);
  });

  it("CSS 接线：每一套 approved pack 的 tokens.css 都在 globals.css 里被导入", () => {
    const css = readText(GLOBALS_CSS);
    for (const asset of APPROVED_PACKS) {
      expect(
        css.includes(`@import "${asset.cssEntry}";`),
        `globals.css 少了 @import "${asset.cssEntry}" —— ${asset.id} 的舞台会退回契约兜底样式`,
      ).toBe(true);
    }
  });

  it("包依赖接线：每一套 approved pack 都在 playground 的 dependencies 里", () => {
    const pkg = JSON.parse(readText(PLAYGROUND_PKG)) as {
      dependencies: Record<string, string>;
    };
    for (const asset of APPROVED_PACKS) {
      const name = packageOf(asset);
      expect(
        Object.hasOwn(pkg.dependencies, name),
        `playground/package.json 缺少依赖 ${name}`,
      ).toBe(true);
    }
  });

  it("运行时接线：每一套 approved pack 都在 registry-view 的 PACK_RUNTIME 里有席位", () => {
    const source = readText(REGISTRY_VIEW);
    for (const asset of APPROVED_PACKS) {
      expect(
        new RegExp(`\\b${asset.id}\\s*:\\s*\\{`).test(source),
        `registry-view.ts 的 PACK_RUNTIME 里没有 ${asset.id} —— 视图接不上这套 pack`,
      ).toBe(true);
    }
  });

  it("人工说明：每一套 approved pack 都有一句人写的性格描述（这一条只有人能补）", () => {
    const source = readText(PACK_STAGE);
    for (const asset of APPROVED_PACKS) {
      expect(
        new RegExp(`\\b${asset.id}\\s*:\\s*"`).test(source),
        `pack-stage.tsx 的 PACK_SUMMARY 里没有 ${asset.id} 的说明 —— ` +
          "新增 pack 时这一句必须由人补（registry 回答「有哪些」，不回答「它是什么性格」）",
      ).toBe(true);
    }
  });

  it("并排舞台：两处舞台都按 pack 列表渲染，且不留写死的 pack 字面量", () => {
    for (const file of [HOME, COMPONENTS_PAGE]) {
      const source = readText(file);
      expect(source, `${file} 没有用 pack 列表渲染`).toContain(".map(");
      expect(
        /pack="(editorial|cinematic|instrument|console)"/.test(source),
        `${file} 里还有写死的 pack="<id>"`,
      ).toBe(false);
    }
  });

  it("网格列数不再写死套数，且窄屏断点的语义保持（1200 → 2 列、860 → 1 列）", () => {
    const css = stripCssComments(readText(GLOBALS_CSS));
    expect(css).not.toContain(".pg-grid--3");
    expect(css).toMatch(
      /\.pg-grid--packs\s*\{[^}]*repeat\(auto-fit,\s*minmax\(/,
    );

    const narrow = css.slice(css.indexOf("@media (max-width: 1200px)"));
    expect(narrow.slice(0, 200)).toMatch(
      /\.pg-grid--packs\s*\{[^}]*repeat\(2,/,
    );

    const mobile = css.slice(css.indexOf("@media (max-width: 860px)"));
    expect(mobile.slice(0, 240)).toMatch(
      /\.pg-grid--packs[^{]*\{[^}]*minmax\(0,\s*1fr\)/,
    );
  });

  it("QA 有一条能证明「每一套 pack 都上了屏」的断言（不能只数列数）", () => {
    const qa = readText(QA_SCRIPT);
    // 断言对象必须是每套 pack 自己声明的 canvas 色，而不是"列数等于某个常量"。
    expect(qa).toContain("--kits-color-canvas");
    expect(qa).toMatch(/DECLARED_CANVAS/);
    expect(qa).toMatch(/data-pack-column/);
    // 且 per-pack 断言必须在 pack 列表上跑，而不是在某套 pack 上点名。
    expect(qa).toMatch(/for \(const pack of PACKS\)/);
  });
});
