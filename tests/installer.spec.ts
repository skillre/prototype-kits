/**
 * Installer 规则审计。
 *
 * ===========================================================================
 * 这组测试对应「Installer Rules」的九条
 * ===========================================================================
 *   1. 只允许安装 registry 中 status=approved 的资产
 *   2. 自动解析依赖
 *   3. 校验 React / Next compatibility
 *   4. 校验 asset checksum
 *   5. 不覆盖未知人工修改
 *   6. 支持 dry-run
 *   7. 输出安装 diff（在 CLI 层，这里覆盖其数据来源）
 *   8. 重复运行尽可能 idempotent
 *   9. 失败时不留下半安装状态
 *
 * 禁止的是「cp -R 然后不记录状态」——
 * 因此每一条规则在这里都有一个**可执行的对手**，而不是一句承诺。
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");
const CLI = path.join(ROOT, "packages", "cli", "kits.mjs");

const TMP = path.join(ROOT, "node_modules", ".cache", "kits-installer-tests");

/** 一个最小可安装的产品：只需要 package.json（兼容性检查读它）。 */
function makeProduct(name: string, pkg: Record<string, unknown> = {}) {
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
        ...pkg,
      },
      null,
      2,
    ),
  );
  return dir;
}

function runCli(args: string[], cwd = ROOT, allowFail = false) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
  });
  if (result.status !== 0 && !allowFail) {
    throw new Error(
      `kits ${args.join(" ")} 失败（exit ${result.status}）\n${result.stdout}\n${result.stderr}`,
    );
  }
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

const installArgs = (target: string, extra: string[] = []) => [
  "add",
  "--target",
  target,
  "--style",
  "cinematic",
  "--components",
  "animated-grid,data-cursor,insight-reveal",
  "--effects",
  "ambient-glow",
  ...extra,
];

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

/* -------------------------------------------------------------------------- */
/* 规则 1：approved 门禁                                                       */
/* -------------------------------------------------------------------------- */

describe("规则 1 · 只允许安装 approved 资产", () => {
  it("registry 里全部可安装资产当前都是 approved（前置事实）", () => {
    const registry = JSON.parse(
      readFileSync(path.join(ROOT, "registry", "assets.json"), "utf8"),
    );
    const installable = registry.assets.filter((a: { type: string }) =>
      ["style", "component", "effect", "package"].includes(a.type),
    );
    expect(installable.length).toBeGreaterThan(0);
    for (const asset of installable) {
      expect(asset.status, `${asset.id} 不是 approved`).toBe("approved");
    }
  });

  it("门禁在读取层实现，因此所有命令共用同一判据", async () => {
    const mod = (await import("../packages/cli/lib/registry.mjs")) as unknown as {
      requireApproved: (
        m: Map<string, unknown>,
        id: string,
      ) => { id: string };
      INSTALLABLE_TYPES: string[];
      INSTALLABLE_STATUS: string;
    };
    expect(mod.INSTALLABLE_STATUS).toBe("approved");
    expect(mod.INSTALLABLE_TYPES).toContain("package");

    const fake = new Map([
      ["draft-asset", { id: "draft-asset", type: "component", status: "experimental" }],
      ["gone-asset", { id: "gone-asset", type: "component", status: "deprecated" }],
      ["ok-asset", { id: "ok-asset", type: "component", status: "approved" }],
      ["doc-asset", { id: "doc-asset", type: "skill", status: "approved" }],
    ]);

    expect(mod.requireApproved(fake, "ok-asset").id).toBe("ok-asset");

    expect(() => mod.requireApproved(fake, "draft-asset")).toThrowError(
      /只接受 approved/,
    );
    expect(() => mod.requireApproved(fake, "gone-asset")).toThrowError(
      /只接受 approved/,
    );
    // skill 是文档资产，不参与源码安装
    expect(() => mod.requireApproved(fake, "doc-asset")).toThrowError(
      /不参与源码安装/,
    );
    expect(() => mod.requireApproved(fake, "nope")).toThrowError(/没有资产/);
  });

  it("CLI 拒绝未登记的资产，并给出可用清单提示", () => {
    const product = makeProduct("gate-product");
    const { status, out } = runCli(
      ["add", "--target", product, "--components", "fancy-glow-card"],
      ROOT,
      true,
    );
    expect(status).not.toBe(0);
    expect(out).toContain("没有资产");
    // 失败时不能留下任何托管文件
    expect(existsSync(path.join(product, "lib", "kits", "installed"))).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* 规则 2：依赖解析                                                            */
/* -------------------------------------------------------------------------- */

describe("规则 2 · 自动解析依赖", () => {
  it("依赖按拓扑序解析：被依赖者在前", async () => {
    const { loadRegistry, resolveDependencies } = (await import(
      "../packages/cli/lib/registry.mjs"
    )) as unknown as {
      loadRegistry: (root: string) => { assetsById: Map<string, unknown> };
      resolveDependencies: (
        m: Map<string, unknown>,
        ids: string[],
      ) => { ordered: Array<{ id: string }>; edges: unknown[] };
    };
    const { assetsById } = loadRegistry(ROOT);
    const { ordered, edges } = resolveDependencies(assetsById, ["animated-grid"]);

    const ids = ordered.map((a) => a.id);
    expect(ids).toContain("animated-grid");
    expect(ids).toContain("react-utils"); // 组件声明的依赖
    // react-utils 必须在 animated-grid 之前
    expect(ids.indexOf("react-utils")).toBeLessThan(ids.indexOf("animated-grid"));
    expect(edges.length).toBeGreaterThan(0);
  });

  it("style pack 会把 @kits/contracts 一起带进来", async () => {
    const { loadRegistry, resolveDependencies } = (await import(
      "../packages/cli/lib/registry.mjs"
    )) as unknown as {
      loadRegistry: (root: string) => { assetsById: Map<string, unknown> };
      resolveDependencies: (
        m: Map<string, unknown>,
        ids: string[],
      ) => { ordered: Array<{ id: string }> };
    };
    const { assetsById } = loadRegistry(ROOT);
    const { ordered } = resolveDependencies(assetsById, ["cinematic"]);
    const ids = ordered.map((a) => a.id);
    expect(ids).toContain("contracts");
    expect(ids.indexOf("contracts")).toBeLessThan(ids.indexOf("cinematic"));
  });

  it("依赖出现环时明确失败（不是死循环）", async () => {
    const { resolveDependencies } = (await import(
      "../packages/cli/lib/registry.mjs"
    )) as unknown as {
      resolveDependencies: (
        m: Map<string, unknown>,
        ids: string[],
      ) => unknown;
    };
    const cyclic = new Map([
      ["a", { id: "a", type: "component", status: "approved", dependencies: ["b"] }],
      ["b", { id: "b", type: "component", status: "approved", dependencies: ["a"] }],
    ]);
    expect(() => resolveDependencies(cyclic, ["a"])).toThrowError(/依赖出现环/);
  });

  it("安装计划里包含被依赖包的**文件**（不只是条目）", () => {
    const product = makeProduct("deps-product");
    runCli(installArgs(product, ["--dry-run"]));
    // dry-run 不写盘，用 plan() 直接看文件清单
    const planOut = runCli(installArgs(product));
    void planOut;
    const installed = path.join(product, "lib", "kits", "installed");
    for (const dep of ["contracts", "react-utils", "cinematic", "animated-grid"]) {
      expect(existsSync(path.join(installed, dep)), `${dep} 没被安装`).toBe(true);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 规则 6：dry-run                                                             */
/* -------------------------------------------------------------------------- */

describe("规则 6 · dry-run 不写磁盘", () => {
  it("--dry-run 之后产品目录里没有任何 lib/kits", () => {
    const product = makeProduct("dryrun-product");
    const { out } = runCli(installArgs(product, ["--dry-run"]));
    expect(out).toContain("dry-run");
    expect(existsSync(path.join(product, "lib"))).toBe(false);
  });

  it("--dry-run 仍然打印完整计划（资产 + 文件 + 下一步）", () => {
    const product = makeProduct("dryrun-plan-product");
    const { out } = runCli(installArgs(product, ["--dry-run"]));
    expect(out).toContain("解析出");
    expect(out).toContain("lib/kits/installed/cinematic/tokens.css");
    expect(out).toContain("lib/kits/installed/insight-reveal/insight-reveal.tsx");
  });
});

/* -------------------------------------------------------------------------- */
/* 规则 4 + 8：checksum 与 idempotency                                        */
/* -------------------------------------------------------------------------- */

describe("规则 4 · checksum 与完整性", () => {
  it("lock 记录每个托管文件的 checksum", () => {
    const product = makeProduct("checksum-product");
    runCli(installArgs(product));
    const lock = JSON.parse(
      readFileSync(path.join(product, "lib", "kits", "kits.lock.json"), "utf8"),
    );
    expect(lock.schemaVersion).toBe(1);
    expect(lock.source.kind).toBe("source-installation");
    expect(lock.files.length).toBeGreaterThan(20);
    for (const file of lock.files) {
      expect(file.checksum).toMatch(/^[0-9a-f]{16}$/);
      expect(existsSync(path.join(product, file.path))).toBe(true);
    }
  });

  it("手工改动托管文件会被 doctor 发现并指出修法", () => {
    const product = makeProduct("tamper-product");
    runCli(installArgs(product));
    const target = path.join(product, "lib", "kits", "installed", "cinematic", "tokens.css");
    writeFileSync(target, `${readFileSync(target, "utf8")}\n/* 手工改动 */\n`);

    const { status, out } = runCli(["doctor", "--target", product], ROOT, true);
    expect(status).not.toBe(0);
    expect(out).toContain("被手工改过");
    // 必须说清"改哪里"以及"为什么"以及"怎么办"
    expect(out).toContain("adapters");
    expect(out).toContain("tokens.css");
  });

  it("缺失托管文件会被 doctor 发现", () => {
    const product = makeProduct("missing-product");
    runCli(installArgs(product));
    rmSync(
      path.join(product, "lib", "kits", "installed", "data-cursor", "data-cursor.tsx"),
    );
    const { status, out } = runCli(["doctor", "--target", product], ROOT, true);
    expect(status).not.toBe(0);
    expect(out).toContain("缺少");
  });
});

describe("规则 8 · 重复运行 idempotent", () => {
  it("连续两次 add 得到逐字节相同的托管区", () => {
    const product = makeProduct("idempotent-product");
    runCli(installArgs(product));
    const first = execFileSync(
      "find",
      [path.join(product, "lib", "kits", "installed"), "-type", "f", "-exec", "shasum", "{}", ";"],
      { encoding: "utf8" },
    )
      .split("\n")
      .map((l) => l.replace(/\s+/g, " "))
      .filter(Boolean)
      .sort();

    runCli(installArgs(product));
    const second = execFileSync(
      "find",
      [path.join(product, "lib", "kits", "installed"), "-type", "f", "-exec", "shasum", "{}", ";"],
      { encoding: "utf8" },
    )
      .split("\n")
      .map((l) => l.replace(/\s+/g, " "))
      .filter(Boolean)
      .sort();

    expect(second).toEqual(first);
  });

  it("第二次 add 报告资产「不变」而不是「新增」", () => {
    const product = makeProduct("idempotent-report-product");
    runCli(installArgs(product));
    const { out } = runCli(installArgs(product));
    expect(out).toContain("不变");
    expect(out).not.toContain("+ 新增 cinematic");
  });
});

/* -------------------------------------------------------------------------- */
/* 规则 5：不覆盖人工修改                                                      */
/* -------------------------------------------------------------------------- */

describe("规则 5 · 不覆盖产品对 adapters 的修改", () => {
  it("产品改过的适配层在重新安装后原样保留", () => {
    const product = makeProduct("adapter-product");
    runCli(installArgs(product));
    const adapter = path.join(product, "lib", "kits", "adapters", "animated-grid.tsx");
    const marked = `${readFileSync(adapter, "utf8")}\n// 产品自己的覆盖：tone = "brand"\n`;
    writeFileSync(adapter, marked);

    const { out } = runCli(installArgs(product));
    expect(out).toContain("保留产品版本");
    expect(readFileSync(adapter, "utf8")).toBe(marked);
  });

  it("产品删掉的适配层会被补齐（只补不存在的）", () => {
    const product = makeProduct("adapter-restore-product");
    runCli(installArgs(product));
    const adapter = path.join(product, "lib", "kits", "adapters", "data-cursor.tsx");
    rmSync(adapter);
    runCli(installArgs(product));
    expect(existsSync(adapter)).toBe(true);
  });

  it("adapters 内的自定义文件不会被删除", () => {
    const product = makeProduct("adapter-custom-product");
    runCli(installArgs(product));
    const custom = path.join(product, "lib", "kits", "adapters", "my-runway-stage.tsx");
    writeFileSync(custom, "export const RunwayStage = () => null;\n");
    runCli(installArgs(product));
    expect(existsSync(custom)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* 依赖重写                                                                    */
/* -------------------------------------------------------------------------- */

describe("依赖重写 · 裸说明符 → 相对路径 + 去源码扩展名", () => {
  it("托管区里不再有 @kits/* 的 import 说明符", () => {
    const product = makeProduct("rewrite-product");
    runCli(installArgs(product));
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const abs = path.join(dir, entry);
        if (statSync(abs).isDirectory()) {
          walk(abs);
          continue;
        }
        if (!/\.(ts|tsx|css)$/.test(entry)) continue;
        const content = readFileSync(abs, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
        if (/(?:from|import)\s*\(?\s*["']@kits\//.test(content)) {
          offenders.push(path.relative(product, abs));
        }
      }
    };
    walk(path.join(product, "lib", "kits", "installed"));
    expect(offenders).toEqual([]);
  });

  it("相对 import 不带 .ts / .tsx 扩展名（否则产品被迫开 allowImportingTsExtensions）", () => {
    const product = makeProduct("extension-product");
    runCli(installArgs(product));
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const abs = path.join(dir, entry);
        if (statSync(abs).isDirectory()) {
          walk(abs);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry)) continue;
        const content = readFileSync(abs, "utf8");
        for (const m of content.matchAll(
          /(?:from|import)\s*\(?\s*["'](\.[^"']*\.tsx?)["']/g,
        )) {
          offenders.push(`${path.relative(product, abs)} → ${m[1]}`);
        }
      }
    };
    walk(path.join(product, "lib", "kits"));
    expect(offenders).toEqual([]);
  });

  it("产品 package.json 里没有任何 @kits/* 依赖", () => {
    const product = makeProduct("nodep-product");
    runCli(installArgs(product));
    const pkg = JSON.parse(readFileSync(path.join(product, "package.json"), "utf8"));
    const names = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];
    expect(names.filter((n) => n.startsWith("@kits/"))).toEqual([]);
  });

  it("安装器自身也被装进产品（Kits 缺席时仍能 doctor）", () => {
    const product = makeProduct("cli-product");
    runCli(installArgs(product));
    expect(existsSync(path.join(product, "lib", "kits", ".kits", "kits.mjs"))).toBe(true);
    expect(existsSync(path.join(product, "lib", "kits", ".kits", "lib", "installer.mjs"))).toBe(
      true,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 规则 3：兼容性门禁（在动磁盘之前）                                          */
/* -------------------------------------------------------------------------- */

describe("规则 3 · 兼容性在写盘之前失败", () => {
  it("React major 不支持时拒绝安装，且不留下任何文件", () => {
    const product = makeProduct("incompat-product", {
      dependencies: { react: "17.0.2", "react-dom": "17.0.2" },
    });
    const { status, out } = runCli(installArgs(product), ROOT, true);
    expect(status).not.toBe(0);
    expect(out).toContain("react-major");
    expect(existsSync(path.join(product, "lib"))).toBe(false);
  });

  it("目标不是 Node 项目时给出明确错误", () => {
    const notAProduct = path.join(TMP, "empty-dir");
    mkdirSync(notAProduct, { recursive: true });
    const { status, out } = runCli(installArgs(notAProduct), ROOT, true);
    expect(status).not.toBe(0);
    expect(out).toContain("package.json");
  });
});

/* -------------------------------------------------------------------------- */
/* lock 与 diff                                                                */
/* -------------------------------------------------------------------------- */

describe("lock 与 diff", () => {
  it("lock 记录来源 commit 与 layout", () => {
    const product = makeProduct("lock-product");
    runCli(installArgs(product));
    const lock = JSON.parse(
      readFileSync(path.join(product, "lib", "kits", "kits.lock.json"), "utf8"),
    );
    expect(lock.source.commit).toMatch(/^[0-9a-f]{7,40}$|^null$/);
    expect(lock.layout.installedRoot).toBe("lib/kits/installed");
    expect(lock.layout.adapterRoot).toBe("lib/kits/adapters");
    // 资产条目带版本，用于 diff
    const cinematic = lock.assets.find((a: { id: string }) => a.id === "cinematic");
    expect(cinematic.version).toBe("0.1.0");
    expect(cinematic.type).toBe("style");
  });

  it("diff 在版本一致时报告一致", () => {
    const product = makeProduct("diff-product");
    runCli(installArgs(product));
    const { out } = runCli(["diff", "--target", product]);
    expect(out).toContain("= 一致");
  });

  it("doctor 在 lock 缺失时明确要求先安装", () => {
    const product = makeProduct("nolock-product");
    const { status, out } = runCli(["doctor", "--target", product], ROOT, true);
    expect(status).not.toBe(0);
    expect(out).toContain("kits add");
  });
});
