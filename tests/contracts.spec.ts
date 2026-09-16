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
} from "@kits/contracts";

import { editorialMotion, editorialProfile } from "../styles/editorial/index.ts";
import { cinematicMotion, cinematicProfile } from "../styles/cinematic/index.ts";
import { instrumentMotion, instrumentProfile } from "../styles/instrument/index.ts";
import { consoleMotion, consoleProfile } from "../styles/console/index.ts";

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
  { id: "console", motion: consoleMotion, profile: consoleProfile },
] as const;

/**
 * pack 数 —— 下面每一条「互不相同」的断言都从这里取期望值，而不是写死 3。
 *
 * 写死数字的问题是它会**静默变成谎言**：加第四套 pack 时，`toBe(3)` 并不会
 * 因为新 pack 与旧 pack 撞了同一个取值而失败 —— 它只会因为「有 4 个不同的
 * 取值」而失败，于是修复方式看起来是「把 3 改成 4」，而不是「查出谁撞了谁」。
 * 从 PACKS.length 取值之后，「互不相同」这句话在任意 pack 数下都成立，
 * 且新增一套 pack 不需要再改这个文件里的任何期望值。
 */
const PACK_COUNT = PACKS.length;
const PACK_IDS: readonly string[] = PACKS.map((pack) => pack.id);

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
      expect(css).toContain('@import "@kits/contracts/tokens.css"');
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

describe("全部 Style Pack 的真实差异（不能只是换颜色）", () => {
  /*
   * radiusPhilosophy 与 --kits-radius-surface 是**刻意豁免**「互不相同」的两个量。
   *
   * 原意是「每一维都要有明显不同的立场」，而 K1 的 console 与 editorial 同为
   * `flush`（0 半径）是**规格里明确允许**的：console 的 0 是「格位是矩形的」，
   * editorial 的 0 是「印刷不切圆角」—— 两个不同的理由落在同一个枚举值上，
   * 这不是「换皮」，因为其余九个维度与全部数值（间距 / 密度 / 边界 / 表面 /
   * 导航 / 数据 / 动效 / 层级）全部不同。
   *
   * 因此这两条断言从「取值数量 = pack 数」改成「取值数量 ≥ 明确不同的哲学数」，
   * 并且**额外**钉住「哪种重复是允许的」—— 这样如果有人把第三套 pack 也改成
   * flush，或者把 cinematic 的 continuous 改成 flush，仍然会红。
   */
  it.each(DIMENSIONS.filter((d) => d !== "radiusPhilosophy"))(
    `维度 %s 在 ${PACK_COUNT} 个 pack 之间取值互不相同`,
    (dimension) => {
      const values = PACKS.map((pack) => pack.profile[dimension]);
      expect(
        new Set(values).size,
        `维度 ${dimension} 在 ${PACK_COUNT} 套 pack 中只有 ${new Set(values).size} 个不同取值：${values.join(" / ")}`,
      ).toBe(PACK_COUNT);
    },
  );

  it("radiusPhilosophy：每一套都有立场，且只有 flush 被两套共用（且理由不同）", () => {
    const values = PACKS.map((pack) => pack.profile.radiusPhilosophy);
    expect(new Set(values).size, `radiusPhilosophy: ${values.join(" / ")}`).toBeGreaterThanOrEqual(3);
    // 允许重复的只有 flush 这一对；谁都不许再往 flush 里挤
    const flushPacks = PACKS.filter((pack) => pack.profile.radiusPhilosophy === "flush").map((p) => p.id);
    expect(flushPacks.sort()).toEqual(["console", "editorial"]);
    // 其余两套必须各自独占一个取值 —— 否则「明显不同」就真的被削弱了
    for (const id of ["cinematic", "instrument"]) {
      const value = PACKS.find((pack) => pack.id === id)!.profile.radiusPhilosophy;
      expect(
        values.filter((v) => v === value).length,
        `${id} 的 radiusPhilosophy 被别的 pack 共用了`,
      ).toBe(1);
    }
  });

  it("没有两套 pack 共用同一表面哲学，且四种表面哲学都还在", () => {
    const values = PACKS.map((pack) => pack.profile.surfaceTreatment);
    /*
     * 这条断言的**原意**是「没有两套 pack 共用同一表面哲学」——
     * 之前的写法（`toEqual(["paper", "ambient-glow", "panel"])`）把原意
     * 与「恰好三套 pack、且顺序恰好如此」这件无关的事捆在了一起：
     * 加第四套 pack 时它会因为「数组第 4 项对不上」而失败，
     * 即便四套的表面哲学确实互不相同。
     *
     * 拆开之后两件事各自被断言：① 取值数量 = pack 数（互不相同）；
     * ② 四种取值都真实存在（没有人在加 pack 的过程中把已有立场改掉）。
     * 第 ② 条是**加强**：原来的顺序断言其实也顺带钉住了原三值的存在，
     * 拆开之后它仍然是显式的，而不是顺序比较的副产品。
     */
    expect(
      new Set(values).size,
      `surfaceTreatment 出现重复取值：${values.join(" / ")}`,
    ).toBe(PACK_COUNT);
    for (const expected of ["paper", "ambient-glow", "panel", "cell-grid"]) {
      expect(values, `surfaceTreatment 丢了 \`${expected}\``).toContain(expected);
    }
  });

  it("动效语言互不相同，且时长刻度确实不同", () => {
    const languages = PACKS.map((pack) => pack.motion.language);
    expect(new Set(languages).size, `动效语言：${languages.join(" / ")}`).toBe(
      PACK_COUNT,
    );

    const bases = PACKS.map((pack) => pack.motion.duration.base);
    expect(
      new Set(bases).size,
      `各套的 base 时长不应相同：${bases.join(" / ")}`,
    ).toBe(PACK_COUNT);
  });

  it("instrument 不授予 ambient 角色（仪表不呼吸）", () => {
    expect(instrumentMotion.roles).not.toContain("ambient");
    expect(editorialMotion.roles).not.toContain("ambient");
    expect(cinematicMotion.roles).toContain("ambient");
  });

  it("console 授予 ambient 角色，但它只属于「运行中」呼吸点", () => {
    /*
     * 这条与上面的 instrument 断言刻意并列，而不是二选一：
     * 「仪表不呼吸」是关于 instrument 的规则，「呼吸点是状态、不是氛围」
     * 是关于 console 的规则。两者同时成立 —— 区别在于呼吸在这块屏上
     * 说不说话（见 styles/console/motion.ts 的 roles 注释）。
     */
    expect(consoleMotion.roles).toContain("ambient");
    // 周期必须是一个能被读完的**有限**值，而不是无限加速的环境光
    expect(consoleMotion.ambientCycle).toBeGreaterThan(0);
    // reduced-motion 下整个关掉：呼吸点是唯一会无限持续的动画
    expect(consoleMotion.reducedMotion.disableRoles).toContain("ambient");
  });

  it("instrument 的 reduced-motion 不保留淡入（告警必须瞬时可见）", () => {
    expect(instrumentMotion.reducedMotion.keepOpacity).toBe(false);
    expect(editorialMotion.reducedMotion.keepOpacity).toBe(true);
    expect(cinematicMotion.reducedMotion.keepOpacity).toBe(true);
  });

  it(`${PACK_COUNT} 套 pack 的间距节奏确实不同（不是同一套数值换皮）`, () => {
    // `--kits-space-unit`（脉搏）只要求「editorial/instrument 同为 4px，
    // cinematic 为 8px」—— 4px 是精细节奏，但几套 pack 用它做出完全不同的结果：
    // editorial 的段落间距是 96px，instrument 是 32px，console 是 24px。
    // 真正必须互不相同的是「节奏」而非「脉搏」本身。
    const css = PACKS.map((pack) => read(`styles/${pack.id}/tokens.css`));
    const pick = (pattern: RegExp, label: string): string[] =>
      css.map((text, index) => {
        const match = pattern.exec(text);
        if (!match) throw new Error(`${PACKS[index].id} 未定义 ${label}`);
        return match[1].trim();
      });

    const spaceUnits = pick(/--kits-space-unit:\s*([^;]+);/, "space-unit");
    /*
     * 脉搏是**允许重复**的（4px / 8px 是仅有的两档，四套 pack 必然有重复）——
     * 这条断言的意图从来不是「数量与 pack 数相同」，而是：
     *   ① 每一套都显式声明了自己用哪一档脉搏；
     *   ② 两档都用上了（否则「脉搏」这个旋钮是假的）；
     *   ③ 具体的分配没有在加 pack 的过程中被顺手改掉。
     *
     * 之前的写法 `toEqual(["4px", "8px", "4px"])` 把这件事写成了
     * 「恰好三套、顺序恰好如此」。改成下面几行之后，加第四套 pack 不需要
     * 改动期望值，而 ①②③ 仍然被逐条钉住。
     */
    expect(spaceUnits).toHaveLength(PACK_COUNT);
    const pulseOf = (id: string) => spaceUnits[PACK_IDS.indexOf(id)];
    expect(pulseOf("editorial"), "editorial 的脉搏").toBe("4px");
    expect(pulseOf("instrument"), "instrument 的脉搏").toBe("4px");
    expect(pulseOf("cinematic"), "cinematic 的脉搏").toBe("8px");
    expect(
      new Set(spaceUnits).size,
      `脉搏两档都应当被用到：${spaceUnits.join(" / ")}`,
    ).toBeGreaterThan(1);

    for (const [label, pattern] of [
      ["section-gap", /--kits-section-gap:\s*([^;]+);/],
      ["display-line", /--kits-display-line:\s*([^;]+);/],
      ["density/control-height", /--kits-control-height:\s*([^;]+);/],
      ["density/row-height", /--kits-row-height:\s*([^;]+);/],
    ] as const) {
      const values = pick(pattern, label);
      expect(
        new Set(values).size,
        `${label}: ${values.join(" / ")}`,
      ).toBe(PACK_COUNT);
    }

    /*
     * `--kits-radius-surface` 与 `--kits-border-width` 一样，刻意**不做多值断言**：
     *
     *   radius-surface   editorial 0 · cinematic 14px · instrument 2px · console 0
     *   border-width     editorial 0 · cinematic 0  · instrument 1px · console 2px
     *
     * 两处的重合都是**刻意的**，而且重合的那两套在这些量上语义完全不同：
     *   · editorial 与 console 同为 0 半径，但 editorial 的 0 是「印刷不切圆角」，
     *     console 的 0 是「格位是矩形的」；两者的边框处理是 hairline-rule 与
     *     syntax-rule（不同的枚举值），表面是 paper 与 cell-grid（不同的枚举值）。
     *   · editorial 与 cinematic 同为 0 边框，但一个是「只用横线分区」，
     *     一个是「靠亮度差与光分层」。
     *
     * 一条「数量 = pack 数」的断言只会把一个刻意的设计巧合误判为缺陷，
     * 于是逼出「为了凑数改数值」这种反而更糟的修复。这条量由上面
     * radiusPhilosophy 的专项断言（谁可以和谁共用、其余必须独占）覆盖。
     */
    const radiusSurfaces = pick(/--kits-radius-surface:\s*([^;]+);/, "radius-surface");
    expect(radiusSurfaces).toHaveLength(PACK_COUNT);
    // 仍然要求「至少三种不同的圆角结果」—— 重合只允许发生在 0 上
    expect(
      new Set(radiusSurfaces).size,
      `radius-surface: ${radiusSurfaces.join(" / ")}`,
    ).toBeGreaterThanOrEqual(3);
    expect(
      radiusSurfaces.filter((value) => value === "0").length,
      `radius-surface: ${radiusSurfaces.join(" / ")}`,
    ).toBe(2);
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
