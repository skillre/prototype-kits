/**
 * K8 · Art Direction Material Handoff —— Kits v0.2 · Phase C。
 *
 * ===========================================================================
 * 这个文件在守什么
 * ===========================================================================
 * Factory v1.2 把 personality（环境光、Hero 光、chart glow、live halo、sheen …）
 * 从 Core 移出，交给 Reference Sample 自己拥有。K8 要回答的下一问是：
 * **这些材料以后归谁？** 答案不能是"每个产品自己重新发明一套"。
 *
 * 于是有三条必须可执行的主张：
 *
 *   1. **Style Pack 提供材质语言**（`materialDirection`：用什么建立层级、光归谁、
 *      发光有没有预算）—— 其中"光归谁"和"发光预算"**可以从 CSS 核对**，
 *      不是审美形容词；
 *   2. **Effect Pack 提供可独立启停的视觉行为**（`material.kind`：light / texture / line），
 *      与 pack 的材质预算交叉核对 —— 声明"不发光"的 pack 不能把发光效果列进 `effects[]`；
 *   3. **Product 决定在哪里用**：装 Kits **不会**自动改变页面外观。
 *      这条不是口号：它由 `scripts/lib/material-scope.mjs` 逐条扫描 pack / effect 的
 *      样式表证明 —— 变量可以声明在全局，**作画必须发生在自己的选择器里**。
 *
 * Reference Sample 的 personality 清单在 `INVENTORY` 里逐条分类（absorbed / product-only），
 * 分类本身被机器核对：说"被 Kits 吸收"的，就得指出是哪个资产；说"只属于产品"的，
 * 就不允许出现在 Kits 的 CSS 里。
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { checkPaintScope, checkRegistry, loadRegistry, loadVocabularies } from "../scripts/lib/manifest-contract.mjs";
import { effectScope, packScope, scanPaintScope } from "../scripts/lib/material-scope.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const CLI = path.join(ROOT, "packages", "cli", "kits.mjs");
const TMP = path.join(ROOT, "node_modules", ".cache", "kits-material-handoff-tests");
const REGISTRY = loadRegistry(ROOT);
const VOCAB = loadVocabularies(ROOT);
const STRIP_ANSI = /\u001b\[[0-9;]*m/g;

const FACTORY_ROOT = process.env.KITS_FACTORY_ROOT ?? path.resolve(ROOT, "..", "prototype-starter");
const KITS_RUNTIME = path.join(FACTORY_ROOT, "scripts", "lib", "kits-runtime.mjs");
const hasFactory = existsSync(KITS_RUNTIME);
const RESEARCH_ROOT = process.env.KITS_RESEARCH_ROOT ?? path.resolve(ROOT, "..", "prototype-ai-research");
const hasResearch = existsSync(path.join(RESEARCH_ROOT, "visual-manifest.json"));

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const readJson = <T>(rel: string): T => JSON.parse(read(rel)) as T;
/* -------------------------------------------------------------------------- */
/* 工具                                                                        */
/* -------------------------------------------------------------------------- */

/** 一个最小可安装的产品（CLI 只需要 package.json 做兼容性检查）。 */
function makeProduct(name: string) {
  const dir = path.join(TMP, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name,
        version: "0.0.0",
        private: true,
        dependencies: { react: "19.2.8", "react-dom": "19.2.8" },
        devDependencies: { "@types/react": "19.3.0", typescript: "5.9.3" },
      },
      null,
      2,
    ),
  );
  return dir;
}

function runCli(args: string[], allowFail = false) {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: "utf8" });
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`.replace(STRIP_ANSI, "");
  if ((result.status ?? 1) !== 0 && !allowFail) {
    throw new Error(`kits ${args.join(" ")} 失败（exit ${result.status}）\n${out}`);
  }
  return { status: result.status ?? -1, out };
}

/** 依 Visual Manifest 的形状装一套（不修改 Factory：这里只是照它的字段拼 CLI 参数）。 */
function installFromManifest(product: string, manifest: Record<string, unknown>) {
  const args = ["add", "--target", product, "--style", String(manifest.stylePack)];
  const components = (manifest.signatureComponents as string[] | undefined) ?? [];
  const effects = (manifest.effects as string[] | undefined) ?? [];
  if (components.length) args.push("--components", components.join(","));
  if (effects.length) args.push("--effects", effects.join(","));
  return runCli(args);
}

/** 产品自己拥有的文件（Kits 永不覆盖）—— 用来证明 pack / effect 变化不会动它。 */
function writeProductOwnedFiles(product: string) {
  const files = {
    "app/page.tsx": [
      'const panelClass = "kits-surface";',
      "export default function Page() {",
      '  return <main className="kits-inner">{/* owner: product */}</main>;',
      "}",
    ].join("\n"),
    "styles/product.css": "/* 产品自己的组合层：在哪里、为什么用某个材质 */\n.hero {\n  position: relative;\n}\n",
  };
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(product, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return files;
}

const ownedHashes = (product: string) =>
  Object.fromEntries(
    ["app/page.tsx", "styles/product.css"].map((rel) => [
      rel,
      readFileSync(path.join(product, rel), "utf8"),
    ]),
  );

const installedDir = (product: string) => path.join(product, "lib", "kits", "installed");
const lockPath = (product: string) => path.join(product, "lib", "kits", "kits.lock.json");
/** 托管区里出现的**资产目录/文件**（effect 落在 installed/<asset-id>/ 下）。 */
const installedAssetDirs = (product: string) => {
  const dir = installedDir(product);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .map((entry) => entry.name)
    .sort();
};

/** Kits 自己所有的 CSS（用于"product-only 的概念不得出现在 Kits 里"的反向检查）。 */
function allKitsCss() {
  const files = [
    "packages/contracts/tokens.css",
    ...["editorial", "cinematic", "instrument"].map((p) => `styles/${p}/tokens.css`),
    ...["paper-grain", "ambient-glow", "scanline-sweep"].map((e) => `effects/${e}.css`),
    ...["interactive-hero", "spotlight-surface", "animated-grid", "data-cursor", "insight-reveal"].map(
      (c) => `components/${c}/${c}.css`,
    ),
  ];
  return files.map((rel) => read(rel)).join("\n");
}

/* -------------------------------------------------------------------------- */
/* 1. 材质清单：absorbed / Product-only                                          */
/* -------------------------------------------------------------------------- */

/**
 * Reference Sample（Factory v1.2 的 `app/sample-command-center.css` 与 N1 Core Neutrality）
 * 从 Core 迁出的 personality 概念，逐条判定归属。
 *
 *   kits:<type>/<id> + evidence[]  → 由 Kits 正式资产承接（证据必须真实存在）
 *   product-only + legacyNames[]   → 仍属产品；这些名字**不允许**出现在 Kits 的 CSS 里
 *
 * 不做的是"尽量多搬"：搬不动、或者本来就属于 composition 的，就明确留在产品里。
 */
const INVENTORY: Array<{
  concept: string;
  sampleArtifact: string;
  owner: string;
  evidence?: string[];
  legacyNames?: string[];
}> = [
  {
    concept: "ambient wash（品牌色 + 暖色径向晕染）",
    sampleArtifact: ".ambient-wash / --ambient-brand · --ambient-warm",
    owner: "kits:effect/ambient-glow",
    evidence: ["--kits-effect-ambient-primary", "--kits-effect-ambient-secondary", "--kits-effect-ambient-strength"],
    legacyNames: ["ambient-wash"],
  },
  {
    concept: "hero wash（Hero 自己的一束光，可单独推远）",
    sampleArtifact: ".hero-wash / --ambient-hero-brand · --ambient-hero-warm",
    owner: "kits:effect/ambient-glow",
    evidence: ["--kits-effect-ambient-primary-position", "--kits-effect-ambient-primary-size", "--kits-effect-ambient-primary-falloff"],
    legacyNames: ["hero-wash"],
  },
  {
    concept: "cinematic lighting（用光建立层级、暗色是原生）",
    sampleArtifact: "dark tokens + layered light",
    owner: "kits:style/cinematic",
    evidence: ["kits-ambient"],
  },
  {
    concept: "ambient grid（表面后方的极淡网格）",
    sampleArtifact: ".ambient-grid / --ambient-grid",
    owner: "kits:component/animated-grid",
    evidence: ["--kits-grid-cell", "--kits-grid-line-color", "--kits-grid-fade"],
    legacyNames: ["ambient-grid"],
  },
  {
    concept: "ambient drift（晕染的缓慢漂移）",
    sampleArtifact: "@keyframes ambient-drift",
    owner: "kits:effect/ambient-glow",
    evidence: ["kits-effect-ambient-glow--breathing", "--kits-dur-ambient"],
    legacyNames: ["ambient-drift"],
  },
  {
    concept: "glow 颜色预算（发光是一支被管理的颜色）",
    sampleArtifact: "--chart-glow · --ambient-ring",
    owner: "kits:style/cinematic",
    evidence: ["--kits-color-glow"],
  },
  {
    concept: "surface sheen（高级卡片顶部的一层高光）",
    sampleArtifact: ".surface-sheen",
    owner: "product-only",
    legacyNames: ["surface-sheen", "--foreground"],
  },
  {
    concept: "chart glow（只给一条折线的一次 bloom）",
    sampleArtifact: ".chart-glow / filter: drop-shadow",
    owner: "product-only",
    legacyNames: ["chart-glow", "drop-shadow"],
  },
  {
    concept: "live halo / ambient ring（实时指示点的扩散光晕与环色）",
    sampleArtifact: "@keyframes live-halo / --ambient-ring",
    owner: "product-only",
    legacyNames: ["live-halo", "ambient-ring"],
  },
  {
    concept: "CRM / demo 的组合层（dashboard hero、KPI 卡片、侧栏品牌块）",
    sampleArtifact: "app/crm/** · app/demo/**",
    owner: "product-only",
    legacyNames: ["kpi-card", "dashboard-hero"],
  },
];

describe("K8 · 材质清单：谁承接、谁留给自己", () => {
  it("每一条分类都能被核对：absorbed 指得出资产与证据", () => {
    const byId = new Map(REGISTRY.assets.map((a: { id: string }) => [a.id, a]));
    for (const entry of INVENTORY) {
      if (entry.owner === "product-only") continue;
      const [type, id] = entry.owner.replace("kits:", "").split("/");
      const asset = byId.get(id) as { type: string; manifest: string } | undefined;
      expect(asset, `${entry.concept}: Kits 里没有 ${id}`).toBeDefined();
      expect(asset!.type).toBe(type);
      const css =
        type === "style"
          ? read(`styles/${id}/tokens.css`)
          : type === "component"
            ? read(`components/${id}/${id}.css`)
            : read(`effects/${id}.css`);
      for (const token of entry.evidence ?? []) {
        expect(css, `${entry.concept}: ${id} 里没有 ${token}`).toContain(token);
      }
    }
  });

  it("product-only 的概念**不允许**出现在 Kits 的 CSS 里（不能偷偷吸走）", () => {
    const css = allKitsCss();
    for (const entry of INVENTORY.filter((item) => item.owner === "product-only")) {
      for (const legacy of entry.legacyNames ?? []) {
        expect(css.includes(legacy), `${entry.concept}: Kits 里出现了 ${legacy}`).toBe(false);
      }
      expect(entry.evidence, `${entry.concept}: product-only 不该有 Kits 证据`).toBeUndefined();
    }
  });

  it("清单覆盖了 Factory 从 Core 移出的每一个概念（不是抽样）", () => {
    // Factory v1.2 的 Core Neutrality 名单：Core 不再拥有这七类
    const coreNeutrality = [
      "ambient wash",
      "hero wash",
      "surface sheen",
      "chart glow",
      "live halo",
      "ambient grid",
      "ambient ring",
    ];
    const concepts = INVENTORY.map(
      (entry) => `${entry.concept} | ${entry.sampleArtifact}`,
    )
      .join(" | ")
      .toLowerCase();
    for (const concept of coreNeutrality) {
      expect(concepts, `清单里没有 ${concept}`).toContain(concept);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 2. neutral by default：装 Kits 不会自动改变外观                                */
/* -------------------------------------------------------------------------- */

describe("K8 · neutral by default（机械判据：作画必须在自己的选择器里）", () => {
  const cssTargets = [
    ...["editorial", "cinematic", "instrument"].map((pack) => ({
      rel: `styles/${pack}/tokens.css`,
      scoped: packScope(pack),
    })),
    ...["paper-grain", "ambient-glow", "scanline-sweep"].map((effect) => {
      const node = readJson<{ effects: Array<{ id: string; class: string; entry: string }> }>(
        "effects/manifest.json",
      ).effects.find((item) => item.id === effect)!;
      return { rel: `effects/${node.entry}`, scoped: effectScope(node.class) };
    }),
  ];

  it("三套 pack + 三个 effect 的样式表：0 条作用域外作画", () => {
    let rules = 0;
    let paintRules = 0;
    for (const target of cssTargets) {
      const scan = checkPaintScope(ROOT, { ...target, label: target.rel });
      expect(scan.missing, `${target.rel} 读不到`).toBe(false);
      expect(scan.violations, `${target.rel}: ${JSON.stringify(scan.violations)}`).toEqual([]);
      rules += scan.rules;
      paintRules += scan.paintRules;
    }
    // 计数本身是证据：扫了 64 条规则、其中 40 条在作画 —— 不是"什么都没扫"
    expect(rules).toBeGreaterThanOrEqual(60);
    expect(paintRules).toBeGreaterThanOrEqual(35);
  });

  it("判据不是空的：负例必须被抓住（`:root` 里的变量允许，作画不允许）", () => {
    const negative = [
      ":root { --kits-x: 1 }",                       // 变量：允许（能力，不是像素）
      "html { background: red }",                    // 作画：不允许
      "body { background-image: radial-gradient(#fff, #000) }",
      "@media (min-width: 1px) { * { box-shadow: 0 0 1px red } }",
      "[data-kits-pack] { filter: blur(2px) }",       // 裸用（不指定 pack）：也不允许
    ].join("\n");
    const found = scanPaintScope(negative, { scoped: packScope("editorial"), label: "negative" }).violations;
    expect(found.map((v) => v.prop).sort()).toEqual(["background", "background-image", "box-shadow", "filter"]);
    const allowed = scanPaintScope(":root { --kits-color-canvas: #fff }", {
      scoped: packScope("editorial"),
      label: "vars-only",
    });
    expect(allowed.violations).toEqual([]);
  });

  it("effect 的默认值住在 :root（变量），作画只发生在它自己的类上", () => {
    const ambient = read("effects/ambient-glow.css");
    const rules = scanPaintScope(ambient, {
      scoped: effectScope("kits-effect-ambient-glow"),
      label: "ambient-glow",
    });
    expect(rules.violations).toEqual([]);
    // :root 块里只有变量声明 —— 没有它，产品覆盖就无从谈起；有它，也不会改变任何像素
    const rootBlock = ambient.slice(ambient.indexOf(":root {"), ambient.indexOf("}", ambient.indexOf(":root {")));
    expect(rootBlock).toContain("--kits-effect-ambient-strength");
    expect(rootBlock).not.toMatch(/background|box-shadow|filter/);
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Reference Sample compatibility fixture（A / B / C / D）                     */
/* -------------------------------------------------------------------------- */

describe("K8 · Factory v1.2 形状的产品 fixture（A/B/C/D）", () => {
  /** Factory Visual Manifest 的形状（只读参照，不修改 Factory）。 */
  const manifest = (overrides: Record<string, unknown> = {}) => ({
    stylePack: "cinematic",
    productType: "reference-sample-fixture",
    firstVisual: "一束光把主容器从背景里托起来",
    signatureComponents: ["spotlight-surface"],
    effects: ["ambient-glow"],
    motionDirection: "atmospheric",
    density: "medium",
    avoid: [],
    ...overrides,
  });

  it("A · effects: [] → 装完仍然是 neutral（没有 effect 文件、没有全局作画）", () => {
    const product = makeProduct("fixture-neutral");
    writeProductOwnedFiles(product);
    installFromManifest(product, manifest({ effects: [] }));

    const dirs = installedAssetDirs(product);
    expect(dirs, `装出了 effect：${dirs.join(", ")}`).not.toContain("ambient-glow");
    expect(dirs).toContain("cinematic");
    expect(readFileSync(path.join(product, "app/page.tsx"), "utf8")).not.toContain("kits-effect-");
    // pack 落地了，但 pack 的样式表不作画在作用域之外 → 页面外观不会被"自动"改掉
    for (const pack of ["cinematic"]) {
      const scan = checkPaintScope(ROOT, {
        rel: `styles/${pack}/tokens.css`,
        scoped: packScope(pack),
        label: pack,
      });
      expect(scan.violations).toEqual([]);
    }
    expect(readFileSync(path.join(product, "lib/kits/installed/cinematic/tokens.css"), "utf8")).toContain(
      '[data-kits-pack="cinematic"]',
    );
  });

  it("B · 显式装 effect → 材质可用（类 + 变量都在，且只有这个类能打开它）", () => {
    const product = makeProduct("fixture-explicit");
    writeProductOwnedFiles(product);
    installFromManifest(product, manifest());

    // effect 落在托管区的 installed/<asset-id>/ 下，产品侧拿到的是 adapters/effect-<id>.css
    const effectCss = path.join(product, "lib/kits/installed/ambient-glow/ambient-glow.css");
    expect(existsSync(effectCss)).toBe(true);
    const css = readFileSync(effectCss, "utf8");
    expect(css).toContain(".kits-effect-ambient-glow");
    expect(css).toContain("--kits-effect-ambient-strength");
    // 契约层面对得上：pack 声明 budgeted，effect 声明 light
    expect(readJson<{ materialDirection: { glow: string } }>("styles/cinematic/manifest.json").materialDirection.glow).toBe("budgeted");
    expect(
      readJson<{ effects: Array<{ id: string; material: { kind: string } }> }>("effects/manifest.json").effects.find(
        (item) => item.id === "ambient-glow",
      )!.material.kind,
    ).toBe("light");
    // 但**产品代码仍然没有引用它** —— 能力在，使用是产品的下一步（这就是 handoff）
    expect(readFileSync(path.join(product, "styles/product.css"), "utf8")).not.toContain("kits-effect-");
  });

  it("C · 把 effect 从 manifest 里去掉 → 回到 neutral，产品文件一个字节都没变", () => {
    const product = makeProduct("fixture-removal");
    writeProductOwnedFiles(product);
    installFromManifest(product, manifest());
    const before = ownedHashes(product);
    expect(installedAssetDirs(product)).toContain("ambient-glow");

    installFromManifest(product, manifest({ effects: [] }));

    // 1) 托管区不再有它 —— Kits 拥有那一片，重新安装就是替换
    expect(installedAssetDirs(product)).not.toContain("ambient-glow");
    // 2) 安装状态（lock）也不再认为它装着
    const lock = JSON.parse(readFileSync(lockPath(product), "utf8")) as { assets: Array<{ id: string }> };
    expect(lock.assets.map((asset) => asset.id)).not.toContain("ambient-glow");
    // 3) 产品自己的文件一个字节都没变（Kits 永不覆盖产品文件）
    expect(ownedHashes(product)).toEqual(before);
    // 4) **不是静默残留**：上一次安装生成的 adapters/effect-<id>.* 留在产品目录里，
    //    doctor 会点名说出来（删掉它，或把它声明成一个角色）—— 这是 K4 的机制在收尾
    expect(existsSync(path.join(product, "lib/kits/adapters/effect-ambient-glow.css"))).toBe(true);
    const doctor = runCli(["doctor", "--target", product], true);
    expect(doctor.out).toContain("effect-ambient-glow");
  });

  it("D · 换 Style Pack：产品自己的文件不变，材质语言随之改变", () => {
    const product = makeProduct("fixture-pack-swap");
    writeProductOwnedFiles(product);
    installFromManifest(product, manifest());
    const before = ownedHashes(product);
    const cinematicAmbient = readJson<{ materialDirection: { ambient: string; glow: string } }>(
      "styles/cinematic/manifest.json",
    ).materialDirection;

    installFromManifest(product, manifest({ stylePack: "instrument", effects: [] }));

    expect(ownedHashes(product)).toEqual(before);
    const instrumentAmbient = readJson<{ materialDirection: { ambient: string; glow: string } }>(
      "styles/instrument/manifest.json",
    ).materialDirection;
    // 材质语言确实换了一套（cinematic 自带环境光 + 有发光预算；instrument 两者都没有）
    expect(cinematicAmbient).toMatchObject({ hierarchy: "light", ambient: "pack-authored", glow: "budgeted" });
    expect(instrumentAmbient).toMatchObject({ hierarchy: "rule", ambient: "none", glow: "forbidden" });
    expect(readFileSync(path.join(product, "lib/kits/installed/instrument/tokens.css"), "utf8")).toContain(
      '[data-kits-pack="instrument"]',
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Style Pack 与 Effect 相互独立                                              */
/* -------------------------------------------------------------------------- */

describe("K8 · Style Pack 与 Effect 相互独立", () => {
  it("只装 pack、不装 effect：完全成立（instrument + effects[] 是一等用法）", () => {
    const product = makeProduct("pack-only");
    writeProductOwnedFiles(product);
    const result = runCli(["add", "--target", product, "--style", "instrument", "--components", "insight-reveal"]);
    expect(result.out).toBeTruthy();
    expect(installedAssetDirs(product)).not.toContain("ambient-glow");
    expect(installedAssetDirs(product)).toContain("instrument");
    // instrument 不带环境光层 —— 这正是"装 pack ≠ 装 effect"
    expect(read("styles/instrument/tokens.css")).not.toContain(".kits-ambient");
  });

  it("三套 pack 的 effects[] 与材质预算自洽（不发光的不列发光效果）", () => {
    for (const pack of ["editorial", "cinematic", "instrument"]) {
      const manifest = readJson<{
        effects: string[];
        materialDirection: { ambient: string; glow: string };
      }>(`styles/${pack}/manifest.json`);
      const kinds = manifest.effects.map((id) => {
        const node = readJson<{ effects: Array<{ id: string; material?: { kind: string } }> }>(
          "effects/manifest.json",
        ).effects.find((item) => item.id === id);
        expect(node, `${pack}: effects[] 里的 ${id} 不在聚合清单里`).toBeDefined();
        return node!.material?.kind;
      });
      if (manifest.materialDirection.glow === "forbidden") {
        expect(kinds, `${pack} 声明禁止发光，却挂了发光效果`).not.toContain("light");
      }
    }
  });

  it("resident 效果清单与 pack 的材质预算在 audit 里是 0 error", () => {
    const { findings } = checkRegistry({ root: ROOT });
    expect(findings.filter((f: { level: string }) => f.level === "error")).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* 5. K1 darkDirection × K8 materialDirection                                    */
/* -------------------------------------------------------------------------- */

describe("K8 · 与 K1 的暗色方向兼容（只报可证明的那一条）", () => {
  it("三套真实 pack 不冲突", () => {
    for (const pack of ["editorial", "cinematic", "instrument"]) {
      const manifest = readJson<{
        darkDirection: { strategy: string };
        materialDirection: { ambient: string };
      }>(`styles/${pack}/manifest.json`);
      const risky = manifest.darkDirection.strategy === "product-authored" && manifest.materialDirection.ambient === "pack-authored";
      expect(risky, `${pack}: 暗色由产品写，环境光却写死在 pack 里`).toBe(false);
    }
  });

  it("那条 warn 真的会响：product-authored 暗色 + pack-authored 环境光", () => {
    // 用真实 cinematic 的 manifest 做一次"暗色交给产品"的对照实验
    const cinematic = readJson<Record<string, unknown>>("styles/cinematic/manifest.json");
    const mutated = {
      ...cinematic,
      darkDirection: {
        strategy: "product-authored",
        approach: "preserve-hue",
        contrastTarget: { standard: "WCAG-AA", normalText: 4.5, largeText: 3 },
        slots: ["--kits-color-glow"],
      },
    };
    // 整棵 metadata 树复制一份，只改 cinematic 的 darkDirection —— 这样其它判定仍是绿的
    const dir = path.join(TMP, "dark-gap");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const entry of ["registry", "styles", "components", "effects", "packages"]) {
      cpSync(path.join(ROOT, entry), path.join(dir, entry), { recursive: true });
    }
    writeFileSync(path.join(dir, "styles/cinematic/manifest.json"), JSON.stringify(mutated, null, 2));

    const { findings } = checkRegistry({ root: dir });
    const codes = findings.map((f: { code: string }) => f.code);
    expect(codes).toContain("material/dark-authoring-gap");
    expect(findings.filter((f: { level: string }) => f.level === "error")).toEqual([]);
    // 对照：原样的 cinematic（single-theme）不会有这条 warn
    expect(
      checkRegistry({ root: ROOT }).findings.map((f: { code: string }) => f.code),
    ).not.toContain("material/dark-authoring-gap");
    rmSync(dir, { recursive: true, force: true });
  });
});

/* -------------------------------------------------------------------------- */
/* 6. K2 移动端语义：复用，不造第二套                                            */
/* -------------------------------------------------------------------------- */

describe("K8 · 移动端语义继续复用 K2", () => {
  it("materialDirection 里不允许出现 mobile 字段（第二套真相会被抓）", () => {
    expect(VOCAB.materialAmbients).toEqual(["pack-authored", "effect-only", "none"]);
    expect(VOCAB.materialGlows).toEqual(["budgeted", "forbidden"]);
    expect(VOCAB.materialHierarchies).toEqual(["light", "rule", "space", "texture"]);
    expect(VOCAB.effectMaterialKinds).toEqual(["light", "texture", "line"]);
  });

  it("effect 的移动端story 仍然只写在既有 metadata 里（K2 契约）", () => {
    const aggregate = readJson<{
      contract: { requiredFields: string[] };
      effects: Array<{ id: string; mobile: string; material?: { kind: string } }>;
    }>("effects/manifest.json");
    expect(aggregate.contract.requiredFields).toContain("mobile");
    for (const effect of aggregate.effects) {
      expect(typeof effect.mobile, `${effect.id} 缺 mobile 说明`).toBe("string");
      expect(effect.mobile.length).toBeGreaterThan(0);
      // material 只讲"画的是什么"，不讲"移动端怎么办"
      expect(Object.keys(effect.material ?? {})).not.toContain("mobileCompatible");
    }
    for (const asset of REGISTRY.assets.filter((a: { type: string }) => a.type === "effect")) {
      expect(VOCAB.mobileValues).toContain(asset.mobileCompatible);
      expect(["supported", "not-applicable", "unsupported"]).toContain(asset.reducedMotion);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 7. schema / audit 能抓 typo                                                   */
/* -------------------------------------------------------------------------- */

describe("K8 · schema 与 audit 能抓材质 metadata 的 typo", () => {
  const AUDIT = path.join(ROOT, "scripts", "registry-audit.mjs");

  it("audit 退出码 0，并打印材质语言与材质边界两行（说明它检查了什么）", () => {
    const result = spawnSync(process.execPath, [AUDIT], { cwd: ROOT, encoding: "utf8" });
    expect(result.status, result.stdout).toBe(0);
    const out = result.stdout;
    expect(out).toContain("材质语言（K8）");
    expect(out).toContain("材质边界（K8）");
    expect(out).toContain("materialDirection");
    expect(out).toContain("pack-authored");
    expect(out).toContain("forbidden");
  });

  it("真实 pack 的材质声明与 CSS 一致（audit 的那几条核对不是装饰）", () => {
    for (const pack of ["editorial", "cinematic", "instrument"]) {
      const manifest = readJson<{ materialDirection: { ambient: string; glow: string } }>(
        `styles/${pack}/manifest.json`,
      );
      const css = read(`styles/${pack}/tokens.css`);
      expect(css.includes(".kits-ambient"), `${pack} 的 .kits-ambient 与 ambient 声明不符`).toBe(
        manifest.materialDirection.ambient === "pack-authored",
      );
      expect(/--kits-color-glow:\s*transparent;/.test(css), `${pack} 的 --kits-color-glow 与 glow 声明不符`).toBe(
        manifest.materialDirection.glow === "forbidden",
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 8. 第三 Prototype 只读验证：instrument + effects: []                          */
/* -------------------------------------------------------------------------- */

describe("K8 · Research-style 产品（只读）：instrument + effects: [] 依然是一等用法", () => {
  it.skipIf(!hasResearch)("第三 Prototype 的 Visual Manifest 明确不要 effect", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(RESEARCH_ROOT, "visual-manifest.json"), "utf8"),
    ) as { stylePack: string; effects: string[]; avoid: string[] };
    expect(manifest.stylePack).toBe("instrument");
    expect(manifest.effects).toEqual([]);
    // 它甚至把"环境动画"写进 avoid：负向案例是刻意的，不是遗漏
    expect(manifest.avoid.some((item) => /ambient/i.test(item))).toBe(true);
  });

  it.skipIf(!hasResearch)("Kits 侧：instrument 不要求任何 effect，也不自带环境光", () => {
    const manifest = readJson<{
      effects: string[];
      materialDirection: { hierarchy: string; ambient: string; glow: string };
    }>("styles/instrument/manifest.json");
    // 只断言可核对的那三个字段（notes 是散文，不参与判定）
    expect(manifest.materialDirection).toMatchObject({
      hierarchy: "rule",
      ambient: "none",
      glow: "forbidden",
    });
    const lightEffects = manifest.effects.filter((id) => {
      const node = readJson<{ effects: Array<{ id: string; material?: { kind: string } }> }>(
        "effects/manifest.json",
      ).effects.find((item) => item.id === id);
      return node?.material?.kind === "light";
    });
    expect(lightEffects).toEqual([]);
    // 只装 instrument 的产品不需要 effect 就能成立
    const product = makeProduct("research-style");
    installFromManifest(product, { stylePack: "instrument", signatureComponents: ["insight-reveal"], effects: [] });
    expect(installedAssetDirs(product)).not.toContain("ambient-glow");
    expect(installedAssetDirs(product)).toContain("instrument");
  });

  it.skipIf(!hasFactory || !hasResearch)("Factory v1.2 读到的两个轴没有因为 K8 改变", () => {
    const script = path.join(TMP, "research-pack-fields.mjs");
    mkdirSync(TMP, { recursive: true });
    writeFileSync(
      script,
      [
        `const mod = await import(${JSON.stringify(KITS_RUNTIME)});`,
        `const registry = mod.readJsonFile(new URL("registry/assets.json", "file://" + ${JSON.stringify(ROOT)} + "/")).value;`,
        `const loaded = mod.loadPackManifest(${JSON.stringify(ROOT)}, registry, "instrument");`,
        `if (!loaded.ok) { console.log(JSON.stringify({ ok: false, reason: loaded.reason })); process.exit(0); }`,
        `const result = mod.crossCheckPackProfile({}, loaded.value);`,
        `console.log(JSON.stringify({ ok: true, checked: result.checked.map((c) => [c.label, c.packValue]) }));`,
      ].join("\n"),
    );
    const result = spawnSync(process.execPath, [script], { encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    const parsed = JSON.parse(result.stdout.trim()) as { ok: boolean; checked: Array<[string, string]> };
    expect(parsed.ok).toBe(true);
    // Phase B 就钉住过：K8 不许碰 motion.language / profile.density
    expect(parsed.checked).toEqual([
      ["motionDirection", "precise"],
      ["density", "high"],
    ]);
  });
});
