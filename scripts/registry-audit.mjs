#!/usr/bin/env node
/**
 * Registry 审计脚本 —— 把 registry/assets.json（以及它指向的 manifest）审计成人能读的报告。
 *
 * 它与 tests/registry.spec.ts、tests/manifest-contract.spec.ts 的分工：
 *   - 测试负责「不许出错」（CI 门禁，失败即 red）；
 *   - 这个脚本负责「让人一眼看懂现状，并说清自己检查了什么」（评审、汇报、接手）。
 *
 * ===========================================================================
 * v0.2 的三处变化（Phase B）
 * ===========================================================================
 *   1. **不再是第二套规则**：判定全部来自 `scripts/lib/manifest-contract.mjs`，
 *      与测试、与 Playground 用的是同一个模块。以前这里是「只打印不失败」的
 *      平行实现，schema 说 legal、脚本说 suspicious 的两套真相之所以能长期共存，
 *      就是因为这条路径没人核对。
 *   2. **会说「检查了什么」**：每类检查都打出被检查的对象数量（`stats`）。
 *      「0 处问题」在「全部通过」和「其实什么都没查」这两个世界里长得一模一样。
 *   3. **error 会真的失败**：退出码非 0。warn / info 仍然只报告（它们不是缺陷，
 *      是现状：例如 pack 没声明暗色方向是合法的旧状态）。
 *
 * 用法：pnpm registry
 */
import path from "node:path";

import {
  checkCoverage,
  checkPaintScope,
  checkRegistry,
  deriveMobileState,
  formatFinding,
  loadRegistry,
} from "./lib/manifest-contract.mjs";
import { effectScope, packScope } from "./lib/material-scope.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const registry = loadRegistry(ROOT);

const STATUS_ORDER = ["approved", "experimental", "incoming", "deprecated"];
const TYPE_LABEL = {
  style: "Style Packs",
  component: "Signature Components",
  effect: "Effect Packs",
  skill: "Skills",
  package: "Infrastructure Packages",
};
const MOBILE_STATE_LABEL = {
  recommended: "推荐",
  discouraged: "可用但不推荐",
  compatible: "允许（需适配）",
  "fallback-only": "仅降级形态",
  unsupported: "不支持",
  "not-applicable": "不适用",
};

/** 显示宽度：CJK 占 2 列，否则中文状态词会让整张表歪掉。 */
const displayWidth = (value) =>
  [...String(value)].reduce((sum, ch) => sum + (ch.codePointAt(0) > 0x2e80 ? 2 : 1), 0);
const pad = (value, width) => String(value) + " ".repeat(Math.max(0, width - displayWidth(value)));
const padStart = (value, width) => String(value).padStart(width, " ");

// 结构一致性（逐资产、跨字段）+ 覆盖度（本仓库的策略承诺）—— 两者刻意分开，这里合并报告
const { findings, stats, resolved } = checkRegistry({ root: ROOT, registry });
findings.push(...checkCoverage(registry));

/* ---- K8 · 材质边界：pack / effect 的样式表只在自己的选择器里作画 ---------- */
const paintTargets = [];
for (const asset of registry.assets) {
  const place = resolved.get(asset.id);
  if (asset.type === "style") {
    const cssVariables = place?.manifest?.tokens?.cssVariables ?? "tokens.css";
    paintTargets.push({
      rel: path.join(path.dirname(asset.manifest), cssVariables),
      scoped: packScope(asset.id),
      label: `${asset.id} pack`,
    });
  }
  if (asset.type === "effect" && place?.node?.entry && place?.node?.class) {
    paintTargets.push({
      rel: path.join("effects", place.node.entry),
      scoped: effectScope(place.node.class),
      label: `${asset.id} effect`,
    });
  }
}
const paintScans = paintTargets.map((target) => checkPaintScope(ROOT, target));
const paintStats = {
  files: paintScans.filter((scan) => !scan.missing).length,
  missing: paintScans.filter((scan) => scan.missing).length,
  rules: paintScans.reduce((sum, scan) => sum + scan.rules, 0),
  paintRules: paintScans.reduce((sum, scan) => sum + scan.paintRules, 0),
};
for (const scan of paintScans) {
  if (scan.missing) {
    findings.push({
      level: "warn",
      code: "material/unverifiable",
      where: scan.rel,
      message: "读不到这份样式表，材质边界无从核对（不当作通过）",
    });
    continue;
  }
  for (const violation of scan.violations) {
    findings.push({
      level: "error",
      code: "material/paint-out-of-scope",
      where: `${scan.rel} · ${violation.selector}`,
      message: violation.why,
    });
  }
}

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
  console.log(`  ${pad(TYPE_LABEL[type], 22)} ${padStart(items.length, 2)} 条   ${byStatus}`);
}

/* -------------------------------------------------------------------------- */
/* 2. 资产清单                                                                 */
/* -------------------------------------------------------------------------- */

for (const type of ["style", "component", "effect", "skill"]) {
  const items = registry.assets.filter((asset) => asset.type === type);
  console.log(`\n[2] ${TYPE_LABEL[type]}（${items.length}）\n`);
  console.log(
    `  ${pad("id", 20)} ${pad("status", 12)} ${pad("ver", 6)} ${pad("perf", 5)} ${pad("ssr", 5)} ${pad("mobile 状态", 16)} ${pad("rm", 8)} deps`,
  );
  console.log(`  ${"-".repeat(84)}`);

  for (const asset of items) {
    const ssr = asset.ssrCompatible === true ? "yes" : "n/a";
    const mobile = MOBILE_STATE_LABEL[deriveMobileState(asset)];
    console.log(
      `  ${pad(asset.id, 20)} ${pad(asset.status, 12)} ${pad(asset.version, 6)} ${pad(String(asset.performance), 5)} ${pad(ssr, 5)} ${pad(mobile, 16)} ${pad(asset.reducedMotion, 8)} ${asset.dependencies.length}`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* 3. 一致性检查（与测试、与 Playground 同源）                                  */
/* -------------------------------------------------------------------------- */

console.log("\n[3] 一致性检查（gate：error 会让本命令以非 0 退出）\n");

const CHECKED = [
  ["资产清单定位", `assets=${stats.assets} 条，解析出清单节点 ${stats.manifestsResolved} 个（pack=${stats.kinds.pack} / component=${stats.kinds.component} / effect=${stats.kinds.effect} / package=${stats.kinds.package}）`],
  ["引用字段（K6）", `${stats.referenceLists} 个引用数组、${stats.referenceIds} 个引用 id —— 逐个核对「在 registry 里存在」且「类型匹配字段语义」`],
  ["registry ↔ manifest 的 signatureComponents（K6b）", `${stats.kinds.pack} 套 pack 双向比对`],
  ["usedByStylePacks ↔ pack 三列表（K6c）", `${stats.roleAssignments} 处角色声明，双向核对`],
  ["适配标签枚举（K7）", `registry ${stats.registryTagValues} 个标签值 + manifest ${stats.manifestTagValues} 个标签值，逐值对枚举校验；并核对两侧完全相等`],
  ["人读散文（K7）", `manifest 里保留了 ${stats.notes} 条 recommendedForNotes / avoidForNotes`],
  ["mobileCompatible 取值与一致性（K2）", `${stats.assets} 条 registry 取值 + ${stats.mobileMirrors} 份 manifest 的镜像值`],
  ["fallback-only 的可执行性（K2）", "声明 fallback-only 的资产必须给出 mobileFallback.trigger / behavior / noContentLoss=true"],
  ["darkDirection 可执行性（K1）", `已声明 ${stats.darkDeclared} 套 pack（未声明 ${stats.darkUndeclared} 套 = 合法旧状态）、${stats.darkSlots} 个槽位逐个对照 tokens.css`],
  ["effect 聚合清单（K6）", `${stats.effectsInAggregate} 个 effect 条目 + ${stats.reservedIds} 个 reserved 占位 id（占位不得已在册）`],
  ["package.json 版本与包名（K6）", `${stats.packagesChecked} 个包的 name / version 与 registry 比对`],
  ["材质语言（K8）", `${stats.materialDeclared} 套 pack 声明了 materialDirection（未声明 ${stats.materialUndeclared} 套 = 合法旧状态）；${stats.effectKinds} 个 effect 声明了 material.kind（其中发光类 ${stats.lightEffects} 个）`],
  ["材质边界（K8）", `${paintStats.files} 份样式表、${paintStats.rules} 条规则（其中 ${paintStats.paintRules} 条作画）—— 逐条核对「只在自己的选择器里作画」`],
  ["覆盖度", "approved Style ≥ 3、approved Signature Component ≥ 5"],
];

for (const [what, detail] of CHECKED) console.log(`  · ${pad(what, 44)} ${detail}`);

console.log("");
const byLevel = { error: [], warn: [], info: [] };
for (const finding of findings) (byLevel[finding.level] ??= []).push(finding);

if (findings.length === 0) {
  console.log("  OK 全部通过：上面列出的每一项都真的跑过，没有 error / warn / info。\n");
} else {
  for (const [level, items] of Object.entries(byLevel)) {
    if (items.length === 0) continue;
    const label = level === "error" ? "error（必须修）" : level === "warn" ? "warn（要处理，但不阻塞）" : "info（现状说明）";
    console.log(`  ${label}：${items.length} 处`);
    for (const finding of items) console.log(formatFinding(finding));
    console.log("");
  }
}

/* -------------------------------------------------------------------------- */
/* 4. 适配维度 × 移动端状态（K2 / K7 的落地效果）                              */
/* -------------------------------------------------------------------------- */

console.log("[4] 适配维度 × 移动端状态\n");
console.log("  标签是机器可读的枚举投影；散文（*Notes）保留在 manifest 里。");
console.log("  **兼容 ≠ 推荐**：mobileCompatible=true 只说明「不会被移动端天然弄坏」。\n");
console.log(`  ${pad("id", 20)} ${pad("mobile 状态", 16)} recommendedFor / avoidFor`);
console.log(`  ${"-".repeat(84)}`);
for (const asset of registry.assets) {
  const recommended = Array.isArray(asset.recommendedFor) ? asset.recommendedFor.join(",") : "—";
  const avoid = Array.isArray(asset.avoidFor) ? asset.avoidFor.join(",") : "—";
  if (recommended === "—" && avoid === "—" && !["style", "component"].includes(asset.type)) continue;
  console.log(
    `  ${pad(asset.id, 20)} ${pad(MOBILE_STATE_LABEL[deriveMobileState(asset)], 16)} rec=[${recommended}] avoid=[${avoid}]`,
  );
}
console.log("");

/* -------------------------------------------------------------------------- */
/* 4b. 材质语言（K8）                                                          */
/* -------------------------------------------------------------------------- */

console.log("[4b] 材质语言（materialDirection · K8）\n");
console.log(`  ${pad("pack", 14)} ${pad("hierarchy", 11)} ${pad("ambient", 15)} ${pad("glow", 10)} effect 材质`);
console.log(`  ${"-".repeat(78)}`);
for (const asset of registry.assets.filter((a) => a.type === "style")) {
  const place = resolved.get(asset.id);
  const material = place?.manifest?.materialDirection;
  if (!material) {
    console.log(`  ${pad(asset.id, 14)} ${pad("—", 11)} ${pad("—", 15)} ${pad("—", 10)} （未声明）`);
    continue;
  }
  const kinds = (place.manifest.effects ?? [])
    .map((id) => {
      const node = resolved.get(id)?.node;
      return node?.material?.kind ? `${id}:${node.material.kind}` : `${id}:?`;
    })
    .join(" ");
  console.log(
    `  ${pad(asset.id, 14)} ${pad(material.hierarchy, 11)} ${pad(material.ambient, 15)} ${pad(material.glow, 10)} ${kinds || "—"}`,
  );
}
console.log("");
console.log("  环境光与发光预算**不是形容词**：ambient 与 tokens.css 里的 `.kits-ambient` 核对，");
console.log("  glow 与 `--kits-color-glow` 核对，并与 effects[] 的材质类别交叉（见 [3] 的判定）。");
console.log("  **Kits 不会自动使用任何一项**：装 pack 只给能力，用不用由产品决定。\n");

/* -------------------------------------------------------------------------- */
/* 5. 覆盖度                                                                   */
/* -------------------------------------------------------------------------- */

const approvedStyles = registry.assets.filter((asset) => asset.type === "style" && asset.status === "approved");
const approvedComponents = registry.assets.filter((asset) => asset.type === "component" && asset.status === "approved");

console.log("[5] 覆盖度\n");
console.log(`  Style Packs            ${approvedStyles.length} / 期望 >= 3`);
console.log(`  Signature Components   ${approvedComponents.length} / 期望 >= 5`);
console.log(`  Effect Packs           ${registry.assets.filter((a) => a.type === "effect").length}`);
console.log(`  Skills                 ${registry.assets.filter((a) => a.type === "skill").length}`);
console.log(`  Infrastructure Pkgs    ${registry.assets.filter((a) => a.type === "package").length}（contracts / react-utils / cli）`);
console.log("");

/* -------------------------------------------------------------------------- */

const errors = findings.filter((finding) => finding.level === "error").length;
const warns = findings.filter((finding) => finding.level === "warn").length;
if (errors > 0) {
  console.log(`✗ ${errors} 处 error、${warns} 处 warn —— 退出码 1\n`);
  process.exit(1);
}
console.log(`OK 0 处 error${warns > 0 ? `、${warns} 处 warn（见 [3]）` : ""} —— 退出码 0\n`);
