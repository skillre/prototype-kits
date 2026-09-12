#!/usr/bin/env node
/**
 * Prototype Kits · Installer CLI
 *
 * ===========================================================================
 * 两种模式，不要混淆
 * ===========================================================================
 *
 * **Delivery Mode（正式交付）—— 本文件的模式：源码安装**
 *
 *   pnpm kits add --target ../my-prototype --style cinematic --components …
 *
 *   资产被**复制进产品**，说明符被重写成相对路径，产品的 package.json 不变。
 *   装完之后 Kits 仓库可以不存在 —— 产品照样 install / typecheck / build。
 *   代价：升级需要重新跑 add（Kits 升级不会自动流到产品）。
 *
 * **Development Mode（Kits 开发 / 实验）—— 不使用本文件**
 *
 *   在产品里写 `link:../prototype-kits/<pkg>` + Next 的
 *   transpilePackages / externalDir / turbopack.root。
 *   优点：改 Kits 立刻生效，适合改资产本身、做 Style Migration 调查。
 *   代价：产品与 Kits 的目录结构、React 类型版本强耦合，不能作为交付方案。
 *   见 docs/integration.md「Development Mode」一节。
 *
 * ===========================================================================
 * 命令
 * ===========================================================================
 *
 *   kits add    正式安装资产（唯一的写操作；其余命令都是只读）
 *   kits list   查看 registry 里的可用 / 已批准资产
 *   kits doctor 体检：React 兼容性 / 托管文件完整性 / lock / 缺依赖
 *   kits diff   比较已安装版本与当前 Kits 的差异
 *
 * 设计约束：
 *   - 零运行时依赖（只用 node: 内置模块）—— 它必须能在裸产品里跑
 *   - `--dry-run` 对每个命令都有意义
 *   - 出错时给出可执行的下一步，而不是堆栈
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CODES, KitsError } from "./lib/errors.mjs";
import { loadRegistry, isInstallableType } from "./lib/registry.mjs";
import { plan, apply, verify } from "./lib/installer.mjs";
import { auditCompatibility } from "./lib/compat.mjs";
import { DEFAULT_LAYOUT, readLock, writeLock, buildLock } from "./lib/lock.mjs";
import { writeAdapters } from "./lib/adapters.mjs";

/* -------------------------------------------------------------------------- */
/* 参数解析                                                                    */
/* -------------------------------------------------------------------------- */

const COMMANDS = new Set(["add", "list", "doctor", "diff", "help", "--help", "-h"]);

function parseArgs(argv) {
  const [command = "help", ...rest] = argv;
  const flags = {};
  const positional = [];
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token.startsWith("--")) {
      const [key, inline] = token.slice(2).split("=");
      if (inline !== undefined) {
        flags[key] = inline;
      } else if (rest[i + 1] && !rest[i + 1].startsWith("--")) {
        flags[key] = rest[i + 1];
        i += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(token);
    }
  }
  return { command, flags, positional };
}

const splitList = (value) =>
  String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** 把 --kits=id 形式的 style 参数归一化成数组。 */
const styleIds = (value) => splitList(value);

/* -------------------------------------------------------------------------- */
/* 输出                                                                        */
/* -------------------------------------------------------------------------- */

const c = {
  dim: (s) => `\u001b[2m${s}\u001b[0m`,
  bold: (s) => `\u001b[1m${s}\u001b[0m`,
  green: (s) => `\u001b[32m${s}\u001b[0m`,
  red: (s) => `\u001b[31m${s}\u001b[0m`,
  yellow: (s) => `\u001b[33m${s}\u001b[0m`,
  cyan: (s) => `\u001b[36m${s}\u001b[0m`,
};

const MARK = { pass: c.green("✓"), warn: c.yellow("!"), fail: c.red("✗") };

function header(title) {
  console.log(`\n${c.bold(title)}`);
}

/* -------------------------------------------------------------------------- */
/* 路径工具                                                                    */
/* -------------------------------------------------------------------------- */

/** 找到产品根（含 package.json 的目录）。 */
function resolveTarget(target) {
  const root = path.resolve(target);
  if (!existsSync(path.join(root, "package.json"))) {
    throw new KitsError(
      CODES.TARGET_NOT_A_PACKAGE,
      `目标目录里没有 package.json：${root}`,
      "`--target` 必须指向一个 Node 项目根。",
    );
  }
  return root;
}

/**
 * 找到 Kits 仓库根。
 * CLI 自身可能被安装在产品里（lib/kits/.kits/），那种情况下 --kits 必须显式给。
 */
function resolveKitsRoot(flags) {
  if (flags.kits) return path.resolve(String(flags.kits));
  // 默认：CLI 位于 <kits>/packages/cli/kits.mjs
  const here = path.dirname(fileURLToPath(import.meta.url));
  const guess = path.resolve(here, "../..");
  if (existsSync(path.join(guess, "registry", "assets.json"))) return guess;
  throw new KitsError(
    CODES.REGISTRY_MISSING,
    "找不到 Kits 仓库根",
    "用 `--kits /path/to/prototype-kits` 显式指定。",
  );
}

/** 读 Kits 当前 git commit（用于 lock 的可追溯性）。 */
function readKitsCommit(kitsRoot) {
  try {
    const { execFileSync } = require_node_child_process();
    const head = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: kitsRoot,
      encoding: "utf8",
    }).trim();
    const dirty =
      execFileSync("git", ["status", "--porcelain"], { cwd: kitsRoot, encoding: "utf8" }).trim()
        .length > 0;
    return { commit: head, dirty };
  } catch {
    return { commit: null, dirty: false };
  }
}

// 延迟引入 child_process：只有读 commit 时才需要它，
// 而 `kits doctor` 在无 git 的环境里也必须能跑。
import * as childProcessModule from "node:child_process";
function require_node_child_process() {
  return childProcessModule;
}

/** Kits 侧的 @types/react 版本（用于兼容性比对）。 */
function readKitsTypesVersion(kitsRoot) {
  const candidates = [
    path.join(kitsRoot, "node_modules/@types/react/package.json"),
    path.join(kitsRoot, "playground/node_modules/@types/react/package.json"),
  ];
  for (const file of candidates) {
    if (existsSync(file)) {
      try {
        return JSON.parse(readFileSync(file, "utf8")).version ?? null;
      } catch {
        /* 继续 */
      }
    }
  }
  return null;
}

const majorOf = (v) => {
  const m = String(v ?? "").match(/(\d+)/);
  return m ? Number(m[1]) : null;
};

/* -------------------------------------------------------------------------- */
/* kits list                                                                  */
/* -------------------------------------------------------------------------- */

function cmdList({ flags }) {
  const kitsRoot = resolveKitsRoot(flags);
  const { registry, assetsById } = loadRegistry(kitsRoot);

  const showAll = Boolean(flags.all);
  const rows = [...assetsById.values()].filter(
    (a) => showAll || (isInstallableType(a.type) && a.status === "approved"),
  );

  header(`Prototype Kits · ${registry.registryVersion ?? "v0.1"} · ${path.relative(process.cwd(), kitsRoot) || "."}`);
  console.log(
    c.dim(
      showAll
        ? "全部资产（含未批准）"
        : "已批准且可源码安装（status=approved，type ∈ style/component/effect/package）",
    ),
  );
  console.log();

  const byType = new Map();
  for (const a of rows) {
    if (!byType.has(a.type)) byType.set(a.type, []);
    byType.get(a.type).push(a);
  }

  for (const [type, list] of [...byType.entries()].sort()) {
    console.log(c.bold(`  ${type}`));
    for (const a of list.sort((x, y) => x.id.localeCompare(y.id))) {
      const status = a.status === "approved" ? c.green("approved") : c.yellow(a.status);
      const deps = (a.dependencies ?? []).length ? c.dim(` → ${a.dependencies.map((d) => (typeof d === "string" ? d : d.id)).join(", ")}`) : "";
      console.log(`    ${a.id.padEnd(22)} ${String(a.version).padEnd(8)} ${status}${deps}`);
    }
    console.log();
  }

  if (!showAll) {
    const hidden = [...assetsById.values()].filter(
      (a) => !isInstallableType(a.type) || a.status !== "approved",
    );
    if (hidden.length) {
      console.log(c.dim(`  （另有 ${hidden.length} 项未列出：未批准或非文件资产 —— 用 --all 查看）`));
    }
  }
  console.log();
  console.log(c.dim("  安装：kits add --target <产品根> --style <id> --components <id,id> [--effects <id>]"));
}

/* -------------------------------------------------------------------------- */
/* kits add                                                                   */
/* -------------------------------------------------------------------------- */

function cmdAdd({ flags }) {
  const target = flags.target;
  if (!target) {
    throw new KitsError(CODES.BAD_USAGE, "缺少 --target", "例：kits add --target ../my-prototype --style cinematic --components animated-grid");
  }

  const kitsRoot = resolveKitsRoot(flags);
  const productRoot = resolveTarget(target);
  const dryRun = Boolean(flags["dry-run"]);
  const layout = { ...DEFAULT_LAYOUT };

  const styles = styleIds(flags.style);
  const components = splitList(flags.components);
  const effects = splitList(flags.effects);
  const explicit = splitList(flags.assets);

  /*
   * `cli` 是每次安装的隐式依赖：装完之后产品要能自己跑 `kits doctor` /
   * `kits diff`，而这要求 Installer 存在于产品里（而不是存在于 Kits 仓库里）。
   * 这正是"删掉 Kits 仓库产品仍能工作"的一部分。
   */
  const requested = [...styles, ...components, ...effects, ...explicit, "cli"];
  if (requested.length === 0) {
    throw new KitsError(
      CODES.BAD_USAGE,
      "没有指定任何资产",
      "用 --style / --components / --effects，或 --assets 直接给 id。",
    );
  }

  // --- 兼容性门禁（在动磁盘之前） -----------------------------------------
  const kitsTypesVersion = readKitsTypesVersion(kitsRoot);
  const compat = auditCompatibility(productRoot, {
    kitsReactTypesVersion: kitsTypesVersion,
    kitsTypesMajor: majorOf(kitsTypesVersion),
  });
  if (!compat.ok) {
    const failed = compat.checks.filter((x) => x.status === "fail");
    throw new KitsError(
      CODES.REACT_INCOMPATIBLE,
      `目标项目与本版 Kits 不兼容：\n${failed.map((f) => `  · ${f.id}: ${f.detail}`).join("\n")}`,
      failed.map((f) => (f.hint ? `  → ${f.hint}` : "")).filter(Boolean).join("\n"),
    );
  }

  // --- 计划（纯计算，不碰磁盘） -------------------------------------------
  const { registry, assetsById } = loadRegistry(kitsRoot);
  const installPlan = plan({ kitsRoot, assetsById, ids: requested });

  header(`kits add ${dryRun ? c.yellow("(dry-run)") : ""}`);
  console.log(`  kits     ${c.dim(kitsRoot)}`);
  console.log(`  target   ${c.dim(productRoot)}`);
  console.log();

  console.log(c.bold(`  解析出 ${installPlan.assets.length} 个资产（含依赖）：`));
  for (const a of installPlan.assets) {
    const direct = requested.includes(a.id) ? "" : c.dim("  ← 依赖");
    console.log(`    ${a.type.padEnd(10)} ${a.id.padEnd(22)} ${a.version}${direct}`);
  }
  console.log();

  const existing = readLock(productRoot, layout);
  if (existing) {
    header("  与已安装版本比较");
    const before = new Map(existing.assets.map((a) => [a.id, a.version]));
    for (const a of installPlan.assets) {
      const prev = before.get(a.id);
      if (!prev) console.log(`    ${c.green("+ 新增")} ${a.id} ${a.version}`);
      else if (prev !== a.version) console.log(`    ${c.yellow("~ 升级")} ${a.id} ${prev} → ${a.version}`);
      else console.log(`    ${c.dim("= 不变")} ${a.id} ${a.version}`);
    }
    for (const [id] of before) {
      if (!installPlan.assets.some((a) => a.id === id)) {
        console.log(`    ${c.red("- 移除")} ${id} ${c.dim("（不再本次安装计划里）")}`);
      }
    }
    console.log();
  }

  console.log(c.bold(`  将要写入 ${installPlan.files.length} 个文件：`));
  for (const f of installPlan.files) {
    console.log(`    ${c.dim("+")} ${f.dest}`);
  }
  console.log();

  if (dryRun) {
    console.log(c.yellow("  dry-run：没有写入任何文件。去掉 --dry-run 执行安装。"));
    return { code: 0 };
  }

  // --- 写入 ---------------------------------------------------------------
  let lock = null;
  apply({
    plan: installPlan,
    productRoot,
    layout,
    onWritten: (written) => {
      lock = buildLock({
        plan: installPlan,
        registry,
        source: readKitsCommit(kitsRoot),
        layout,
        installedAt: new Date().toISOString(),
        written,
      });
      writeLock(productRoot, layout, lock);
    },
  });

  const adapterResult = writeAdapters({
    productRoot,
    layout,
    assets: installPlan.assets,
  });

  header("  写入完成");
  console.log(`    Kits 托管区   ${c.dim(`${layout.installedRoot}/`)}  ${installPlan.files.length} 个文件`);
  console.log(`    安装清单      ${c.dim(layout.lockFile)}`);
  console.log(`    适配层        ${c.dim(`${layout.adapterRoot}/`)}  ${adapterResult.written.length} 新建 / ${adapterResult.kept.length} 保留产品版本`);
  console.log();

  if (adapterResult.kept.length) {
    console.log(c.dim("  保留（已存在，Kits 不覆盖产品文件）："));
    for (const f of adapterResult.kept) console.log(c.dim(`    · ${f}`));
    console.log();
  }

  console.log(c.bold("  下一步"));
  const styleAdapter = styles.length ? `${layout.adapterRoot}/style-${styles[0]}.css` : null;
  console.log(`    1. 在全局样式里引入 pack：${c.cyan(`@import "@/${styleAdapter}";`)}`);
  if (components.length) {
    console.log(`    2. 产品代码只 import 适配层：`);
    for (const id of components) {
      console.log(c.cyan(`         import { ${pascal(id)} } from "@/lib/kits/adapters/${id}";`));
    }
  }
  console.log(`    3. 声明 pack 作用域：${c.cyan(`<html data-kits-pack="${styles[0] ?? "cinematic"}">`)}`);
  console.log(`    4. 体检：${c.cyan("kits doctor")}`);
  console.log();

  return { code: 0 };
}

function pascal(id) {
  return id
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

/* -------------------------------------------------------------------------- */
/* kits doctor                                                                */
/* -------------------------------------------------------------------------- */

function cmdDoctor({ flags }) {
  const productRoot = resolveTarget(flags.target ?? process.cwd());
  const layout = { ...DEFAULT_LAYOUT };
  const lock = readLock(productRoot, layout);

  header(`kits doctor · ${path.basename(productRoot)}`);
  console.log(`  ${c.dim(productRoot)}`);
  console.log();

  const checks = [];
  const push = (id, status, detail, hint) => checks.push({ id, status, detail, hint });

  // --- 1. 安装清单 --------------------------------------------------------
  if (!lock) {
    push("lock", "fail", `没有找到 ${layout.lockFile}`, "先用 `kits add` 安装资产。");
  } else {
    push(
      "lock",
      "pass",
      `schemaVersion ${lock.schemaVersion} · ${lock.assets.length} 个资产 · 装于 ${lock.generatedAt}`,
    );
    push(
      "lock-source",
      lock.source?.commit ? "pass" : "warn",
      lock.source?.commit
        ? `来源 commit ${String(lock.source.commit).slice(0, 8)}${lock.source.dirty ? c.yellow("（安装时 Kits 工作区有未提交改动）") : ""}`
        : "清单里没有记录来源 commit",
    );
  }

  // --- 2. 托管文件完整性 --------------------------------------------------
  if (lock) {
    const result = verify({ productRoot, lock });
    if (result.missing.length) {
      push("integrity", "fail", `托管区缺少 ${result.missing.length} 个文件`, `跑 \`kits add\` 重新安装。缺：${result.missing.slice(0, 3).join(", ")}`);
    } else if (result.modified.length) {
      push(
        "integrity",
        "fail",
        `有 ${result.modified.length} 个 Kits 托管文件被手工改过`,
        `托管区属于 Kits，修改会在下次安装时丢失。把这些改动移到 ${layout.adapterRoot}/。改过的文件：${result.modified.slice(0, 3).join(", ")}`,
      );
    } else {
      push("integrity", "pass", `${result.checked} 个托管文件 checksum 全部匹配`);
    }
    if (result.extra.length) {
      push(
        "integrity-extra",
        "warn",
        `托管区里有 ${result.extra.length} 个不属于本次安装的文件`,
        `它们不会被 Kits 管理，也不受保护：${result.extra.slice(0, 3).join(", ")}`,
      );
    }
  }

  // --- 3. 缺依赖 ----------------------------------------------------------
  if (lock) {
    const installed = new Set(lock.assets.map((a) => a.id));
    const missingDeps = (lock.dependencies ?? []).filter(
      (edge) => !installed.has(edge.to),
    );
    if (missingDeps.length) {
      push("dependencies", "fail", `有 ${missingDeps.length} 条依赖没有对应的已安装资产`, `跑 \`kits add\` 补齐：${missingDeps.map((d) => d.to).join(", ")}`);
    } else {
      push("dependencies", "pass", `${lock.assets.length} 个资产的依赖图闭合`);
    }
  }

  // --- 4. React / TypeScript 兼容性 --------------------------------------
  const kitsRoot = flags.kits ? path.resolve(String(flags.kits)) : tryKitsRoot();
  const kitsTypesVersion = kitsRoot ? readKitsTypesVersion(kitsRoot) : null;
  const compat = auditCompatibility(productRoot, {
    kitsReactTypesVersion: kitsTypesVersion,
    kitsTypesMajor: majorOf(kitsTypesVersion),
  });
  for (const check of compat.checks) push(check.id, check.status, check.detail, check.hint);

  // --- 5. 适配层存在性 ----------------------------------------------------
  if (lock) {
    const adapterRoot = path.join(productRoot, layout.adapterRoot);
    const expected = lock.assets
      .filter((a) => a.type === "component" || a.type === "style" || a.type === "effect")
      .map((a) =>
        a.type === "style" ? `style-${a.id}.css` : a.type === "effect" ? `effect-${a.id}.css` : `${a.id}.tsx`,
      );
    const missingAdapters = expected.filter((f) => !existsSync(path.join(adapterRoot, f)));
    if (missingAdapters.length) {
      push("adapters", "warn", `缺少 ${missingAdapters.length} 个适配层文件`, `跑 \`kits add\` 会补齐（它只补不存在的文件）：${missingAdapters.join(", ")}`);
    } else {
      push("adapters", "pass", `${expected.length} 个适配层文件都在`);
    }
  }

  // --- 输出 ---------------------------------------------------------------
  for (const check of checks) {
    console.log(`  ${MARK[check.status]} ${check.id.padEnd(24)} ${check.detail}`);
    if (check.hint && check.status !== "pass") {
      console.log(`    ${c.dim("→")} ${c.dim(check.hint)}`);
    }
  }
  console.log();

  const failed = checks.filter((x) => x.status === "fail").length;
  const warned = checks.filter((x) => x.status === "warn").length;
  if (failed) {
    console.log(`  ${c.red(`✗ ${failed} 项失败`)}${warned ? c.yellow(` · ${warned} 项警告`) : ""}`);
  } else if (warned) {
    console.log(`  ${c.yellow(`! 通过，但有 ${warned} 项警告`)}`);
  } else {
    console.log(`  ${c.green("✓ 全部通过")}`);
  }
  console.log();

  return { code: failed ? 1 : 0 };
}

function tryKitsRoot() {
  try {
    return resolveKitsRoot({});
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* kits diff                                                                  */
/* -------------------------------------------------------------------------- */

function cmdDiff({ flags }) {
  const productRoot = resolveTarget(flags.target ?? process.cwd());
  const layout = { ...DEFAULT_LAYOUT };
  const lock = readLock(productRoot, layout);
  if (!lock) {
    throw new KitsError(CODES.LOCK_MISSING, `没有找到 ${layout.lockFile}`, "先安装：kits add …");
  }

  const kitsRoot = resolveKitsRoot(flags);
  const { assetsById } = loadRegistry(kitsRoot);

  header(`kits diff · 已安装 vs 当前 Kits`);
  console.log(`  ${c.dim(productRoot)}`);
  console.log();

  let changes = 0;
  for (const installed of lock.assets) {
    const current = assetsById.get(installed.id);
    if (!current) {
      console.log(`  ${c.red("✗ 上游已移除")} ${installed.id} ${c.dim(`（本地 ${installed.version}）`)}`);
      changes += 1;
      continue;
    }
    if (current.version !== installed.version) {
      console.log(`  ${c.yellow("~ 有新版本")} ${installed.id} ${installed.version} → ${current.version}`);
      changes += 1;
      continue;
    }
    if (current.status !== installed.status) {
      console.log(`  ${c.yellow("~ 状态变化")} ${installed.id} ${installed.status} → ${current.status}`);
      changes += 1;
      continue;
    }
    console.log(`  ${c.dim("= 一致")} ${installed.id} ${installed.version}`);
  }

  // 上游新增、但本地没装的
  const installedIds = new Set(lock.assets.map((a) => a.id));
  const upstreamNew = [...assetsById.values()].filter(
    (a) => isInstallableType(a.type) && a.status === "approved" && !installedIds.has(a.id),
  );
  if (upstreamNew.length) {
    console.log();
    console.log(c.dim("  上游还有未安装的已批准资产："));
    for (const a of upstreamNew) console.log(c.dim(`    · ${a.type} ${a.id} ${a.version}`));
  }

  console.log();
  console.log(
    changes
      ? `${c.yellow(`${changes} 项有差异`)} —— 重新跑 \`kits add\` 即可同步（产品 adapters/ 不受影响）`
      : c.green("  已安装资产与当前 Kits 完全一致"),
  );
  console.log();

  return { code: 0 };
}

/* -------------------------------------------------------------------------- */
/* help                                                                       */
/* -------------------------------------------------------------------------- */

function cmdHelp() {
  console.log(`
${c.bold("Prototype Kits · Installer")}

${c.bold("用法")}
  kits <命令> [选项]

${c.bold("命令")}
  ${c.cyan("add")}     安装资产到产品（唯一的写操作）
  ${c.cyan("list")}    查看 registry 里的可用 / 已批准资产
  ${c.cyan("doctor")}  体检：React 兼容性 / 托管文件完整性 / lock / 缺依赖
  ${c.cyan("diff")}    比较已安装版本与当前 Kits 的差异

${c.bold("kits add")}
  --target <dir>            产品根（必填）
  --style <id[,id]>         Style Pack
  --components <id[,id]>    Signature Component
  --effects <id[,id]>       Effect Pack
  --assets <id[,id]>        直接指定资产 id
  --kits <dir>              Kits 仓库根（默认从 CLI 位置推断）
  --dry-run                 只打印计划，不写磁盘

${c.bold("kits list / doctor / diff")}
  --target <dir>            产品根（默认当前目录）
  --kits <dir>              Kits 仓库根
  --all                     list：连未批准资产一起列出

${c.bold("示例")}
  kits add --target ../my-prototype \\
    --style cinematic \\
    --components animated-grid,data-cursor,insight-reveal \\
    --effects ambient-glow --dry-run

  kits doctor --target ../my-prototype

${c.bold("安装后的目录")}
  lib/kits/
  ├── installed/       Kits 托管区（只读，重新安装会覆盖）
  ├── adapters/        产品托管区（Kits 永不覆盖）
  ├── .kits/           Installer 自身（本 CLI 的副本）
  └── kits.lock.json   安装清单

${c.dim("Development Mode（改 Kits 本身、做 Style Migration 调查）见 docs/integration.md。")}
`);
  return { code: 0 };
}

/* -------------------------------------------------------------------------- */
/* main                                                                       */
/* -------------------------------------------------------------------------- */

function main() {
  const argv = process.argv.slice(2);
  const { command, flags, positional } = parseArgs(argv);

  if (flags.version || flags.v) {
    console.log("kits 0.1.0");
    return 0;
  }
  if (!COMMANDS.has(command) || command === "help" || command === "--help" || command === "-h") {
    cmdHelp();
    return 0;
  }
  if (positional.length && command === "add") {
    throw new KitsError(CODES.BAD_USAGE, `无法识别的参数：${positional.join(" ")}`);
  }

  const result =
    command === "list"
      ? cmdList({ flags })
      : command === "add"
        ? cmdAdd({ flags })
        : command === "doctor"
          ? cmdDoctor({ flags })
          : cmdDiff({ flags });

  return result?.code ?? 0;
}

try {
  process.exitCode = main();
} catch (error) {
  if (error instanceof KitsError) {
    console.error(`\n${c.red(`✗ ${error.message}`)}`);
    if (error.hint) console.error(`  ${c.dim("→")} ${error.hint}`);
    console.error(c.dim(`\n  (${error.code})`));
  } else {
    console.error(`\n${c.red("✗ 未预期的错误")}`);
    console.error(error?.stack ?? error);
  }
  process.exitCode = 1;
}
