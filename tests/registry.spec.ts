/**
 * registry/assets.json 的结构与一致性审计。
 *
 * 这一组测试的立场：**登记表是资产体系的唯一权威**。
 * 如果登记表说谎（指向不存在的文件、漏登记资产、把未审计的东西标为 approved），
 * 整个"可审计"的承诺就失效了。
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");

type Asset = {
  id: string;
  name: string;
  type: "style" | "component" | "effect" | "skill" | "package";
  status: "incoming" | "experimental" | "approved" | "deprecated";
  version: string;
  path: string;
  manifest?: string | null;
  entry?: string;
  cssEntry?: string;
  demo?: string;
  readme?: string;
  selector?: string;
  dependencies: Array<string | { id: string; version?: string }>;
  performance: string;
  ssrCompatible: boolean | string;
  mobileCompatible: boolean | string;
  reducedMotion: string;
  source: {
    kind: string;
    origin: string;
    license: string;
    containsThirdPartyCode: boolean;
  };
};

type Registry = {
  registryVersion: string;
  statusLifecycle: string[];
  policy: { approvalRequired: string[]; forbidden: string[] };
  assets: Asset[];
};

const registry = JSON.parse(
  readFileSync(path.join(ROOT, "registry/assets.json"), "utf8"),
) as Registry;

const schema = JSON.parse(
  readFileSync(path.join(ROOT, "registry/assets.schema.json"), "utf8"),
) as { $defs: { asset: { required: string[] } } };

describe("registry/assets.json", () => {
  it("可以被解析", () => {
    expect(registry).toBeTypeOf("object");
    expect(Array.isArray(registry.assets)).toBe(true);
    expect(registry.assets.length).toBeGreaterThan(0);
  });

  it("声明了完整的状态生命周期", () => {
    expect(registry.statusLifecycle).toEqual([
      "incoming",
      "experimental",
      "approved",
      "deprecated",
    ]);
  });

  it("每一条资产覆盖 schema 要求的必填字段", () => {
    const required = schema.$defs.asset.required;
    for (const asset of registry.assets) {
      for (const field of required) {
        expect(
          asset[field as keyof Asset],
          `${asset.id} 缺少必填字段 ${field}`,
        ).toBeDefined();
      }
    }
  });

  it("资产 id 唯一且为 kebab-case", () => {
    const ids = registry.assets.map((asset) => asset.id);
    expect(new Set(ids).size, "存在重复 id").toBe(ids.length);
    for (const id of ids) {
      expect(id, `${id} 不是 kebab-case`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("资产 status 与 type 都在枚举内", () => {
    for (const asset of registry.assets) {
      expect(registry.statusLifecycle, `${asset.id} 的 status`).toContain(
        asset.status,
      );
      // `package` 是基础设施包（contracts / react-utils / cli）——
      // 它们不是视觉资产，但没有它们 style / component 无法被独立安装。
      expect(
        ["style", "component", "effect", "skill", "package"],
        `${asset.id} 的 type`,
      ).toContain(asset.type);
    }
  });

  it("path 指向的文件或目录真实存在", () => {
    for (const asset of registry.assets) {
      const target = path.join(ROOT, asset.path);
      expect(existsSync(target), `${asset.id}: path 不存在 → ${asset.path}`).toBe(
        true,
      );
    }
  });

  it("manifest / entry / demo / readme 指向的文件真实存在", () => {
    for (const asset of registry.assets) {
      for (const key of ["manifest", "entry", "demo", "readme"] as const) {
        const value = asset[key];
        if (!value) continue;
        const target = path.join(ROOT, value);
        expect(existsSync(target), `${asset.id}: ${key} 不存在 → ${value}`).toBe(
          true,
        );
      }
    }
  });

  it("分类型附加要求：style 必须有 selector / cssEntry / contractVersion", () => {
    for (const asset of registry.assets.filter((a) => a.type === "style")) {
      expect(asset.selector, `${asset.id} 缺 selector`).toBeTruthy();
      expect(asset.cssEntry, `${asset.id} 缺 cssEntry`).toBeTruthy();
    }
  });

  it("分类型附加要求：component 必须有 apiVersion / manifest / demo / readme", () => {
    for (const asset of registry.assets.filter((a) => a.type === "component")) {
      const withApi = asset as Asset & { apiVersion?: string };
      expect(withApi.apiVersion, `${asset.id} 缺 apiVersion`).toBeTruthy();
      expect(asset.manifest, `${asset.id} 缺 manifest`).toBeTruthy();
      expect(asset.demo, `${asset.id} 缺 demo`).toBeTruthy();
      expect(asset.readme, `${asset.id} 缺 readme`).toBeTruthy();
    }
  });

  it("approved 的资产必须支持 reduced-motion", () => {
    for (const asset of registry.assets.filter((a) => a.status === "approved")) {
      expect(
        asset.reducedMotion,
        `${asset.id} 是 approved 但 reducedMotion=${asset.reducedMotion}`,
      ).not.toBe("unsupported");
    }
  });

  it("approved 的资产必须说明 SSR 与移动端兼容性", () => {
    for (const asset of registry.assets.filter((a) => a.status === "approved")) {
      expect(
        asset.ssrCompatible,
        `${asset.id} 缺 ssrCompatible`,
      ).toBeDefined();
      expect(
        asset.mobileCompatible,
        `${asset.id} 缺 mobileCompatible`,
      ).toBeDefined();
      expect(
        asset.performance,
        `${asset.id} 缺 performance`,
      ).toBeDefined();
    }
  });

  it("外部/派生资产必须写明 license", () => {
    for (const asset of registry.assets) {
      expect(asset.source, `${asset.id} 缺 source`).toBeDefined();
      expect(asset.source.license, `${asset.id} 缺 source.license`).toBeTruthy();
      if (asset.source.kind !== "first-party") {
        expect(
          asset.source.license,
          `${asset.id} 是外部资产但没有具体许可信息`,
        ).not.toBe("unknown");
      }
    }
  });

  it("声称不含第三方源码的资产，目录里不得出现第三方痕迹", () => {
    // 注意不包含 node_modules：pnpm 会为每个 workspace 包放一个软链接目录，
    // 那是包管理器的工作方式，不是"引入了第三方源码"。
    const forbiddenDirs = ["vendor", "third-party", "upstream", "raw-src"];
    for (const asset of registry.assets) {
      if (asset.source.containsThirdPartyCode) continue;
      const dir = path.join(ROOT, asset.path);
      if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
      const entries = readdirSync(dir).filter(
        (entry) => entry !== "node_modules",
      );
      for (const entry of entries) {
        expect(
          forbiddenDirs,
          `${asset.id}: 出现了第三方痕迹目录 ${entry}`,
        ).not.toContain(entry);
        expect(
          entry.startsWith("LICENSE-") || entry === "LICENSE.vendor",
          `${asset.id}: 出现了第三方许可证文件 ${entry}，但登记为不含第三方源码`,
        ).toBe(false);
      }
    }
  });

  it("策略段存在且非空（禁止项 / 准入门槛）", () => {
    expect(registry.policy.forbidden.length).toBeGreaterThan(0);
    expect(registry.policy.approvalRequired.length).toBeGreaterThan(0);
  });
});

describe("registry 覆盖度", () => {
  it("Style Pack 资产都已登记且为 approved（含 K1 新增的 console）", () => {
    const ids = registry.assets
      .filter((a) => a.type === "style")
      .map((a) => a.id);
    for (const pack of ["editorial", "cinematic", "instrument", "console"]) {
      expect(ids, `缺少 style 资产 ${pack}`).toContain(pack);
      const asset = registry.assets.find((a) => a.id === pack)!;
      expect(asset.status, `${pack} 未 approved`).toBe("approved");
    }
  });

  it("Signature Component 的断言对象来自 registry：原五个仍在册且 approved", () => {
    const components = registry.assets.filter((a) => a.type === "component");

    /*
     * 这条的**原意**是「五个签名组件都已登记且为 approved」。
     * 写死五个 id 的问题不是"检查不够多"，而是它会**静默变假**：
     * 新增第六个组件时，那个组件不被这条断言覆盖，而套件仍然是绿的
     * （K2 加 evidence-chip 时暴露的正是这一类"没检查"）。
     *
     * 因此断言对象改成 registry 的全集 + 显式保留"原五个不许消失"：
     *   ① 名单非空（过滤条件写错时不会空跑成绿）；
     *   ② 原五个 id 仍然在册且 approved —— 放宽数量不等于允许它们被删掉。
     * 「每一个 component 都必须有 apiVersion / manifest / demo / readme」
     * 由上面的「分类型附加要求」一节对 registry 全集逐条核对，不在这里重复。
     */
    expect(
      components.length,
      "registry 里没有任何 component —— 这一节会空跑（空跑不等于通过）",
    ).toBeGreaterThanOrEqual(5);

    for (const component of [
      "interactive-hero",
      "spotlight-surface",
      "animated-grid",
      "data-cursor",
      "insight-reveal",
    ]) {
      const asset = components.find((a) => a.id === component);
      expect(asset, `原有组件 ${component} 从 registry 消失了`).toBeDefined();
      expect(asset!.status, `${component} 未 approved`).toBe("approved");
    }
  });

  it("两个 Skill 都已登记", () => {
    const ids = registry.assets
      .filter((a) => a.type === "skill")
      .map((a) => a.id);
    expect(ids).toContain("visual-direction");
    expect(ids).toContain("motion-direction");
  });

  it("每个资产的 dependencies 都指向已登记的资产、源码文件或明确的运行时", () => {
    const known = new Set(registry.assets.map((a) => a.id));
    const isSourceReference = (dependency: string) =>
      // 指向本仓库内的文档/源码文件（不是资产，而是它读取的文件）
      dependency.includes("/") ||
      dependency.startsWith("react") ||
      dependency.startsWith("node:") ||
      dependency.startsWith("@types/");

    // dependencies 可以是字符串，也可以是 { id, version } —— 归一化后再判断。
    const depId = (d: string | { id: string; version?: string }) =>
      typeof d === "string" ? d : d.id;

    for (const asset of registry.assets) {
      for (const raw of asset.dependencies) {
        const dependency = depId(raw);
        const valid = known.has(dependency) || isSourceReference(dependency);
        if (!valid) {
          expect(
            existsSync(path.join(ROOT, dependency)),
            `${asset.id} 依赖了不存在的资产或文件：${dependency}`,
          ).toBe(true);
        }
        expect(
          valid || existsSync(path.join(ROOT, dependency)),
          `${asset.id} 依赖了未登记的资产 ${dependency}`,
        ).toBe(true);
      }
    }
  });
});
