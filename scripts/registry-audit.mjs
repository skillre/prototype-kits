#!/usr/bin/env node
/**
 * Registry 审计脚本 —— 把 registry/assets.json 打印成人类可读的清单。
 *
 * 它与 tests/registry.spec.ts 的分工：
 *   - 测试负责「不许出错」（CI 门禁，失败即 red）；
 *   - 这个脚本负责「让人一眼看懂现状」（评审、汇报、接手）。
 *
 * 用法：pnpm registry
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const registry = JSON.parse(
  readFileSync(path.join(ROOT, "registry/assets.json"), "utf8"),
);

const STATUS_ORDER = ["approved", "experimental", "incoming", "deprecated"];
const TYPE_LABEL = {
  style: "Style Packs",
  component: "Signature Components",
  effect: "Effect Packs",
  skill: "Skills",
  package: "Infrastructure Packages",
};

const pad = (value, width) => String(value).padEnd(width, " ");
const padStart = (value, width) => String(value).padStart(width, " ");

let problems = 0;
const warn = (message) => {
  problems += 1;
  console.log(`  ! ${message}`);
};

console.log("");
console.log(`Prototype Kits · Asset Registry v${registry.registryVersion}`);
console.log(`generated: ${registry.generatedAt ?? "-"}`);
console.log("=".repeat(78));

/* -------------------------------------------------------------------------- */
/* 1. 概览                                                                     */
/* -------------------------------------------------------------------------- */

console.log("\n[1] 概览\n");

for (const type of ["style", "component", "effect", "skill", "package"]) {
  const items = registry.assets.filter((asset) => asset.type === type);
  const byStatus = STATUS_ORDER.map((status) => {
    const count = items.filter((asset) => asset.status === status).length;
    return count > 0 ? `${status}=${count}` : null;
  })
    .filter(Boolean)
    .join(" ");
  console.log(
    `  ${pad(TYPE_LABEL[type], 22)} ${padStart(items.length, 2)} 条   ${byStatus}`,
  );
}

/* -------------------------------------------------------------------------- */
/* 2. 资产清单                                                                 */
/* -------------------------------------------------------------------------- */

for (const type of ["style", "component", "effect", "skill"]) {
  const items = registry.assets.filter((asset) => asset.type === type);
  console.log(`\n[2] ${TYPE_LABEL[type]}（${items.length}）\n`);
  console.log(
    `  ${pad("id", 20)} ${pad("status", 12)} ${pad("ver", 6)} ${pad("perf", 5)} ${pad("ssr", 5)} ${pad("mobile", 7)} ${pad("rm", 8)} deps`,
  );
  console.log(`  ${"-".repeat(76)}`);

  for (const asset of items) {
    const ssr = asset.ssrCompatible === true ? "yes" : "n/a";
    const mobile = asset.mobileCompatible === true ? "yes" : "n/a";
    console.log(
      `  ${pad(asset.id, 20)} ${pad(asset.status, 12)} ${pad(asset.version, 6)} ${pad(String(asset.performance), 5)} ${pad(ssr, 5)} ${pad(mobile, 7)} ${pad(asset.reducedMotion, 8)} ${asset.dependencies.length}`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* 3. 一致性检查（与测试同源，但这里只报告不失败）                              */
/* -------------------------------------------------------------------------- */

console.log("\n[3] 一致性检查\n");

for (const asset of registry.assets) {
  if (!existsSync(path.join(ROOT, asset.path))) {
    warn(`${asset.id}: path 不存在 → ${asset.path}`);
  }
  for (const key of ["manifest", "entry", "demo", "readme"]) {
    const value = asset[key];
    if (!value) continue;
    if (!existsSync(path.join(ROOT, value))) {
      warn(`${asset.id}: ${key} 不存在 → ${value}`);
    }
  }
  if (asset.status === "approved" && asset.reducedMotion === "unsupported") {
    warn(`${asset.id}: approved 但不支持 reduced-motion`);
  }
  if (asset.source.kind !== "first-party" && !asset.source.license) {
    warn(`${asset.id}: 外部资产缺少 license`);
  }
  if (asset.source.containsThirdPartyCode) {
    console.log(`  i ${asset.id}: 含第三方源码（已在 source 中声明）`);
  }
}

const approvedStyles = registry.assets.filter(
  (asset) => asset.type === "style" && asset.status === "approved",
);
if (approvedStyles.length < 3) {
  warn(`approved 的 Style Pack 只有 ${approvedStyles.length} 套（期望 ≥ 3）`);
}
const approvedComponents = registry.assets.filter(
  (asset) => asset.type === "component" && asset.status === "approved",
);
if (approvedComponents.length < 5) {
  warn(
    `approved 的 Signature Component 只有 ${approvedComponents.length} 个（期望 ≥ 5）`,
  );
}

if (problems === 0) {
  console.log("  OK 无问题：路径、状态、许可证、覆盖度全部一致\n");
} else {
  console.log(`\n  共 ${problems} 处需要处理\n`);
}

/* -------------------------------------------------------------------------- */
/* 4. 覆盖度                                                                   */
/* -------------------------------------------------------------------------- */

console.log("[4] 覆盖度\n");
console.log(`  Style Packs            ${approvedStyles.length} / 期望 >= 3`);
console.log(`  Signature Components   ${approvedComponents.length} / 期望 >= 5`);
console.log(
  `  Effect Packs           ${registry.assets.filter((a) => a.type === "effect").length}`,
);
console.log(
  `  Skills                 ${registry.assets.filter((a) => a.type === "skill").length}`,
);
console.log(
  `  Infrastructure Pkgs    ${registry.assets.filter((a) => a.type === "package").length}（contracts / react-utils / cli）`,
);
console.log("");
