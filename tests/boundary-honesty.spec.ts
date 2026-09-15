/**
 * K5 · 边界扫描的诚实性（Kits v0.2）。
 *
 * ===========================================================================
 * 这个文件在守什么
 * ===========================================================================
 * v0.1.1 的 doctor 里有一条正式的静默失败路径：
 *
 *     扫过 0 个产品源文件，没有绕过适配层的引用     → ✓ boundary (pass)
 *
 * 「0 个文件里发现 0 个违规」被打印成了「检查通过」。而这两句话不是一回事：
 * 前者是**检查没有发生**。同一个形状在 Factory v1.2 里已经出现过两次
 * （probe guard 的 `0/0 = NaN`、seam 扫描的 `scanned 0`），Kits 这边是第三处。
 *
 * v0.2 的判定是三态：
 *   PASS           扫过 > 0 个文件，0 个违规
 *   FAIL           有违规 / 范围根缺失 / 扫到 0 个文件（检查没有发生）
 *   NOT APPLICABLE 没有托管区可越界（未安装）—— **不是通过**
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");
const CLI = path.join(ROOT, "packages", "cli", "kits.mjs");
const TMP = path.join(ROOT, "node_modules", ".cache", "kits-boundary-tests");
const STRIP_ANSI = /\u001b\[[0-9;]*m/g;

interface BoundaryModule {
  PRODUCT_SOURCE_ROOTS: string[];
  findManagedImports: (options: { productRoot: string }) => {
    violations: Array<{ file: string; spec: string }>;
    scanned: number;
    excluded: number;
    roots: { present: string[]; missing: string[] };
  };
  boundaryVerdict: (options: {
    productRoot: string;
    scan: unknown;
    installPresent: boolean;
  }) => {
    status: "pass" | "fail" | "not-applicable";
    state: string | null;
    detail: string;
    hint: string | null;
    scanned: number;
    excluded: number;
  };
}

async function boundaryModule(): Promise<BoundaryModule> {
  return (await import("../packages/cli/lib/boundary.mjs")) as unknown as BoundaryModule;
}

/** 造一个最小产品：package.json + 一个源文件。 */
function makeProduct(name: string, files: Record<string, string> = { "app/page.tsx": "export default function P() { return null }\n" }) {
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
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return dir;
}

function runCli(args: string[], cwd = ROOT, allowFail = false) {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`.replace(STRIP_ANSI, "");
  if (result.status !== 0 && !allowFail) {
    throw new Error(`kits ${args.join(" ")} 失败（${result.status}）\n${out}`);
  }
  return { status: result.status ?? -1, out };
}

const install = (product: string) =>
  runCli([
    "add",
    "--target",
    product,
    "--style",
    "cinematic",
    "--components",
    "data-cursor,insight-reveal",
  ]);

const doctor = (product: string, allowFail = true) =>
  runCli(["doctor", "--target", product], ROOT, allowFail);

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe("K5 · 判定矩阵（纯函数）", () => {
  const scan = (over: Record<string, unknown> = {}) => ({
    violations: [],
    scanned: 3,
    excluded: 40,
    roots: { present: ["app"], missing: ["src"] },
    ...over,
  });

  it("范围根存在、扫到文件、无违规 → PASS", async () => {
    const mod = await boundaryModule();
    const verdict = mod.boundaryVerdict({ productRoot: "/tmp/x", scan: scan(), installPresent: true });
    expect(verdict.status).toBe("pass");
    expect(verdict.detail).toMatch(/扫过 3 个产品源文件/);
  });

  it("扫到 0 个文件 → FAIL，并说明检查没有发生", async () => {
    const mod = await boundaryModule();
    const verdict = mod.boundaryVerdict({
      productRoot: "/tmp/x",
      scan: scan({ scanned: 0, violations: [] }),
      installPresent: true,
    });
    expect(verdict.status).toBe("fail");
    expect(verdict.state).toBe("vacuous-scan");
    expect(verdict.detail).toContain("检查没有发生");
    expect(verdict.detail).toContain("≠ 通过");
  });

  it("范围根缺失 → FAIL（不是「没有可检查的东西」）", async () => {
    const mod = await boundaryModule();
    const verdict = mod.boundaryVerdict({
      productRoot: "/tmp/x",
      scan: scan({ scanned: 0, roots: { present: [], missing: ["app", "src"] } }),
      installPresent: true,
    });
    expect(verdict.status).toBe("fail");
    expect(verdict.detail).toContain("检查没有发生");
    expect(verdict.hint).toContain("范围根缺失");
  });

  it("有违规 → FAIL，并且第一个 hint 指向适配层", async () => {
    const mod = await boundaryModule();
    const verdict = mod.boundaryVerdict({
      productRoot: "/tmp/x",
      scan: scan({ violations: [{ file: "app/page.tsx", spec: "@/lib/kits/installed/x" }] }),
      installPresent: true,
    });
    expect(verdict.status).toBe("fail");
    expect(verdict.hint).toContain("adapters/");
  });

  it("未安装 → NOT APPLICABLE，带 not-installed 状态，且措辞里说明「不是通过」", async () => {
    const mod = await boundaryModule();
    const verdict = mod.boundaryVerdict({
      productRoot: "/tmp/x",
      scan: scan({ scanned: 0 }),
      installPresent: false,
    });
    expect(verdict.status).toBe("not-applicable");
    expect(verdict.state).toBe("not-installed");
    expect(verdict.detail).toContain("不适用（不是通过）");
  });
});

describe("K5 · 真实扫描的范围证据", () => {
  it("findManagedImports 报出 scanned / excluded / roots，而不是只报 violations", async () => {
    const mod = await boundaryModule();
    const product = makeProduct("scan-evidence", {
      "app/page.tsx": "export default function P() { return null }\n",
      "components/card.tsx": "export const Card = () => null\n",
    });
    install(product);

    const result = mod.findManagedImports({ productRoot: product });
    expect(result.scanned).toBeGreaterThan(0);
    // 跳过的是托管区与适配层 —— 这个数字必须存在，否则 doctor 说不清范围。
    expect(result.excluded).toBeGreaterThan(0);
    expect(result.roots.present).toContain("app");
    expect(mod.PRODUCT_SOURCE_ROOTS).toContain("app");
  });

  it("扫过 0 个文件的真实产品：装着 Kits、却没有产品源码 → doctor FAIL", async () => {
    const product = makeProduct("zero-source");
    install(product);
    // 把唯一的产品源码删掉，只留托管区与适配层。
    rmSync(path.join(product, "app"), { recursive: true, force: true });

    const { status, out } = doctor(product);
    expect(status).toBe(1);
    expect(out).toMatch(/✗ boundary/);
    expect(out).toContain("检查没有发生");
    expect(out).toMatch(/0 个产品源文件/);
    // 不允许出现"扫过 0 个产品源文件，没有绕过适配层的引用"这种通过措辞。
    expect(out).not.toMatch(/✓ boundary/);
  });

  it("只有 managed Kits tree、没有产品源码 → FAIL 或明确不适用，绝不 PASS", async () => {
    const product = makeProduct("managed-only");
    install(product);
    rmSync(path.join(product, "app"), { recursive: true, force: true });
    const { out } = doctor(product);
    expect(out).not.toMatch(/✓ boundary[^\n]*没有绕过适配层的引用/);
  });

  it("干净产品 → boundary PASS，并同时给出 scanned 与 excluded", async () => {
    const product = makeProduct("clean");
    install(product);
    const { status, out } = doctor(product);
    expect(status).toBe(0);
    expect(out).toMatch(/✓ boundary/);
    // v0.1.1 的措辞在这里必须继续成立（doctor-standalone.spec.ts 钉着它）。
    expect(out).toMatch(/扫过 \d+ 个产品源文件/);
    expect(out).toMatch(/跳过 \d+ 个/);
  });

  it("越界产品 → boundary FAIL（原有行为不变）", async () => {
    const product = makeProduct("offender", {
      "app/page.tsx": 'import { DataCursor } from "@/lib/kits/installed/data-cursor"\nexport default function P() { return DataCursor }\n',
    });
    install(product);
    const { status, out } = doctor(product);
    expect(status).toBe(1);
    expect(out).toMatch(/✗ boundary/);
    expect(out).toContain("绕过适配层");
  });
});

describe("K5 · 未安装不是一个通过", () => {
  it("没有 lock 时 boundary 是「不适用」，输出带 not-installed，且整行不是通过标记", async () => {
    const product = makeProduct("no-install");
    const { out } = doctor(product);
    expect(out).toContain("[not-installed]");
    expect(out).toMatch(/– boundary/);
    expect(out).toMatch(/不适用（不是通过）/);
    expect(out).not.toMatch(/✓ boundary/);
  });

  it("有 NOT APPLICABLE 时，摘要不允许说「全部通过」", async () => {
    const product = makeProduct("no-install-summary");
    const { out } = doctor(product);
    expect(out).toContain("项不适用");
    expect(out).not.toContain("✓ 全部通过");
  });
});

describe("K5 · v0.1.1 安装仍然可用", () => {
  it("把 lock 降级成 v0.1.1 形状（旧模板版本）后 doctor 仍然退出 0", async () => {
    const product = makeProduct("legacy-lock");
    install(product);

    // 伪造"更早模板装的"：模板版本落后于当前 Installer。旧安装必须被**说出来**，
    // 而不是静默当作新安装 —— 这正是 K5 要保住的性质：诚实高于好看。
    const lockPath = path.join(product, "lib/kits/kits.lock.json");
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    lock.adapters.templateVersion = "0.1.0";
    writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

    const { status, out } = doctor(product);
    expect(status).toBe(0);
    expect(out).toMatch(/adapters-template/);
    expect(out).toContain("旧模板 v0.1.0");
    // 有警告时摘要是「! 通过，但有 N 项警告」，没有失败项。
    expect(out).toMatch(/通过/);
    expect(out).not.toContain("项失败");
  });
});
