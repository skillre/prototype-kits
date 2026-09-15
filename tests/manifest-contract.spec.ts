/**
 * Phase B 门禁 —— 适配标签 / 移动端语义 / 引用一致性 / 暗色方向。
 *
 * ===========================================================================
 * 这个文件在守什么
 * ===========================================================================
 * v0.1.1 里这些字段"看起来是契约，实际上只是字符串"，而且没有任何东西会因此变红：
 *
 *   mobileCompatible: true         —— 没人定义 true 是什么意思（兼容？推荐？内建？）
 *   avoidFor: ["移动端为主的产品"]   —— 自由散文，typo 与真值一模一样通过
 *   effects: ["technical-grid"]    —— registry 里根本没有这个资产
 *   effects: ["animated-grid"]     —— 它的 registry type 是 component，不是 effect
 *   usedByStylePacks: {…: "recommended"} —— 角色词与 pack 三个列表各说各话
 *   （darkDirection 完全不存在）
 *
 * Phase B 之后，上面每一条都有**具名判定**（`fit/unknown-tag`、`ref/wrong-type`、
 * `usedby/role-mismatch` …），由 `scripts/lib/manifest-contract.mjs` 执行，
 * 同一个模块也被 `pnpm registry` 与 Playground 消费。
 *
 * 这个文件守四件事：
 *
 *   1. **现状干净**：真实仓库 0 处 error（这是 gate，不是打印）；
 *   2. **判定真的在跑**：`summarize()` 的每类计数必须非零 ——
 *      「0 处发现」在「全部通过」与「其实什么都没查」时长得一样，这个测试区分它们；
 *   3. **规则真的会红**：每条规则都有 fixture 变异测试（注入缺陷 → 必须报出那个 code）；
 *   4. **schema 与执行一致**：枚举、下限这些数字只有 schema 一份，
 *      模块从 schema 读；这里逐条钉住"schema 说的"与"执行做的"等价。
 *
 * 迁移保真另有一条：v0.1.1 的自由散文必须**逐字**留在 `*Notes` 里 ——
 * 收紧 schema 不允许顺手丢掉人读的理由。
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import {
  checkCoverage,
  checkRegistry,
  deriveMobileState,
  loadRegistry,
  loadVocabularies,
  PACK_ROLE_FIELDS,
  resolveAsset,
  summarize,
} from "../scripts/lib/manifest-contract.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const TMP = path.join(ROOT, "node_modules", ".cache", "kits-manifest-contract-tests");
const REGISTRY = loadRegistry(ROOT);
const VOCAB = loadVocabularies(ROOT);

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

/* -------------------------------------------------------------------------- */
/* 工具                                                                        */
/* -------------------------------------------------------------------------- */

const codes = (findings: Array<{ code: string; level: string }>) => findings.map((f) => f.code);
const errorsOf = (findings: Array<{ code: string; level: string }>) =>
  findings.filter((f) => f.level === "error").map((f) => f.code);

/**
 * 造一个最小 fixture 仓库：`registry/assets.json` + 该 registry 指向的清单文件。
 * 只写需要的文件 —— 判定是按 registry 指向的路径去读的，没指向的东西不参与。
 */
function makeFixture(
  name: string,
  registry: Record<string, unknown>,
  files: Record<string, unknown> = {},
) {
  const root = path.join(TMP, name);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(path.join(root, "registry"), { recursive: true });
  writeFileSync(path.join(root, "registry", "assets.json"), JSON.stringify(registry, null, 2));
  // 词汇表：判定从真 schema 读，fixture 只提供它的副本
  writeFileSync(
    path.join(root, "registry", "assets.schema.json"),
    readFileSync(path.join(ROOT, "registry", "assets.schema.json"), "utf8"),
  );
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, JSON.stringify(content, null, 2));
  }
  return root;
}

/** 一个形状合法的 pack manifest，供变异测试改一处用。 */
const packManifest = (overrides: Record<string, unknown> = {}) => ({
  id: "demo-pack",
  name: "Demo",
  type: "style",
  status: "approved",
  mobileCompatible: true,
  recommendedFor: ["desktop"],
  recommendedForNotes: ["演示用"],
  avoidFor: ["mobile"],
  avoidForNotes: ["演示用"],
  signatureComponents: [],
  effects: [],
  ...overrides,
});

const componentManifest = (overrides: Record<string, unknown> = {}) => ({
  id: "demo-widget",
  name: "DemoWidget",
  status: "approved",
  mobileCompatible: true,
  mobileFallback: { trigger: "(pointer: coarse)", behavior: ["降级"], noContentLoss: true },
  avoidFor: ["mobile"],
  avoidForNotes: ["演示用"],
  usedByStylePacks: { "demo-pack": "signature" },
  ...overrides,
});

const BASE_REGISTRY = (assets: Array<Record<string, unknown>>) => ({
  registryVersion: "0.2.0",
  statusLifecycle: ["incoming", "experimental", "approved", "deprecated"],
  policy: { approvalRequired: ["approved"], forbidden: ["引用未登记资产"] },
  assets,
});

const PACK_ASSET: Record<string, unknown> = {
  id: "demo-pack",
  name: "Demo",
  type: "style",
  status: "approved",
  version: "0.1.0",
  path: "styles/demo-pack",
  manifest: "styles/demo-pack/manifest.json",
  entry: "styles/demo-pack/tokens.css",
  cssEntry: "@kits/style-demo/tokens.css",
  selector: '[data-kits-pack="demo-pack"]',
  dependencies: [],
  performance: "A",
  ssrCompatible: true,
  mobileCompatible: true,
  reducedMotion: "supported",
  recommendedFor: ["desktop"],
  avoidFor: ["mobile"],
  signatureComponents: ["demo-widget"],
  source: { kind: "first-party", origin: "prototype-kits" },
};

const COMPONENT_ASSET: Record<string, unknown> = {
  id: "demo-widget",
  name: "DemoWidget",
  type: "component",
  status: "approved",
  version: "0.1.0",
  path: "components/demo-widget",
  manifest: "components/demo-widget/manifest.json",
  entry: "components/demo-widget/index.tsx",
  performance: "A",
  ssrCompatible: true,
  mobileCompatible: true,
  reducedMotion: "supported",
  dependencies: [],
  avoidFor: ["mobile"],
  source: { kind: "first-party", origin: "prototype-kits" },
};

const TOKENS_CSS = ":root {\n  --kits-color-canvas: #fff;\n  --kits-color-ink: #111;\n}\n";

/**
 * 造一个 fixture 场景。
 *
 * **默认两侧镜像一致**：registry 条的标签 / mobileCompatible / signatureComponents
 * 会被镜像进 manifest —— 镜像漂移本身有一条测试专门守，不该在别的测试里意外触发。
 * 想制造漂移的测试显式覆盖 manifest 那一侧。
 */
function scenario(
  name: string,
  options: {
    pack?: Record<string, unknown>;
    component?: Record<string, unknown>;
    manifest?: Record<string, unknown>;
    componentManifest?: Record<string, unknown>;
    extraAssets?: Array<Record<string, unknown>>;
    extraFiles?: Record<string, unknown>;
  } = {},
) {
  const packAsset = { ...PACK_ASSET, ...(options.pack ?? {}) };
  const componentAsset = { ...COMPONENT_ASSET, ...(options.component ?? {}) };

  const packFile = packManifest({
    recommendedFor: packAsset.recommendedFor,
    avoidFor: packAsset.avoidFor,
    mobileCompatible: packAsset.mobileCompatible,
    signatureComponents: packAsset.signatureComponents ?? [],
    ...(options.manifest ?? {}),
  });
  const componentFile = componentManifest({
    avoidFor: componentAsset.avoidFor,
    mobileCompatible: componentAsset.mobileCompatible,
    usedByStylePacks:
      componentAsset.usedByStylePacks === undefined
        ? { "demo-pack": "signature" }
        : componentAsset.usedByStylePacks,
    ...(options.componentManifest ?? {}),
  });

  return makeFixture(
    name,
    BASE_REGISTRY([packAsset, componentAsset, ...(options.extraAssets ?? [])]),
    {
      "styles/demo-pack/manifest.json": packFile,
      "styles/demo-pack/tokens.css": TOKENS_CSS,
      "components/demo-widget/manifest.json": componentFile,
      ...(options.extraFiles ?? {}),
    },
  );
}

/** 一个已登记的 effect 资产（effect 相关测试用）。 */
const EFFECT_ASSET: Record<string, unknown> = {
  id: "demo-effect",
  name: "DemoEffect",
  type: "effect",
  status: "approved",
  version: "0.1.0",
  path: "effects",
  manifest: "effects/manifest.json",
  entry: "effects/demo-effect.css",
  performance: "A",
  ssrCompatible: true,
  mobileCompatible: true,
  reducedMotion: "not-applicable",
  dependencies: [],
  source: { kind: "first-party" },
};

const EFFECT_AGGREGATE = {
  effects: [{ id: "demo-effect", pack: "demo-pack", entry: "demo-effect.css", class: "x" }],
};

/* -------------------------------------------------------------------------- */
/* 1. 真实仓库：0 error，且每类检查都真的跑过                                    */
/* -------------------------------------------------------------------------- */

describe("Phase B · 真实仓库是一致的（gate）", () => {
  const result = checkRegistry({ root: ROOT });

  it("0 处 error", () => {
    expect(errorsOf(result.findings)).toEqual([]);
  });

  it("并说明自己检查了什么：每类计数都非零", () => {
    const stats = summarize(REGISTRY, result.resolved, result.reserved);
    expect(stats.assets).toBe(16);
    expect(stats.kinds).toEqual({ pack: 3, component: 5, effect: 3, package: 3, none: 2 });
    expect(stats.manifestsResolved).toBe(14);
    expect(stats.referenceLists).toBeGreaterThanOrEqual(12);
    expect(stats.referenceIds).toBeGreaterThanOrEqual(18);
    expect(stats.roleAssignments).toBe(15);
    expect(stats.notes).toBeGreaterThanOrEqual(40);
    expect(stats.packagesChecked).toBe(3);
    expect(stats.effectsInAggregate).toBe(3);
    expect(stats.darkDeclared).toBe(3);
    // 「标签数两边相等」同时说明投影完整：registry 与 manifest 各 19 个值
    expect(stats.registryTagValues).toBe(stats.manifestTagValues);
    expect(stats.registryTagValues).toBeGreaterThan(0);
  });

  it("清单定位分四种形状：registry → 每个资产真正该读哪份文件", () => {
    // 这一条守的是 K6 里最容易出错的地方：effects/manifest.json 是**聚合**清单，
    // 三个 effect 共用它；把它当成 per-asset 清单去查字段，就会得到假阳/假阴。
    const kinds = Object.fromEntries(
      REGISTRY.assets.map((asset: { id: string; type: string; manifest: string | null }) => {
        const place = resolveAsset(ROOT, { ...asset, type: asset.type });
        return [asset.id, place.kind];
      }),
    );
    expect(kinds.editorial).toBe("pack");
    expect(kinds["data-cursor"]).toBe("component");
    expect(kinds["paper-grain"]).toBe("effect");
    expect(kinds.cli).toBe("package");
    expect(kinds["visual-direction"]).toBe("none");

    const effect = REGISTRY.assets.find((a: { id: string }) => a.id === "paper-grain");
    const place = resolveAsset(ROOT, effect);
    expect(place.abs?.endsWith("effects/manifest.json")).toBe(true);
    // per-asset 节点是 effects[] 里 id 匹配的那一项，不是聚合清单本身
    expect(place.node?.id).toBe("paper-grain");
    expect(place.node).not.toBe(place.manifest);
  });

  it("覆盖度承诺（3 套 pack / 5 个组件）成立", () => {
    expect(checkCoverage(REGISTRY)).toEqual([]);
  });

  it("registry 的 recommendedFor / avoidFor 也是标签，不是散文", () => {
    for (const asset of REGISTRY.assets) {
      for (const field of ["recommendedFor", "avoidFor"]) {
        const values = (asset as Record<string, unknown>)[field];
        if (values === undefined) continue;
        expect(Array.isArray(values), `${asset.id}.${field} 必须是数组`).toBe(true);
        for (const value of values as string[]) {
          expect(VOCAB.fitTags).toContain(value);
        }
      }
    }
  });

  it("K1 · 三套 pack 都声明了可执行的暗色方向", () => {
    const packs = REGISTRY.assets.filter((a: { type: string }) => a.type === "style");
    expect(packs).toHaveLength(3);
    for (const pack of packs as Array<{ id: string; manifest: string }>) {
      const manifest = JSON.parse(readFileSync(path.join(ROOT, pack.manifest), "utf8"));
      expect(manifest.darkDirection, `${pack.id} 缺 darkDirection`).toBeDefined();
      expect(VOCAB.darkStrategies).toContain(manifest.darkDirection.strategy);
      // slots 必须是 tokens.css 里真实存在的变量（判定已核对，这里再确认非空）
      if (manifest.darkDirection.strategy === "product-authored") {
        expect(manifest.darkDirection.slots.length).toBeGreaterThan(0);
        expect(VOCAB.darkApproaches).toContain(manifest.darkDirection.approach);
      }
    }
  });

  it("K2 · 移动端状态是状态词，不是真假值", () => {
    // registry 的 JSON 推断类型在条目之间不齐（有的没有 recommendedFor），这里收窄一次
    const fitOf = (asset: { id: string }) =>
      asset as unknown as { mobileCompatible: boolean | string; recommendedFor?: string[]; avoidFor?: string[] };
    const states = Object.fromEntries(
      REGISTRY.assets.map((asset: { id: string }) => [asset.id, deriveMobileState(fitOf(asset))]),
    );
    // 「兼容但设计上不推荐」与「只能在降级下用」各有一个真实样本
    expect(states.instrument).toBe("discouraged");
    expect(states["data-cursor"]).toBe("fallback-only");
    expect(states["visual-direction"]).toBe("not-applicable");
    expect(states.editorial).toBe("compatible");
    // instrument 仍然 mobileCompatible=true —— 说明"能用"与"推荐"是两件事
    const instrument = REGISTRY.assets.find((a: { id: string }) => a.id === "instrument");
    expect(instrument.mobileCompatible).toBe(true);
  });

  it("K3 · technical-grid 这个从未存在的资产不再被任何地方引用", () => {
    for (const rel of [
      "styles/instrument/manifest.json",
      "styles/instrument/README.md",
      "styles/instrument/SKILL.md",
    ]) {
      expect(readFileSync(path.join(ROOT, rel), "utf8")).not.toContain("technical-grid");
    }
  });

  it("K6 · instrument / cinematic 的 effects[] 只剩真正的 effect", () => {
    const effectsOf = (pack: string) =>
      (JSON.parse(readFileSync(path.join(ROOT, `styles/${pack}/manifest.json`), "utf8")) as {
        effects: string[];
      }).effects;
    expect(effectsOf("instrument")).toEqual(["scanline-sweep"]);
    expect(effectsOf("cinematic")).toEqual(["ambient-glow"]);
    expect(effectsOf("editorial")).toEqual(["paper-grain"]);
  });
});

/* -------------------------------------------------------------------------- */
/* 2. schema ↔ 执行：同一份真相                                                 */
/* -------------------------------------------------------------------------- */

describe("fixture 基线：一个没有缺陷的场景必须是绿的", () => {
  it("scenario() 默认场景 0 error / 0 warn（只有 dark/undeclared 这种合法 info）", () => {
    const findings = checkRegistry({ root: scenario("baseline") }).findings;
    expect(errorsOf(findings), JSON.stringify(findings, null, 2)).toEqual([]);
    expect(findings.filter((f) => f.level === "warn")).toEqual([]);
    // 「未声明」在任何一层都是**合法旧状态**（info，不是 error）：
    // K1 的 darkDirection 与 K8 的 materialDirection 各报一条
    expect(codes(findings), "基线只允许出现这两条「未声明」info").toEqual([
      "dark/undeclared",
      "material/undeclared",
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* 2. schema ↔ 执行：同一份真相                                                 */
/* -------------------------------------------------------------------------- */

describe("Phase B · schema 与执行同源", () => {
  it("fitTag 枚举里的每个值都被接受，枚举外的值一定报错", () => {
    for (const tag of VOCAB.fitTags) {
      const root = scenario(`tag-${tag}`, { pack: { recommendedFor: [tag] } });
      const findings = checkRegistry({ root }).findings;
      expect(codes(findings), `${tag} 不该被拒绝`).not.toContain("fit/unknown-tag");
    }
    const root = scenario("tag-bogus", { pack: { recommendedFor: ["mobile-first"] } });
    expect(codes(checkRegistry({ root }).findings)).toContain("fit/unknown-tag");
  });

  it("x- 前缀是唯一的扩展口", () => {
    const root = scenario("tag-extension", { pack: { recommendedFor: ["x-internal-console"] } });
    expect(errorsOf(checkRegistry({ root }).findings)).toEqual([]);
  });

  it("mobileCompatibility 枚举的每个值都有派生状态", () => {
    expect(VOCAB.mobileValues).toEqual([true, false, "fallback-only", "not-applicable"]);
    expect(deriveMobileState({ mobileCompatible: true })).toBe("compatible");
    expect(deriveMobileState({ mobileCompatible: false })).toBe("unsupported");
    expect(deriveMobileState({ mobileCompatible: "fallback-only" })).toBe("fallback-only");
    expect(deriveMobileState({ mobileCompatible: "not-applicable" })).toBe("not-applicable");
    expect(deriveMobileState({ mobileCompatible: true, recommendedFor: ["mobile"] })).toBe("recommended");
    expect(deriveMobileState({ mobileCompatible: true, avoidFor: ["mobile"] })).toBe("discouraged");
  });

  it("对比度下限来自 schema：4.5 / 3，低于它必红", () => {
    const { normalText, largeText } = VOCAB.contrastTarget.properties;
    expect(normalText.minimum).toBe(4.5);
    expect(largeText.minimum).toBe(3);

    const dark = (normal: number, large: number) => ({
      strategy: "product-authored",
      approach: "preserve-hue",
      contrastTarget: { standard: "WCAG-AA", normalText: normal, largeText: large },
      slots: ["--kits-color-canvas"],
    });

    const atFloor = scenario("dark-at-floor", { manifest: { darkDirection: dark(4.5, 3) } });
    expect(errorsOf(checkRegistry({ root: atFloor }).findings)).toEqual([]);

    const belowFloor = scenario("dark-below-floor", { manifest: { darkDirection: dark(4.4, 2.9) } });
    const findings = codes(checkRegistry({ root: belowFloor }).findings);
    expect(findings.filter((c) => c === "dark/target-too-low")).toHaveLength(2);
  });

  it("packRole 枚举就是模块的角色映射表（只有一份）", () => {
    expect(VOCAB.packRoles).toEqual(Object.keys(PACK_ROLE_FIELDS));
    expect(VOCAB.packRoles).toEqual(["signature", "optional", "discouraged"]);
  });

  it("manifest.schema.json 的 $ref 全部指向 assets.schema.json 里真实存在的 $defs", () => {
    const manifestSchema = JSON.parse(
      readFileSync(path.join(ROOT, "registry", "manifest.schema.json"), "utf8"),
    );
    const refs: string[] = [];
    const walk = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== "object") return;
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (key === "$ref" && typeof value === "string") refs.push(value);
        else walk(value);
      }
    };
    walk(manifestSchema);
    expect(refs.length).toBeGreaterThan(10);
    for (const ref of refs) {
      const match = /^assets\.schema\.json#\/\$defs\/([A-Za-z0-9]+)$/.exec(ref);
      expect(match, `$ref 形状不认识：${ref}`).not.toBeNull();
      expect(Object.keys(VOCAB.schema.$defs)).toContain(match![1]);
    }
  });

  it("八份 manifest 都指向 manifest.schema.json", () => {
    for (const asset of REGISTRY.assets as Array<{ id: string; type: string; manifest: string | null }>) {
      if (asset.type !== "style" && asset.type !== "component") continue;
      const manifest = JSON.parse(readFileSync(path.join(ROOT, asset.manifest!), "utf8"));
      expect(manifest.$schema, `${asset.id} 没有声明 $schema`).toBe(
        "../../registry/manifest.schema.json",
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 3. K7 · 适配标签：typo、冲突、迁移保真                                       */
/* -------------------------------------------------------------------------- */

describe("K7 · 适配标签", () => {
  it("v0.1.1 的自由散文现在会失败（这就是收紧的意义）", () => {
    const root = scenario("k7-prose", {
      pack: { recommendedFor: ["行业研究报告 / 深度分析页"], avoidFor: ["移动端为主的产品"] },
    });
    // 两侧各一份：registry 是索引、manifest 是上下文，两处都必须各自合法
    const findings = codes(checkRegistry({ root }).findings).filter((c) => c === "fit/unknown-tag");
    expect(findings).toHaveLength(4);
  });

  it("同一个维度不能既推荐又回避", () => {
    const root = scenario("k7-conflict", {
      pack: { recommendedFor: ["mobile", "desktop"], avoidFor: ["mobile"] },
    });
    expect(codes(checkRegistry({ root }).findings)).toContain("fit/conflict");
  });

  it("registry 与 manifest 的标签必须逐字一致（投影不能漂移）", () => {
    const root = scenario("k7-drift", { manifest: { recommendedFor: ["desktop", "text-heavy"] } });
    const findings = checkRegistry({ root }).findings;
    expect(codes(findings)).toContain("fit/registry-manifest-drift");
    expect(errorsOf(findings)).toContain("fit/registry-manifest-drift");
  });

  it("只有标签、丢了散文 → warn（不阻塞，但会被说出来）", () => {
    const root = scenario("k7-notes", { manifest: { recommendedForNotes: undefined } });
    const findings = checkRegistry({ root }).findings;
    expect(codes(findings)).toContain("fit/notes-missing");
    expect(errorsOf(findings)).toEqual([]);
  });

  it("v0.1.1 的散文逐字留在 *Notes 里（迁移不丢信息）", () => {
    const expectProse = (rel: string, field: string, sample: string) => {
      const manifest = JSON.parse(readFileSync(path.join(ROOT, rel), "utf8"));
      expect(manifest[field], `${rel} 缺 ${field}`).toBeDefined();
      expect(manifest[field]).toContain(sample);
    };
    expectProse("styles/editorial/manifest.json", "recommendedForNotes", "行业研究报告 / 深度分析页");
    expectProse(
      "styles/editorial/manifest.json",
      "avoidForNotes",
      "实时监控大屏（信息刷新速度要求高于阅读体验）",
    );
    expectProse("styles/instrument/manifest.json", "avoidForNotes", "移动端为主的产品（高密度在 390px 下会变成不可读）");
    expectProse("styles/cinematic/manifest.json", "recommendedForNotes", "产品发布会页、营销首屏、Demo 场景");
    expectProse(
      "components/data-cursor/manifest.json",
      "avoidForNotes",
      "移动端为主的产品（组件在触屏上完全不激活，等于白引入）",
    );
    expectProse("components/insight-reveal/manifest.json", "avoidForNotes", "首屏以上内容（用户立刻要看的东西不应该等动画）");
  });

  it("散文没有被删短：每份 manifest 的 notes 条数与 v0.1.1 的原文等量", () => {
    const expected: Record<string, number> = {
      "styles/editorial/manifest.json": 10,
      "styles/cinematic/manifest.json": 10,
      "styles/instrument/manifest.json": 11,
      "components/interactive-hero/manifest.json": 2,
      "components/spotlight-surface/manifest.json": 3,
      "components/animated-grid/manifest.json": 3,
      "components/data-cursor/manifest.json": 4,
      "components/insight-reveal/manifest.json": 3,
    };
    for (const [rel, count] of Object.entries(expected)) {
      const manifest = JSON.parse(readFileSync(path.join(ROOT, rel), "utf8"));
      const notes = [
        ...(manifest.recommendedForNotes ?? []),
        ...(manifest.avoidForNotes ?? []),
      ];
      expect(notes.length, `${rel} 的散文条数变了`).toBe(count);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 4. K2 · 移动端语义                                                           */
/* -------------------------------------------------------------------------- */

describe("K2 · 移动端语义", () => {
  const FALLBACK_OK = { trigger: "(pointer: coarse)", behavior: ["能力关闭"], noContentLoss: true };

  it("fallback-only 必须给出可核对的降级行为", () => {
    const root = scenario("k2-no-fallback", {
      pack: { mobileCompatible: "fallback-only", recommendedFor: undefined, avoidFor: undefined },
    });
    expect(codes(checkRegistry({ root }).findings)).toContain("mobile/fallback-missing");
  });

  it("降级不允许丢内容（noContentLoss 必须为 true）", () => {
    const root = scenario("k2-lossy", {
      pack: { mobileCompatible: "fallback-only", recommendedFor: undefined, avoidFor: undefined },
      manifest: { mobileFallback: { ...FALLBACK_OK, noContentLoss: false } },
    });
    expect(codes(checkRegistry({ root }).findings)).toContain("mobile/fallback-lossy");
  });

  it("「只能用降级形态」与「推荐在移动端用」互斥", () => {
    const root = scenario("k2-conflict", {
      pack: { mobileCompatible: "fallback-only", recommendedFor: ["mobile"], avoidFor: undefined },
      manifest: { mobileFallback: FALLBACK_OK },
    });
    expect(codes(checkRegistry({ root }).findings)).toContain("mobile/tag-conflict");
  });

  it("registry 与 manifest 的 mobileCompatible 不一致会红", () => {
    const root = scenario("k2-drift", {
      pack: { mobileCompatible: "fallback-only", recommendedFor: undefined, avoidFor: undefined },
      manifest: { mobileCompatible: true, mobileFallback: FALLBACK_OK },
    });
    expect(codes(checkRegistry({ root }).findings)).toContain("mobile/registry-manifest-drift");
  });

  it("非法取值会红", () => {
    const root = scenario("k2-unknown", { pack: { mobileCompatible: "yes" } });
    expect(codes(checkRegistry({ root }).findings)).toContain("mobile/unknown-value");
  });

  it("false（不得在移动端使用）与 recommendedFor 含 mobile 互斥", () => {
    const root = scenario("k2-unsupported-recommended", {
      pack: { mobileCompatible: false, recommendedFor: ["mobile"], avoidFor: undefined },
    });
    const findings = codes(checkRegistry({ root }).findings);
    expect(findings).toContain("mobile/unsupported-recommended");
  });

  it("真实仓库里五个组件都仍然给出降级行为（K2 没有放宽任何东西）", () => {
    for (const id of ["interactive-hero", "spotlight-surface", "animated-grid", "data-cursor", "insight-reveal"]) {
      const manifest = JSON.parse(readFileSync(path.join(ROOT, `components/${id}/manifest.json`), "utf8"));
      expect([true, "fallback-only"]).toContain(manifest.mobileCompatible);
      expect(manifest.mobileFallback?.trigger).toBeTruthy();
      expect(manifest.mobileFallback?.noContentLoss).toBe(true);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 5. K6 · 引用一致性                                                           */
/* -------------------------------------------------------------------------- */

describe("K6 · 引用一致性", () => {
  it("引用未登记资产 → ref/missing（typo 不再静默通过）", () => {
    const root = scenario("k6-missing", { manifest: { effects: ["technicall-grid"] } });
    expect(codes(checkRegistry({ root }).findings)).toContain("ref/missing");
  });

  it("引用类型不符 → ref/wrong-type（component 不能出现在 effects[] 里）", () => {
    const root = scenario("k6-wrong-type", { manifest: { effects: ["demo-widget"] } });
    expect(codes(checkRegistry({ root }).findings)).toContain("ref/wrong-type");
  });

  it("同一字段内重复引用 → ref/duplicate", () => {
    const root = scenario("k6-duplicate", {
      pack: { signatureComponents: ["demo-widget", "demo-widget"] },
      manifest: { signatureComponents: ["demo-widget", "demo-widget"] },
    });
    expect(codes(checkRegistry({ root }).findings)).toContain("ref/duplicate");
  });

  it("registry 与 manifest 的 signatureComponents 必须一致", () => {
    const root = scenario("k6-sig-drift", { manifest: { signatureComponents: [] } });
    expect(codes(checkRegistry({ root }).findings)).toContain("ref/registry-manifest-drift");
  });

  it("包版本漂移会被发现", () => {
    const root = scenario("k6-package-drift", {
      extraAssets: [
        {
          id: "demo-pkg",
          name: "@kits/demo",
          type: "package",
          status: "approved",
          version: "0.1.0",
          path: "packages/demo",
          manifest: "packages/demo/package.json",
          entry: "packages/demo/index.ts",
          performance: "not-applicable",
          ssrCompatible: true,
          mobileCompatible: "not-applicable",
          reducedMotion: "not-applicable",
          dependencies: [],
          source: { kind: "first-party" },
        },
      ],
      extraFiles: { "packages/demo/package.json": { name: "@kits/demo", version: "0.2.0" } },
    });
    expect(codes(checkRegistry({ root }).findings)).toContain("package/version-drift");
  });

  it("包名漂移会被发现", () => {
    const root = scenario("k6-package-name", {
      extraAssets: [
        {
          id: "demo-pkg",
          name: "@kits/demo",
          type: "package",
          status: "approved",
          version: "0.1.0",
          path: "packages/demo",
          manifest: "packages/demo/package.json",
          entry: "packages/demo/index.ts",
          performance: "not-applicable",
          ssrCompatible: true,
          mobileCompatible: "not-applicable",
          reducedMotion: "not-applicable",
          dependencies: [],
          source: { kind: "first-party" },
        },
      ],
      extraFiles: { "packages/demo/package.json": { name: "@kits/demo-renamed", version: "0.1.0" } },
    });
    expect(codes(checkRegistry({ root }).findings)).toContain("package/name-drift");
  });

  it("effect：不在聚合清单里、或 pack 不是 style → 都会红", () => {
    const missing = scenario("k6-effect-missing", {
      extraAssets: [EFFECT_ASSET],
      extraFiles: { "effects/manifest.json": { effects: [] } },
    });
    expect(codes(checkRegistry({ root: missing }).findings)).toContain("effect/not-in-aggregate");

    const wrongPack = scenario("k6-effect-pack", {
      extraAssets: [EFFECT_ASSET],
      extraFiles: {
        "effects/manifest.json": {
          effects: [{ id: "demo-effect", pack: "demo-widget", entry: "x.css", class: "x" }],
        },
      },
    });
    expect(codes(checkRegistry({ root: wrongPack }).findings)).toContain("effect/pack-wrong-type");
  });

  it("effect 的合法情形是绿的（基线）", () => {
    const root = scenario("k6-effect-ok", {
      extraAssets: [EFFECT_ASSET],
      extraFiles: { "effects/manifest.json": EFFECT_AGGREGATE },
    });
    expect(errorsOf(checkRegistry({ root }).findings)).toEqual([]);
  });

  it("reserved[] 里的占位 id 一旦登记就会红（两处必须同时改）", () => {
    const root = scenario("k6-reserved", {
      extraFiles: {
        "effects/manifest.json": { effects: [], reserved: [{ id: "demo-widget", status: "incoming" }] },
      },
    });
    expect(codes(checkRegistry({ root }).findings)).toContain("effect/reserved-registered");
  });
});

/* -------------------------------------------------------------------------- */
/* 6. K6c · 角色表与 pack 的三列表双向一致                                       */
/* -------------------------------------------------------------------------- */

describe("K6c · usedByStylePacks ↔ pack 列表", () => {
  const roleScenario = (role: string, name: string) =>
    scenario(name, {
      pack: { signatureComponents: role === "signature" ? ["demo-widget"] : [] },
      manifest: {
        signatureComponents: role === "signature" ? ["demo-widget"] : [],
        optionalComponents: role === "optional" ? ["demo-widget"] : undefined,
        discouragedComponents: role === "discouraged" ? ["demo-widget"] : undefined,
      },
      componentManifest: { usedByStylePacks: { "demo-pack": role } },
    });

  it.each(["signature", "optional", "discouraged"])("角色词 %s 与 pack 列表一致时无 error", (role) => {
    expect(errorsOf(checkRegistry({ root: roleScenario(role, `role-ok-${role}`) }).findings)).toEqual([]);
  });

  it("说自己 signature、pack 却列在 discouraged → usedby/role-mismatch", () => {
    const root = scenario("role-mismatch", {
      pack: { signatureComponents: [] },
      manifest: { signatureComponents: [], discouragedComponents: ["demo-widget"] },
      componentManifest: { usedByStylePacks: { "demo-pack": "signature" } },
    });
    const findings = codes(checkRegistry({ root }).findings);
    expect(findings).toContain("usedby/role-mismatch");
    expect(findings).toContain("usedby/pack-does-not-list");
  });

  it("pack 列了它、它却没写 → usedby/missing-pack（反向缺一条）", () => {
    const root = scenario("role-missing", {
      manifest: { signatureComponents: ["demo-widget"] },
      componentManifest: { usedByStylePacks: {} },
    });
    expect(codes(checkRegistry({ root }).findings)).toContain("usedby/missing-pack");
  });

  it("pack 列表里的组件必须真的登记在 registry 里", () => {
    const root = scenario("role-unknown", {
      pack: { signatureComponents: ["ghost-widget"] },
      manifest: { signatureComponents: ["ghost-widget"] },
    });
    expect(codes(checkRegistry({ root }).findings)).toContain("ref/missing");
  });

  it("v0.1.1 的 recommended 这个角色词不再合法", () => {
    const root = scenario("role-legacy", {
      componentManifest: { usedByStylePacks: { "demo-pack": "recommended" } },
    });
    expect(codes(checkRegistry({ root }).findings)).toContain("usedby/unknown-role");
  });

  it("角色表里的 pack 必须是 registry 里的风格包", () => {
    const root = scenario("role-unknown-pack", {
      componentManifest: { usedByStylePacks: { "ghost-pack": "signature" } },
    });
    expect(codes(checkRegistry({ root }).findings)).toContain("usedby/unknown-pack");
  });

  it("真实仓库里五个组件的角色词与三套 pack 的列表完全对齐", () => {
    for (const id of ["interactive-hero", "spotlight-surface", "animated-grid", "data-cursor", "insight-reveal"]) {
      const manifest = JSON.parse(readFileSync(path.join(ROOT, `components/${id}/manifest.json`), "utf8"));
      for (const [packId, raw] of Object.entries(manifest.usedByStylePacks as Record<string, string>)) {
        const role = String(raw).match(/^([a-z-]+)/)?.[1];
        expect(["signature", "optional", "discouraged"]).toContain(role);
        const pack = JSON.parse(readFileSync(path.join(ROOT, `styles/${packId}/manifest.json`), "utf8"));
        expect(pack[PACK_ROLE_FIELDS[role as keyof typeof PACK_ROLE_FIELDS]]).toContain(id);
      }
    }
  });

  it("真实仓库里角色词只有一种写法（不再是 signature 与 recommended 混用）", () => {
    const used = new Set<string>();
    for (const id of ["interactive-hero", "spotlight-surface", "animated-grid", "data-cursor", "insight-reveal"]) {
      const manifest = JSON.parse(readFileSync(path.join(ROOT, `components/${id}/manifest.json`), "utf8"));
      for (const raw of Object.values(manifest.usedByStylePacks as Record<string, string>)) {
        used.add(String(raw).match(/^([a-z-]+)/)?.[1] as string);
      }
    }
    expect([...used].sort()).toEqual(["discouraged", "optional", "signature"]);
  });
});

/* -------------------------------------------------------------------------- */
/* 7. K1 · darkDirection                                                        */
/* -------------------------------------------------------------------------- */

describe("K1 · darkDirection", () => {
  const packWith = (name: string, dark?: unknown, manifest: Record<string, unknown> = {}) =>
    scenario(name, { manifest: { darkDirection: dark, ...manifest } });

  it("不声明是合法的旧状态（info，不是 error）", () => {
    const findings = checkRegistry({ root: packWith("k1-none", undefined) }).findings;
    expect(errorsOf(findings)).toEqual([]);
    expect(codes(findings)).toContain("dark/undeclared");
  });

  it("strategy 必须是枚举里的值", () => {
    expect(codes(checkRegistry({ root: packWith("k1-bad-strategy", { strategy: "dark-ish" }) }).findings)).toContain(
      "dark/unknown-strategy",
    );
  });

  it("product-authored 必须给出 approach + contrastTarget + slots", () => {
    const findings = codes(
      checkRegistry({ root: packWith("k1-incomplete", { strategy: "product-authored" }) }).findings,
    );
    expect(findings).toContain("dark/approach-required");
    expect(findings).toContain("dark/target-required");
    expect(findings).toContain("dark/slots-required");
  });

  it("slots 必须是该 pack tokens.css 里真实声明的变量", () => {
    const root = packWith("k1-bad-slot", {
      strategy: "product-authored",
      approach: "invert-contrast",
      contrastTarget: { standard: "WCAG-AA", normalText: 4.5, largeText: 3 },
      slots: ["--kits-color-canvas", "--kits-color-typo"],
    });
    const findings = checkRegistry({ root }).findings;
    expect(codes(findings)).toContain("dark/unknown-slot");
    const [slotFinding] = findings.filter((f) => f.code === "dark/unknown-slot");
    expect(slotFinding.message).toContain("--kits-color-typo");
  });

  it("single-theme 不需要 approach / target / slots", () => {
    expect(errorsOf(checkRegistry({ root: packWith("k1-single", { strategy: "single-theme" }) }).findings)).toEqual([]);
  });

  it("product-authored 的完整声明是绿的（基线）", () => {
    const root = packWith("k1-complete", {
      strategy: "product-authored",
      approach: "preserve-hue",
      contrastTarget: { standard: "WCAG-AAA", normalText: 7, largeText: 4.5 },
      slots: ["--kits-color-canvas", "--kits-color-ink"],
    });
    expect(errorsOf(checkRegistry({ root }).findings)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* 8. §22 · Factory 读的那两个字段没被碰                                        */
/* -------------------------------------------------------------------------- */

describe("§22 · Factory v1.2 的 pack 交叉核对零回归", () => {
  const FACTORY_ROOT = process.env.KITS_FACTORY_ROOT ?? path.resolve(ROOT, "..", "prototype-starter");
  const KITS_RUNTIME = path.join(FACTORY_ROOT, "scripts", "lib", "kits-runtime.mjs");
  const hasFactory = existsSync(KITS_RUNTIME);

  it("Factory 依赖的两个路径仍然是非空字符串", () => {
    for (const pack of ["editorial", "cinematic", "instrument"]) {
      const manifest = JSON.parse(readFileSync(path.join(ROOT, `styles/${pack}/manifest.json`), "utf8"));
      expect(typeof manifest.motion?.language, `${pack}.motion.language`).toBe("string");
      expect(manifest.motion.language.length).toBeGreaterThan(0);
      expect(typeof manifest.profile?.density, `${pack}.profile.density`).toBe("string");
      expect(manifest.profile.density.length).toBeGreaterThan(0);
    }
  });

  it.runIf(hasFactory)("用 Factory 自己的 crossCheckPackProfile 跑真实 pack：0 issue，且两侧一致时真的 verified", () => {
    const script = path.join(TMP, "factory-pack-crosscheck.mjs");
    mkdirSync(TMP, { recursive: true });
    writeFileSync(
      script,
      [
        `const mod = await import(${JSON.stringify(KITS_RUNTIME)});`,
        `const root = ${JSON.stringify(ROOT)};`,
        `const registry = mod.readJsonFile(new URL("registry/assets.json", "file://" + root + "/")).value;`,
        `const out = [];`,
        `for (const id of ["editorial", "cinematic", "instrument"]) {`,
        `  const loaded = mod.loadPackManifest(root, registry, id);`,
        `  if (!loaded.ok) { out.push({ id, ok: false, reason: loaded.reason }); continue; }`,
        `  // (a) 空 manifest：两个轴都必须真的被读到（unverifiable 不算通过）`,
        `  const probe = mod.crossCheckPackProfile({}, loaded.value);`,
        `  // (b) 与 pack 声明一致的 manifest：必须判成 verified，而不是 mismatch`,
        `  const matching = {};`,
        `  for (const c of probe.checked) matching[c.field] = c.packValue;`,
        `  const agreed = mod.crossCheckPackProfile(matching, loaded.value);`,
        `  out.push({`,
        `    id, ok: true,`,
        `    probe: { status: probe.status, issues: probe.issues, checked: probe.checked.map((c) => [c.label, c.field, c.packValue]), unverifiable: probe.unverifiable },`,
        `    agreed: { status: agreed.status, issues: agreed.issues, manifest: matching },`,
        `  });`,
        `}`,
        `console.log(JSON.stringify(out));`,
      ].join("\n"),
    );
    const result = spawnSync(process.execPath, [script], { encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    const rows = JSON.parse(result.stdout.trim()) as Array<{
      id: string;
      ok: boolean;
      probe: {
        status: string;
        issues: Array<{ path: string; code: string; message: string }>;
        checked: Array<[string, string, string]>;
        unverifiable: unknown[];
      };
      agreed: { status: string; issues: unknown[]; manifest: Record<string, string> };
    }>;
    for (const row of rows) {
      expect(row.ok, `${row.id} 的 manifest 读不出来了`).toBe(true);
      // (a) 两个轴都必须真的被核对到，且没有 issue
      expect(row.probe.unverifiable, `${row.id} 有轴没跑（unverifiable 不得当作通过）`).toEqual([]);
      expect(row.probe.checked.map(([label]) => label).sort()).toEqual(["density", "motionDirection"]);
      expect(row.probe.issues, `${row.id}: ${JSON.stringify(row.probe.issues)}`).toEqual([]);
      // (b) 产品按 pack 说的写 → verified（Phase B 动过这些 manifest，这里证明 L3 没被打坏）
      expect(row.agreed.status, `${row.id} 一致时应当 verified，实际 ${row.agreed.status}`).toBe("verified");
      expect(row.agreed.issues).toEqual([]);
      // 顺带把真正被读到的值钉住：K1/K2/K7 的改动不许碰 motion.language / profile.density
      const byField = Object.fromEntries(row.probe.checked.map(([, field, value]) => [field, value]));
      expect(byField.motionDirection).toBeTruthy();
      expect(byField.density).toBeTruthy();
    }
  });});

/* -------------------------------------------------------------------------- */
/* 9. pnpm registry 的行为契约                                                  */
/* -------------------------------------------------------------------------- */

describe("`pnpm registry` 是一个门，不是一段打印", () => {
  const run = () =>
    spawnSync(process.execPath, [path.join(ROOT, "scripts", "registry-audit.mjs")], {
      cwd: ROOT,
      encoding: "utf8",
    });

  it("真实仓库上退出码 0，且打印出「检查了什么」", () => {
    const result = run();
    expect(result.status, result.stdout).toBe(0);
    const out = result.stdout;
    for (const label of ["引用字段（K6）", "适配标签枚举（K7）", "usedByStylePacks", "darkDirection", "package.json 版本"]) {
      expect(out, `审计没有说明它检查了 ${label}`).toContain(label);
    }
    expect(out).toContain("rec=[");
  });

  it("输出里用的是状态词，不是 ✅/yes", () => {
    const out = run().stdout;
    expect(out).toContain("可用但不推荐");
    expect(out).toContain("仅降级形态");
    expect(out).toContain("不适用");
  });
});
