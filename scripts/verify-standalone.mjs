#!/usr/bin/env node
/**
 * Standalone Fixture 验证装置。
 *
 * ===========================================================================
 * 它证明什么
 * ===========================================================================
 * 「Source Installation 之后，产品在 prototype-kits 仓库**不存在**时，
 *   仍然可以 install / typecheck / build。」
 *
 * 这条是整个 Distribution 设计的核心判据。少了它，测试会退化成
 * 「在同一棵目录树里能跑」—— 而那正是第一版被证伪的假设。
 *
 * ===========================================================================
 * 步骤
 * ===========================================================================
 *   1. 把 fixtures/standalone-product 复制到临时位置
 *   2. 用 Kits 的 CLI 做一次 `kits add`
 *   3. 在临时产品里装依赖
 *   4. **把 prototype-kits 仓库改名移走**  ← 关键一步
 *   5. 在那种状态下跑 tsc --noEmit 与 next build
 *   6. 用产品自己的 lib/kits/.kits/ 跑 kits doctor
 *   7. try/finally 把仓库改回来（异常也恢复）
 *
 * 用法：node scripts/verify-standalone.mjs [--keep]
 */

import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KITS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KITS_PARENT = path.dirname(KITS_ROOT);
const KITS_NAME = path.basename(KITS_ROOT);
const HIDDEN = path.join(KITS_PARENT, `${KITS_NAME}.__hidden_for_standalone_test__`);

const WORK = process.env.KITS_FIXTURE_DIR
  ? path.resolve(process.env.KITS_FIXTURE_DIR)
  : path.join(KITS_PARENT, ".agent-tmp", "kits-standalone-verify");

const keep = process.argv.includes("--keep");

const step = (n, text) => console.log(`\n\u001b[1m[${n}]\u001b[0m ${text}`);
const ok = (text) => console.log(`  \u001b[32m✓\u001b[0m ${text}`);
const bad = (text) => console.log(`  \u001b[31m✗\u001b[0m ${text}`);

const run = (cmd, args, cwd, opts = {}) => {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    stdio: opts.capture ? "pipe" : "inherit",
    env: { ...process.env, ...opts.env },
  });
  if (result.status !== 0 && !opts.allowFail) {
    throw new Error(
      `${cmd} ${args.join(" ")} 失败（exit ${result.status}）\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  return result;
};

const pnpm = (args, cwd, opts) => {
  const env = {
    COREPACK_HOME: path.join(KITS_PARENT, ".agent-tmp", "corepack"),
    PNPM_HOME: path.join(KITS_PARENT, ".agent-tmp", "pnpm-home"),
    npm_config_store_dir: path.join(KITS_PARENT, ".agent-tmp", "pnpm-store"),
    CI: "true",
  };
  return run("pnpm", args, cwd, { ...opts, env: { ...env, ...(opts?.env ?? {}) } });
};

let repoHidden = false;
function hideKitsRepo() {
  if (existsSync(HIDDEN)) {
    throw new Error(`临时名已存在，可能是上次没恢复：${HIDDEN}\n请先手动改名回 ${KITS_NAME}`);
  }
  renameSync(KITS_ROOT, HIDDEN);
  repoHidden = true;
}
function restoreKitsRepo() {
  if (repoHidden) {
    renameSync(HIDDEN, KITS_ROOT);
    repoHidden = false;
  }
}

const failures = [];
const main = () => {
  // --- 1. 复制 fixture -----------------------------------------------------
  step(1, "复制 fixture 到临时位置");
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });
  cpSync(path.join(KITS_ROOT, "fixtures", "standalone-product"), WORK, {
    recursive: true,
  });
  ok(`临时产品：${WORK}`);

  // --- 2. kits add --------------------------------------------------------
  step(2, "kits add（源码安装）");
  run(
    process.execPath,
    [
      path.join(KITS_ROOT, "packages", "cli", "kits.mjs"),
      "add",
      "--target",
      WORK,
      "--style",
      "cinematic",
      "--components",
      "animated-grid,data-cursor,insight-reveal,evidence-chip",
      "--effects",
      "ambient-glow",
    ],
    KITS_ROOT,
  );
  ok("安装完成");

  // --- 2b. 产品 package.json 不得出现任何 @kits 依赖 ----------------------
  step("2b", "确认产品没有把 Kits 写进依赖");
  const productPkg = JSON.parse(
    execFileSync("cat", [path.join(WORK, "package.json")], { encoding: "utf8" }),
  );
  const allDeps = {
    ...productPkg.dependencies,
    ...productPkg.devDependencies,
  };
  const kitsRefs = Object.keys(allDeps).filter((n) => n.startsWith("@kits/"));
  if (kitsRefs.length) {
    bad(`产品 package.json 里有 Kits 依赖：${kitsRefs.join(", ")}`);
    failures.push("product-depends-on-kits");
  } else {
    ok("package.json 里没有任何 @kits/* 依赖");
  }

  // --- 3. 装依赖 ----------------------------------------------------------
  step(3, "在临时产品里装依赖（next / react / ts）");
  pnpm(["install", "--no-frozen-lockfile"], WORK);
  ok("依赖就绪");

  // --- 4. 把 Kits 仓库移走 ------------------------------------------------
  step(4, "把 prototype-kits 仓库改名移走（模拟 Kits 不存在）");
  hideKitsRepo();
  ok(`仓库已移动到 ${path.basename(HIDDEN)}`);

  try {
    // 4b. 断言产品里没有任何路径指向 Kits 仓库
    const grep = run(
      "grep",
      ["-rn", KITS_ROOT, "lib", "--include=*.ts", "--include=*.tsx", "--include=*.css", "--include=*.json"],
      WORK,
      { capture: true, allowFail: true },
    );
    if ((grep.stdout ?? "").trim()) {
      bad("产品源码里仍然含有指向 Kits 仓库的绝对路径");
      console.log(grep.stdout.split("\n").slice(0, 5).join("\n"));
      failures.push("absolute-kits-paths");
    } else {
      ok("产品源码里没有指向 Kits 仓库的路径");
    }

    // --- 5. typecheck ----------------------------------------------------
    step(5, "在 Kits 缺席的状态下 typecheck");
    run(path.join(WORK, "node_modules", ".bin", "next"), ["typegen"], WORK, {
      capture: true,
    });
    const tsc = run(path.join(WORK, "node_modules", ".bin", "tsc"), ["--noEmit"], WORK, {
      capture: true,
      allowFail: true,
    });
    if (tsc.status === 0) ok("tsc --noEmit 通过");
    else {
      bad("tsc 失败");
      console.log(tsc.stdout?.split("\n").slice(0, 15).join("\n"));
      failures.push("typecheck-without-kits");
    }

    // --- 6. build --------------------------------------------------------
    step(6, "在 Kits 缺席的状态下 next build");
    const build = run(
      path.join(WORK, "node_modules", ".bin", "next"),
      ["build"],
      WORK,
      { capture: true, allowFail: true },
    );
    const buildOut = `${build.stdout ?? ""}\n${build.stderr ?? ""}`;
    if (build.status === 0) {
      const routeLine = buildOut
        .split("\n")
        .find((l) => l.includes("Route") || l.includes("○ /"));
      ok(`next build 通过${routeLine ? `（${routeLine.trim()}）` : ""}`);
    } else {
      bad("next build 失败");
      console.log(buildOut.split("\n").slice(-25).join("\n"));
      failures.push("build-without-kits");
    }

    // --- 7. doctor（用产品自己的 CLI） -----------------------------------
    step(7, "用产品自己的 lib/kits/.kits/ 跑 kits doctor");
    const doctorEntry = path.join(WORK, "lib", "kits", ".kits", "kits.mjs");
    if (!existsSync(doctorEntry)) {
      bad("产品里没有 Installer 副本（lib/kits/.kits/kits.mjs）");
      failures.push("cli-not-installed");
    } else {
      const doctor = run(process.execPath, [doctorEntry, "doctor"], WORK, {
        capture: true,
        allowFail: true,
      });
      const out = `${doctor.stdout ?? ""}${doctor.stderr ?? ""}`;
      console.log(
        out
          .split("\n")
          .filter((l) => l.trim())
          .map((l) => `    ${l}`)
          .join("\n"),
      );
      if (doctor.status === 0) ok("doctor 通过");
      else failures.push("doctor-failed");
    }
  } finally {
    // --- 8. 恢复仓库 -----------------------------------------------------
    step(8, "恢复 prototype-kits 仓库");
    restoreKitsRepo();
    ok("已恢复");
  }

  if (!keep) rmSync(WORK, { recursive: true, force: true });

  step("结果", failures.length ? "失败" : "通过");
  if (failures.length) {
    for (const f of failures) bad(f);
    return 1;
  }
  ok("Source Installation 在 Kits 仓库缺席时仍然成立");
  return 0;
};

let code = 1;
try {
  code = main();
} catch (error) {
  console.error(`\n\u001b[31m✗ 未预期的错误\u001b[0m`);
  console.error(error?.stack ?? error);
  code = 1;
} finally {
  // 双保险：任何路径都不能把仓库留在改名状态
  if (repoHidden) {
    console.error("\n\u001b[33m! 检测到仓库仍处于改名状态，正在恢复…\u001b[0m");
    restoreKitsRepo();
  }
}
process.exit(code);
