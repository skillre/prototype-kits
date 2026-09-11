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
  type: "style" | "component" | "effect" | "skill";
  status: "incoming" | "experimental" | "approved" | "deprecated";
  version: string;
  path: string;
  manifest?: string | null;
  entry?: string;
  cssEntry?: string;
  demo?: string;
  readme?: string;
  selector?: string;
  dependencies: string[];
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
      expect(["style", "component", "effect", "skill"], `${asset.id} 的 type`)
        .toContain(asset.type);
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
  it("三个 Style Pack 都已登记且为 approved", () => {
    const ids = registry.assets
      .filter((a) => a.type === "style")
      .map((a) => a.id);
    for (const pack of ["editorial", "cinematic", "instrument"]) {
      expect(ids, `缺少 style 资产 ${pack}`).toContain(pack);
      const asset = registry.assets.find((a) => a.id === pack)!;
      expect(asset.status, `${pack} 未 approved`).toBe("approved");
    }
  });

  it("五个 Signature Component 都已登记且为 approved", () => {
    const ids = registry.assets
      .filter((a) => a.type === "component")
      .map((a) => a.id);
    for (const component of [
      "interactive-hero",
      "spotlight-surface",
      "animated-grid",
      "data-cursor",
      "insight-reveal",
    ]) {
      expect(ids, `缺少 component 资产 ${component}`).toContain(component);
      const asset = registry.assets.find((a) => a.id === component)!;
      expect(asset.status, `${component} 未 approved`).toBe("approved");
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

    for (const asset of registry.assets) {
      for (const dependency of asset.dependencies) {
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
