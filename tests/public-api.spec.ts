/**
 * 公开 API 与 React peer 策略。
 *
 * ===========================================================================
 * 这组测试锁定两个真实缺口
 * ===========================================================================
 *
 * **缺口 2 —— 契约的编译函数对消费方不可达**
 * `motionToCssVars()` 存在，但不在任何包的 exports 里；契约类型也没被
 * re-export。结果是产品把 13 行变量表**手抄**了一遍 —— 一次静默的脱钩。
 * 现在的规则：消费方需要的每一个契约符号，都必须能从一个公开入口拿到。
 *
 * **缺口 4 —— @types/react 版本漂移造成跨 repo TS2322**
 * 产品 19.2.18 / Kits 19.3.0 → Kits 自己的源文件在产品 tsc 里报
 * "Two different types with this name exist"。根因是依赖策略：
 * 组件既不该自带 React 副本，也不该在**没有** React 时无法自查。
 * 现在的规则：peer 声明支持区间、dev 声明自检副本、style pack 完全不碰 React。
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");
const readJson = (rel: string) =>
  JSON.parse(readFileSync(path.join(ROOT, rel), "utf8"));
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const COMPONENTS = [
  "interactive-hero",
  "spotlight-surface",
  "animated-grid",
  "data-cursor",
  "insight-reveal",
] as const;
const STYLE_PACKS = ["editorial", "cinematic", "instrument"] as const;

/* -------------------------------------------------------------------------- */
/* 缺口 2：公开 API                                                            */
/* -------------------------------------------------------------------------- */

describe("public API · @kits/contracts", () => {
  const pkg = readJson("packages/contracts/package.json");

  it("包名与导出的子路径稳定", () => {
    expect(pkg.name).toBe("@kits/contracts");
    expect(Object.keys(pkg.exports).sort()).toEqual(
      [".", "./contract", "./tokens.css"].sort(),
    );
  });

  it("exports 指向的文件都存在", () => {
    for (const target of Object.values(pkg.exports) as string[]) {
      expect(existsSync(path.join(ROOT, "packages/contracts", target))).toBe(true);
    }
  });

  it("index.ts 转发契约的全部公开符号", () => {
    const index = read("packages/contracts/index.ts");
    expect(index).toContain('export * from "./contract.ts"');
  });

  it("motionToCssVars 是公开导出（缺口 2 的核心）", async () => {
    const mod = await import("../packages/contracts/contract.ts");
    expect(typeof mod.motionToCssVars).toBe("function");
    expect(typeof mod.assertStylePackMotion).toBe("function");
  });

  it("动效变量表与契约层 tokens.css 的变量名一一对应", async () => {
    const { motionToCssVars, cinematicMotion } = (await import(
      "../packages/contracts/contract.ts"
    )) as unknown as {
      motionToCssVars: (m: unknown) => Record<string, string>;
      cinematicMotion: unknown;
    };
    const { cinematicMotion: packMotion } = await import(
      "../styles/cinematic/motion.ts"
    );
    void cinematicMotion;

    const vars = motionToCssVars(packMotion);
    const contractCss = read("packages/contracts/tokens.css");

    // 每一个被编译出来的变量，契约层的 tokens.css 都必须先声明过 ——
    // 否则它是"产品写了一个没人认识的变量名"，属于静默失效。
    const missing = Object.keys(vars).filter((name) => !contractCss.includes(name));
    expect(missing, "这些变量由 motionToCssVars 产出，但契约层没有声明").toEqual([]);
  });

  it("ASSET_TYPE 覆盖 registry 里出现的全部类型", () => {
    const registry = readJson("registry/assets.json") as {
      assets: Array<{ type: string }>;
    };
    const contract = read("packages/contracts/contract.ts");
    const types = new Set(registry.assets.map((a) => a.type));
    for (const type of types) {
      expect(contract, `契约的 ASSET_TYPE 缺少 "${type}"`).toContain(`"${type}"`);
    }
  });
});

describe("public API · 契约只有一份", () => {
  it("Style Pack Contract 不再有第二份副本", async () => {
    const reactUtilsContract = read("packages/react-utils/contract.ts");
    // 这些符号只能存在于 @kits/contracts
    for (const symbol of [
      "motionToCssVars",
      "assertStylePackMotion",
      "StylePackMotion",
      "StylePackProfile",
      "RADIUS_PHILOSOPHY",
      "MOTION_ROLES",
    ]) {
      const code = reactUtilsContract
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
      expect(
        code.includes(symbol),
        `react-utils/contract.ts 里又出现了 "${symbol}" —— 契约必须只有一份`,
      ).toBe(false);
    }
  });

  it("消费方不需要手抄变量表：契约存在时编译函数可用", async () => {
    const mod = (await import("../packages/contracts/contract.ts")) as unknown as {
      motionToCssVars: (m: unknown) => Record<string, string>;
    };
    const { editorialMotion } = await import("../styles/editorial/motion.ts");
    const vars = mod.motionToCssVars(editorialMotion);
    expect(vars["--kits-dur-base"]).toMatch(/ms$/);
    expect(vars["--kits-pointer-factor"]).toBeDefined();
  });
});

/* -------------------------------------------------------------------------- */
/* 缺口 4：React peer 策略                                                     */
/* -------------------------------------------------------------------------- */

describe("React peer 策略", () => {
  it("style pack 完全不声明 React（它们一行 React 都没用）", () => {
    for (const pack of STYLE_PACKS) {
      const pkg = readJson(`styles/${pack}/package.json`);
      expect(
        pkg.peerDependencies?.react,
        `${pack} 声明了 React —— 但 style pack 不需要它`,
      ).toBeUndefined();
      expect(pkg.dependencies?.react).toBeUndefined();
    }
  });

  it("style pack 的源码里没有任何 react import", () => {
    for (const pack of STYLE_PACKS) {
      for (const file of ["index.ts", "motion.ts"]) {
        const content = read(`styles/${pack}/${file}`);
        expect(
          /from\s+["']react["']/.test(content),
          `styles/${pack}/${file} 引入了 react`,
        ).toBe(false);
      }
    }
  });

  it("组件把 react / react-dom 声明为 peer，而不是自带副本", () => {
    for (const component of COMPONENTS) {
      const pkg = readJson(`components/${component}/package.json`);
      expect(pkg.peerDependencies?.react, `${component} 缺少 react peer`).toBeTruthy();
      expect(
        pkg.peerDependencies?.["react-dom"],
        `${component} 缺少 react-dom peer`,
      ).toBeTruthy();
      // 自带副本会在同一次编译里造出第二份 VoidOrUndefinedOnly
      expect(pkg.dependencies?.react, `${component} 不应自带 react 副本`).toBeUndefined();
      expect(
        pkg.dependencies?.["react-dom"],
        `${component} 不应自带 react-dom 副本`,
      ).toBeUndefined();
    }
  });

  it("peer 区间覆盖 React 18 与 19", () => {
    for (const component of COMPONENTS) {
      const range = readJson(`components/${component}/package.json`).peerDependencies
        .react as string;
      expect(range, `${component} 的 react peer 区间`).toContain("^18");
      expect(range, `${component} 的 react peer 区间`).toContain("^19");
    }
  });

  it("组件在 devDependencies 里放一份 @types/react 以便自检", () => {
    for (const component of COMPONENTS) {
      const pkg = readJson(`components/${component}/package.json`);
      expect(
        pkg.devDependencies?.["@types/react"],
        `${component} 没有 devDependencies["@types/react"]，本仓库就无法类型检查它的源码`,
      ).toBeTruthy();
    }
  });

  it("react-utils 的 peer 与组件一致", () => {
    const pkg = readJson("packages/react-utils/package.json");
    expect(pkg.peerDependencies.react).toBe("^18.0.0 || ^19.0.0");
  });

  it("contracts 不带任何依赖（纯 TS，零 React）", () => {
    const pkg = readJson("packages/contracts/package.json");
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.peerDependencies).toBeUndefined();
    expect(pkg.devDependencies).toBeUndefined();
  });
});

describe("React peer 策略 · doctor 能发现漂移", () => {
  it("auditCompatibility 在 @types/react major 不一致时给出 fail 与修法", async () => {
    const { auditCompatibility } = (await import(
      "../packages/cli/lib/compat.mjs"
    )) as unknown as {
      auditCompatibility: (
        root: string,
        kits: { kitsReactTypesVersion?: string; kitsTypesMajor?: number },
      ) => {
        ok: boolean;
        checks: Array<{ id: string; status: string; detail: string; hint?: string }>;
      };
    };

    // 用本仓库当目标：它的 @types/react 是 19.x
    const sameMajor = auditCompatibility(ROOT, {
      kitsReactTypesVersion: "19.3.0",
      kitsTypesMajor: 19,
    });
    expect(
      sameMajor.checks.find((c) => c.id === "react-types-major-parity")?.status,
    ).toBe("pass");

    const drifted = auditCompatibility(ROOT, {
      kitsReactTypesVersion: "20.0.0",
      kitsTypesMajor: 20,
    });
    const check = drifted.checks.find((c) => c.id === "react-types-major-parity");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("漂移");
    // 错误信息必须给出修法，而不是只报不兼容
    expect(check?.hint).toBeTruthy();
    expect(drifted.ok).toBe(false);
  });

  it("auditCompatibility 在 react 缺失时失败", async () => {
    const { auditCompatibility } = (await import(
      "../packages/cli/lib/compat.mjs"
    )) as unknown as {
      auditCompatibility: (
        root: string,
        kits: Record<string, never>,
      ) => { ok: boolean };
    };
    const result = auditCompatibility(path.join(ROOT, "nonexistent-product"), {});
    expect(result.ok).toBe(false);
  });
});

describe("registry 的可安装面", () => {
  it("三个基础设施包都被登记为 approved", () => {
    const registry = readJson("registry/assets.json") as {
      assets: Array<{ id: string; type: string; status: string }>;
    };
    for (const id of ["contracts", "react-utils", "cli"]) {
      const asset = registry.assets.find((a) => a.id === id);
      expect(asset, `${id} 没有登记`).toBeTruthy();
      expect(asset?.type).toBe("package");
      expect(asset?.status).toBe("approved");
    }
  });

  it("每个 style pack 与 component 都声明了自己的依赖", () => {
    const registry = readJson("registry/assets.json") as {
      assets: Array<{ id: string; type: string; dependencies?: unknown[] }>;
    };
    for (const asset of registry.assets) {
      if (asset.type === "style") {
        expect(
          asset.dependencies,
          `style pack ${asset.id} 依赖 @kits/contracts，必须显式声明`,
        ).toContain("contracts");
      }
      if (asset.type === "component") {
        expect(
          asset.dependencies,
          `component ${asset.id} 依赖 @kits/react-utils，必须显式声明`,
        ).toContain("react-utils");
      }
    }
  });

  it("每个可安装资产都声明了所属包与文件清单（或是一个包目录）", () => {
    const registry = readJson("registry/assets.json") as {
      assets: Array<{ id: string; type: string; path: string; files?: string[] }>;
    };
    for (const asset of registry.assets) {
      if (!["style", "component", "effect", "package"].includes(asset.type)) continue;
      expect(asset.path, `${asset.id} 缺少 path`).toBeTruthy();
      const abs = path.join(ROOT, asset.path);
      expect(existsSync(abs), `${asset.id} 的 path 不存在：${asset.path}`).toBe(true);
      // effect 共享一个包，因此必须给出显式文件清单
      if (asset.type === "effect") {
        expect(asset.files?.length, `effect ${asset.id} 需要显式 files 清单`).toBeGreaterThan(0);
      }
    }
  });
});
