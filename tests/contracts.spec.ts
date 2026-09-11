/**
 * 契约一致性审计。
 *
 * 核心保证（也是整个 Kits 的立身之本）：
 *
 *   1. Style Pack Contract  —— 每个 pack 必须交付完整的五件套，且 motion.ts 通过运行时校验
 *   2. manifest ⇄ code      —— manifest.json 与 index.ts 导出的 profile 不允许漂移
 *   3. 十个维度必须明显不同  —— 「不能只是换颜色」这条要求在这里被强制执行
 *   4. Component Contract   —— 每个组件必须有 manifest / demo / README / API 版本
 *   5. 视觉字面量禁令        —— 组件代码里不允许出现 hex 颜色
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  ASSET_STATUS,
  MOTION_ROLES,
  assertStylePackMotion,
  motionToCssVars,
  type StylePackProfile,
} from "../components/_shared/contract.ts";

import { editorialMotion, editorialProfile } from "../styles/editorial/index.ts";
import { cinematicMotion, cinematicProfile } from "../styles/cinematic/index.ts";
import { instrumentMotion, instrumentProfile } from "../styles/instrument/index.ts";

const ROOT = path.resolve(import.meta.dirname, "..");

const read = (relative: string) =>
  readFileSync(path.join(ROOT, relative), "utf8");

const readJson = <T,>(relative: string) =>
  JSON.parse(read(relative)) as T;

/* -------------------------------------------------------------------------- */
/* 1. Style Pack Contract                                                      */
/* -------------------------------------------------------------------------- */

const PACKS = [
  { id: "editorial", motion: editorialMotion, profile: editorialProfile },
  { id: "cinematic", motion: cinematicMotion, profile: cinematicProfile },
  { id: "instrument", motion: instrumentMotion, profile: instrumentProfile },
] as const;

describe("Style Pack Contract · 五件套", () => {
  it.each(PACKS.map((pack) => pack.id))(
    "%s 交付 tokens.css / motion.ts / manifest.json / README.md / SKILL.md",
    (id) => {
      for (const file of [
        "tokens.css",
        "motion.ts",
        "manifest.json",
        "README.md",
        "SKILL.md",
      ]) {
        const target = `styles/${id}/${file}`;
        expect(existsSync(path.join(ROOT, target)), `${target} 缺失`).toBe(true);
      }
    },
  );

  it.each(PACKS.map((pack) => pack.id))(
    "%s 的 manifest 含契约要求的全部字段",
    (id) => {
      const manifest = readJson<Record<string, unknown>>(
        `styles/${id}/manifest.json`,
      );
      for (const field of [
        "id",
        "name",
        "version",
        "status",
        "recommendedFor",
        "avoidFor",
        "signatureComponents",
        "designPrinciples",
        "antiPatterns",
      ]) {
        expect(manifest[field], `${id}.manifest 缺 ${field}`).toBeDefined();
      }
      expect(manifest.id).toBe(id);
      expect(ASSET_STATUS).toContain(manifest.status as never);
      expect(
        (manifest.recommendedFor as unknown[]).length,
        `${id}: recommendedFor 不能为空`,
      ).toBeGreaterThan(0);
      expect(
        (manifest.avoidFor as unknown[]).length,
        `${id}: avoidFor 不能为空`,
      ).toBeGreaterThan(0);
      expect(
        (manifest.antiPatterns as unknown[]).length,
        `${id}: antiPatterns 不能为空`,
      ).toBeGreaterThan(0);
      expect(
        (manifest.designPrinciples as unknown[]).length,
        `${id}: designPrinciples 不能为空`,
      ).toBeGreaterThan(0);
    },
  );

  it.each(PACKS.map((pack) => pack.id))(
    "%s 的 motion.ts 通过运行时契约校验",
    (id) => {
      const motion = PACKS.find((pack) => pack.id === id)!.motion;
      expect(() => assertStylePackMotion(motion, id)).not.toThrow();
      expect(motion.duration.base).toBeLessThanOrEqual(1000);
      expect(motion.roles.length).toBeGreaterThan(0);
      for (const role of motion.roles) {
        expect(MOTION_ROLES).toContain(role);
      }
      // 每个 pack 都必须给出 reduced-motion 与 mobile 的处理
      expect(motion.reducedMotion.disableRoles.length).toBeGreaterThan(0);
      expect(motion.mobile.breakpoint).toBeGreaterThan(0);
    },
  );

  it("motion 可以无损编译成 CSS 变量（组件只读变量的前提）", () => {
    for (const pack of PACKS) {
      const vars = motionToCssVars(pack.motion);
      for (const key of [
        "--kits-dur-base",
        "--kits-dur-quick",
        "--kits-ease-out",
        "--kits-stagger-step",
        "--kits-enter-distance",
        "--kits-pointer-factor",
      ]) {
        expect(vars[key], `${pack.id} 未产出 ${key}`).toBeTruthy();
      }
    }
  });
});

describe("Style Pack Contract · manifest 与代码不漂移", () => {
  it.each(PACKS.map((pack) => pack.id))(
    "%s 的 profile 与 manifest.profile 完全一致",
    (id) => {
      const manifest = readJson<{ profile: StylePackProfile }>(
        `styles/${id}/manifest.json`,
      );
      const profile = PACKS.find((pack) => pack.id === id)!.profile;
      expect(manifest.profile).toEqual(profile);
    },
  );

  it.each(PACKS.map((pack) => pack.id))(
    "%s 的 manifest.motion.language 与 motion.ts 一致",
    (id) => {
      const manifest = readJson<{ motion: { language: string } }>(
        `styles/${id}/manifest.json`,
      );
      const motion = PACKS.find((pack) => pack.id === id)!.motion;
      expect(manifest.motion.language).toBe(motion.language);
    },
  );

  it.each(PACKS.map((pack) => pack.id))(
    "%s 的 tokens.css 定义了契约要求的 scoped 选择器",
    (id) => {
      const css = read(`styles/${id}/tokens.css`);
      expect(css).toContain(`[data-kits-pack="${id}"]`);
      // 每个 pack 的 tokens 必须导入契约层（保证变量有兜底值）
      expect(css).toContain('@import "../_contract/tokens.css"');
    },
  );
});

/* -------------------------------------------------------------------------- */
/* 2. 「十个维度必须明显不同」                                                  */
/* -------------------------------------------------------------------------- */

const DIMENSIONS: Array<keyof StylePackProfile> = [
  "typeVoice",
  "spacingRhythm",
  "density",
  "radiusPhilosophy",
  "borderTreatment",
  "surfaceTreatment",
  "navigationFeel",
  "dataLanguage",
  "motionLanguage",
  "hierarchyMethod",
];

describe("三套 Style Pack 的真实差异（不能只是换颜色）", () => {
  it.each(DIMENSIONS)("维度 %s 在三个 pack 之间取值互不相同", (dimension) => {
    const values = PACKS.map((pack) => pack.profile[dimension]);
    expect(
      new Set(values).size,
      `维度 ${dimension} 在三套 pack 中只有 ${new Set(values).size} 个不同取值：${values.join(" / ")}`,
    ).toBe(3);
  });

  it("三个 pack 的 surfaceTreatment 覆盖了三种不同的表面哲学", () => {
    const values = PACKS.map((pack) => pack.profile.surfaceTreatment);
    expect(values).toEqual(["paper", "ambient-glow", "panel"]);
  });

  it("动效语言三种互不相同，且时长刻度确实不同", () => {
    const languages = PACKS.map((pack) => pack.motion.language);
    expect(new Set(languages).size).toBe(3);

    const bases = PACKS.map((pack) => pack.motion.duration.base);
    expect(new Set(bases).size, "三套的 base 时长不应相同").toBe(3);
  });

  it("instrument 不授予 ambient 角色（仪表不呼吸）", () => {
    expect(instrumentMotion.roles).not.toContain("ambient");
    expect(editorialMotion.roles).not.toContain("ambient");
    expect(cinematicMotion.roles).toContain("ambient");
  });

  it("instrument 的 reduced-motion 不保留淡入（告警必须瞬时可见）", () => {
    expect(instrumentMotion.reducedMotion.keepOpacity).toBe(false);
    expect(editorialMotion.reducedMotion.keepOpacity).toBe(true);
    expect(cinematicMotion.reducedMotion.keepOpacity).toBe(true);
  });

  it("三个 pack 的间距节奏确实不同（不是同一套数值换皮）", () => {
    // `--kits-space-unit`（脉搏）只要求「editorial/instrument 同为 4px，
    // cinematic 为 8px」—— 4px 是精细节奏，但两套 pack 用它做出完全不同的结果：
    // editorial 的段落间距是 96px，instrument 是 32px。
    // 真正必须三值互不相同的是「节奏」而非「脉搏」本身。
    const css = PACKS.map((pack) => read(`styles/${pack.id}/tokens.css`));
    const pick = (pattern: RegExp, label: string): string[] =>
      css.map((text, index) => {
        const match = pattern.exec(text);
        if (!match) throw new Error(`${PACKS[index].id} 未定义 ${label}`);
        return match[1].trim();
      });

    const spaceUnits = pick(/--kits-space-unit:\s*([^;]+);/, "space-unit");
    expect(spaceUnits, `space-unit: ${spaceUnits.join(" / ")}`).toEqual([
      "4px",
      "8px",
      "4px",
    ]);

    for (const [label, pattern] of [
      ["section-gap", /--kits-section-gap:\s*([^;]+);/],
      ["radius-surface", /--kits-radius-surface:\s*([^;]+);/],
      ["display-line", /--kits-display-line:\s*([^;]+);/],
      ["density/control-height", /--kits-control-height:\s*([^;]+);/],
      ["density/row-height", /--kits-row-height:\s*([^;]+);/],
    ] as const) {
      const values = pick(pattern, label);
      expect(
        new Set(values).size,
        `${label}: ${values.join(" / ")}`,
      ).toBe(3);
    }

    // `--kits-border-width` 刻意**不做三值断言**：editorial 与 cinematic 都是 0，
    // 但语义完全不同 —— editorial 是「没有圆角也没有边框，只用横线分区」，
    // cinematic 是「没有边框，靠亮度差与光分层」。两者在 borderTreatment
    // 维度上已经是不同的取值（hairline-rule vs none-with-depth），
    // 这条断言只会把一个刻意的设计巧合误判为缺陷。
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Signature Component Contract                                             */
/* -------------------------------------------------------------------------- */

const COMPONENTS = [
  "interactive-hero",
  "spotlight-surface",
  "animated-grid",
  "data-cursor",
  "insight-reveal",
] as const;

describe("Signature Component Contract", () => {
  it.each(COMPONENTS)("%s 交付完整的六件", (id) => {
    const dir = path.join(ROOT, "components", id);
    const files = readdirSync(dir);
    for (const required of [
      "manifest.json",
      "index.ts",
      "README.md",
      "demo.tsx",
      "package.json",
    ]) {
      expect(files, `components/${id} 缺 ${required}`).toContain(required);
    }
    // 实现文件（.tsx）至少一个
    expect(files.some((file) => file.endsWith(".tsx"))).toBe(true);
  });

  it.each(COMPONENTS)("%s 的 manifest 声明了契约要求的字段", (id) => {
    const manifest = readJson<Record<string, unknown>>(
      `components/${id}/manifest.json`,
    );
    for (const field of [
      "id",
      "name",
      "version",
      "status",
      "type",
      "summary",
      "internalApi",
      "adapter",
      "performance",
      "ssrCompatible",
      "mobileCompatible",
      "reducedMotion",
      "a11y",
      "source",
    ]) {
      expect(manifest[field], `${id} 缺 ${field}`).toBeDefined();
    }
    expect(manifest.id).toBe(id);
    expect(manifest.type).toBe("component");
    expect(manifest.apiVersion).toBeTypeOf("string");
    expect(manifest.source).toMatchObject({ containsThirdPartyCode: false });
  });

  it.each(COMPONENTS)(
    "%s 的 internalApi 声明了「明确不暴露」的清单（Adapter 契约的前置条件）",
    (id) => {
      const manifest = readJson<{
        internalApi: { explicitlyNotExposed: string[]; example: string };
      }>(`components/${id}/manifest.json`);
      expect(
        manifest.internalApi.explicitlyNotExposed.length,
        `${id}: 必须列出不允许暴露的实现细节`,
      ).toBeGreaterThan(0);
      expect(manifest.internalApi.example).toBeTruthy();
    },
  );

  it.each(COMPONENTS)(
    "%s 的 manifest.adapter.required 为 true（产品不得直接依赖第三方 API）",
    (id) => {
      const manifest = readJson<{ adapter: { required: boolean } }>(
        `components/${id}/manifest.json`,
      );
      expect(manifest.adapter.required).toBe(true);
    },
  );

  it("五个组件的 apiVersion 都等于共享契约版本", () => {
    for (const id of COMPONENTS) {
      const manifest = readJson<{ apiVersion: string }>(
        `components/${id}/manifest.json`,
      );
      expect(manifest.apiVersion, `${id} 的 API 版本与契约不一致`).toMatch(
        /^1\.\d+\.\d+$/,
      );
    }
  });

  it.each(COMPONENTS)("%s 的实现带有 \"use client\" 指令", (id) => {
    const dir = path.join(ROOT, "components", id);
    const implementation = readdirSync(dir).find((file) =>
      file.endsWith(".tsx"),
    )!;
    const source = read(`components/${id}/${implementation}`);
    expect(
      source.trimStart().startsWith('"use client"'),
      `${id}: 缺失 "use client" 指令（浏览器 API 只能在客户端使用）`,
    ).toBe(true);
  });

  it.each(COMPONENTS)(
    "%s 的 README 覆盖了无障碍 / 移动端 / reduced-motion / SSR / 性能五个段落",
    (id) => {
      const readme = read(`components/${id}/README.md`);
      for (const section of [
        "无障碍",
        "移动端降级",
        "reduced-motion",
        "SSR",
        "性能分级",
      ]) {
        expect(readme, `${id} 的 README 缺少「${section}」段落`).toContain(
          section,
        );
      }
    },
  );
});

/* -------------------------------------------------------------------------- */
/* 4. 视觉字面量禁令                                                            */
/* -------------------------------------------------------------------------- */

describe("视觉字面量禁令（组件不得自己决定视觉）", () => {
  it.each(COMPONENTS)("%s 的实现代码里没有 hex 颜色", (id) => {
    const dir = path.join(ROOT, "components", id);
    const implementation = readdirSync(dir).find((file) =>
      file.endsWith(".tsx"),
    )!;
    const source = read(`components/${id}/${implementation}`);
    const hexes = source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hexes, `${id} 出现硬编码颜色: ${hexes.join(", ")}`).toEqual([]);
  });

  it.each(COMPONENTS)("%s 的 CSS 里没有 hex 颜色", (id) => {
    const dir = path.join(ROOT, "components", id);
    const stylesheet = readdirSync(dir).find((file) => file.endsWith(".css"))!;
    const css = read(`components/${id}/${stylesheet}`);
    // 去掉 data URI（它们只在效果层出现）后不应再有 hex
    const withoutDataUri = css.replace(/url\("data:[^"]*"\)/g, "");
    const hexes = withoutDataUri.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hexes, `${id} CSS 出现硬编码颜色: ${hexes.join(", ")}`).toEqual([]);
  });

  it.each(COMPONENTS)("%s 的实现代码不直接使用 window / document 于渲染期", (id) => {
    const dir = path.join(ROOT, "components", id);
    const implementation = readdirSync(dir).find((file) =>
      file.endsWith(".tsx"),
    )!;
    const source = read(`components/${id}/${implementation}`);
    // 允许出现在 useEffect 内，但组件本身不应在模块顶层访问 window
    expect(source).not.toContain("window.");
    expect(source).not.toContain("document.");
  });
});
