/**
 * K4 + K5 · 与 Factory v1.2 的联合验收（Kits v0.2）。
 *
 * ===========================================================================
 * 这个文件在守什么
 * ===========================================================================
 * Factory v1.2 与 Kits v0.2 是同一条缝的两端，两边各自有门：
 *
 *   Factory：`scripts/lib/kits-seam.mjs` —— 产品逻辑（Tier 3）不得知道
 *            具体 Kits 资产身份；`lib/kits/**`（Tier 1/2）允许知道。
 *   Kits   ：boundary（产品不得越界引托管区）+ seam（声明 ↔ 实现双向核对）。
 *
 * 两边都绿才算这条缝成立。**跨仓库**，所以：
 *   - Kits 的实现**不 import** Factory 的任何东西（没有 runtime 依赖）；
 *   - 这个测试在 Factory 仓库缺席时**明确跳过**（skip ≠ pass）；
 *   - Factory 仓库全程只读。
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");
const CLI = path.join(ROOT, "packages", "cli", "kits.mjs");
const TMP = path.join(ROOT, "node_modules", ".cache", "kits-factory-v12-tests");
const STRIP_ANSI = /\u001b\[[0-9;]*m/g;

const FACTORY_ROOT =
  process.env.KITS_FACTORY_ROOT ?? path.resolve(ROOT, "..", "prototype-starter");
const FACTORY_SEAM = path.join(FACTORY_ROOT, "scripts", "lib", "kits-seam.mjs");
const hasFactory = existsSync(FACTORY_SEAM);

function makeProduct(name: string, files: Record<string, string> = {}) {
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

/**
 * 用**子进程**跑 Factory 的 seam 扫描器，结果以 JSON 回传。
 *
 * 子进程而不是 import：Kits 的测试可以依赖"Factory 在场"，但 Kits 的实现
 * 不可以 —— 这条边界在测试里也照守。
 */
function factoryScan(product: string) {
  const script = path.join(TMP, "factory-scan.mjs");
  writeFileSync(
    script,
    [
      `const mod = await import(${JSON.stringify(FACTORY_SEAM)});`,
      `const scan = mod.scanSeam(${JSON.stringify(product)});`,
      `let vacuous = null;`,
      `try { mod.assertNonVacuousScan(scan); } catch (error) { vacuous = String(error.message); }`,
      `console.log(JSON.stringify({`,
      `  scanned: scan.scanned, excluded: scan.excluded,`,
      `  violations: scan.violations.map((v) => ({ kind: v.kind, file: v.file, detail: v.detail })),`,
      `  vacuous,`,
      `}));`,
    ].join("\n"),
  );
  const result = spawnSync(process.execPath, [script], { cwd: TMP, encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout.trim()) as {
    scanned: number;
    excluded: number;
    violations: Array<{ kind: string; file: string; detail: string }>;
    vacuous: string | null;
  };
}

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe.skipIf(!hasFactory)("K4 + K5 · Factory v1.2 的 seam 门与 Kits v0.2 同时成立", () => {
  it("中性接缝上的产品：Factory 扫描 PASS 且非空，Kits doctor PASS 且 scanned > 0", () => {
    // 一个"Factory v1.2 风格"的产品：产品代码只知道角色名。
    const product = makeProduct("factory-style", {
      "app/page.tsx": [
        'import { Pointer } from "@/lib/kits/adapters/pointer"',
        "export default function Page() {",
        "  return <main><Pointer /></main>",
        "}",
        "",
      ].join("\n"),
      "lib/kits/adapters/pointer.tsx": [
        '"use client"',
        'export { DataCursor as Pointer, type DataCursorProps as PointerProps } from "./data-cursor"',
        "",
      ].join("\n"),
    });

    runCli(["add", "--target", product, "--style", "cinematic", "--components", "data-cursor"]);
    const seamPath = path.join(product, "lib/kits/adapters/seam/seam.json");
    const seam = JSON.parse(readFileSync(seamPath, "utf8"));
    writeFileSync(seamPath, `${JSON.stringify({ ...seam, bindings: { pointer: "data-cursor" } }, null, 2)}\n`);

    // --- Factory 侧 --------------------------------------------------------
    const scan = factoryScan(product);
    expect(scan.scanned).toBeGreaterThan(0);
    expect(scan.violations).toEqual([]);
    expect(scan.vacuous).toBeNull();

    // --- Kits 侧 -----------------------------------------------------------
    const doctor = runCli(["doctor", "--target", product], ROOT, true);
    expect(doctor.status, doctor.out).toBe(0);
    expect(doctor.out).toMatch(/✓ boundary[^\n]*扫过 \d+ 个产品源文件/);
    expect(doctor.out).toMatch(/✓ seam[^\n]*绑定 1 个角色/);

    // 产品源码（Tier 3）里没有任何资产 id —— 这正是中性接缝的产出。
    const productSource = readFileSync(path.join(product, "app/page.tsx"), "utf8");
    expect(productSource).not.toContain("data-cursor");
    // 而 Tier 1/2 允许知道资产身份（这里是生成文件与托管区）。
    expect(readFileSync(path.join(product, "lib/kits/adapters/data-cursor.tsx"), "utf8")).toContain("data-cursor");
  });

  it("对照：产品直连资产名文件 —— Kits 边界不报，但 Factory 的 Tier 3 判红（K4 要修的正是这条缝）", () => {
    const product = makeProduct("factory-direct", {
      "app/page.tsx": [
        'import { DataCursor } from "@/lib/kits/adapters/data-cursor"',
        "export default function Page() { return <main><DataCursor /></main> }",
        "",
      ].join("\n"),
    });
    runCli(["add", "--target", product, "--style", "cinematic", "--components", "data-cursor"]);

    // Factory 侧：产品逻辑（Tier 3）不得知道具体资产身份 —— 直接 import
    // `adapters/data-cursor` 也是违规。v0.1.1 的生成器在 banner 里推荐的
    // 恰好就是这条路径，于是"照着 Kits 的说明写"会被 Factory 的门拦下：
    // 这正是中性接缝（K4）存在的理由。
    const scan = factoryScan(product);
    expect(scan.scanned).toBeGreaterThan(0);
    expect(scan.violations.length).toBeGreaterThan(0);
    expect(JSON.stringify(scan.violations)).toContain("data-cursor");

    // Kits 侧：这不是边界问题（adapters/ 是产品托管区），boundary 依旧干净。
    const doctor = runCli(["doctor", "--target", product], ROOT, true);
    expect(doctor.out).toMatch(/✓ boundary/);
  });

  it("越过适配层直接引托管区：Factory 与 Kits 都判红（同一件事，两端各有一道门）", () => {
    const product = makeProduct("factory-offender", {
      "app/page.tsx": [
        'import { DataCursor } from "@/lib/kits/installed/data-cursor"',
        "export default function Page() { return <main><DataCursor /></main> }",
        "",
      ].join("\n"),
    });
    runCli(["add", "--target", product, "--style", "cinematic", "--components", "data-cursor"]);

    const scan = factoryScan(product);
    expect(scan.violations.length).toBeGreaterThan(0);
    expect(JSON.stringify(scan.violations)).toContain("installed");

    const doctor = runCli(["doctor", "--target", product], ROOT, true);
    expect(doctor.status).toBe(1);
    expect(doctor.out).toMatch(/✗ boundary/);
  });
});

describe.skipIf(hasFactory)("K4 + K5 · Factory 仓库缺席", () => {
  it("明确跳过，而不是假装通过", () => {
    expect(hasFactory).toBe(false);
    // 打印出来，免得"没跑"和"跑过了"在日志里长得一样。
    console.log(
      `[skip] Factory v1.2 不在 ${FACTORY_ROOT}；用 KITS_FACTORY_ROOT 指向它可启用联合验收。`,
    );
  });
});
