/**
 * 兼容性审计 —— 目标产品的 React / Next / TypeScript 版本。
 *
 * ---------------------------------------------------------------------------
 * 这条规则的来历（一次真实事故）
 * ---------------------------------------------------------------------------
 * 第一次真实 Style Migration 里，产品侧的 `pnpm typecheck` 与 `pnpm build`
 * 同时失败在 **Kits 自己的源文件**上：
 *
 *   ../prototype-kits/components/insight-reveal/insight-reveal.tsx(92,7): TS2322
 *   Type 'Ref<never>' is not assignable to type '… & … & …'
 *     Two different types with this name exist, but they are unrelated.
 *
 * 现场看像是那一行 `ref as React.Ref<never>` 的锅。真实根因是：
 *
 *   产品  @types/react  →  19.2.18
 *   Kits  @types/react  →  19.3.0
 *
 * 源码分发 + 符号链接意味着 TS 会**用 Kits 自己那份** @types/react 去检查
 * Kits 的文件，于是同一次编译里出现两份 `VoidOrUndefinedOnly`。
 *
 * 这个错误对使用者毫无指向性：它出现在别人的文件里，报的是类型不兼容，
 * 而修法是「把两个仓库的 @types/react 对齐」。
 *
 * 因此本模块的目标不是"阻止安装"，而是**在安装/检查阶段把这件事说清楚**：
 * 版本不一致本身完全合法（Kits 支持 ^18 || ^19），
 * 但**两边必须解析到同一个 major**。
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Kits 组件支持的 React peer 区间（与各组件 package.json 保持一致）。 */
export const SUPPORTED_REACT_RANGE = "^18.0.0 || ^19.0.0";

/** 从 semver 字符串里取 major。 */
function majorOf(range) {
  const match = String(range).match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

/**
 * 读目标产品的实际版本。只看**解析结果**，不看声明：
 * 声明 `^19` 而实际装的是 18 的情况必须被发现。
 *
 * @param {string} productRoot
 */
export function readTargetVersions(productRoot) {
  const pkgFile = path.join(productRoot, "package.json");
  if (!existsSync(pkgFile)) return null;
  const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
  const declared = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.peerDependencies ?? {}),
  };

  const resolved = {};
  for (const name of [
    "react",
    "react-dom",
    "@types/react",
    "@types/react-dom",
    "next",
    "typescript",
  ]) {
    resolved[name] = readResolvedVersion(productRoot, name) ?? declared[name] ?? null;
  }
  return { declared, resolved };
}

/** 读 node_modules 里真实安装的版本。 */
function readResolvedVersion(productRoot, name) {
  const file = path.join(productRoot, "node_modules", name, "package.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")).version ?? null;
  } catch {
    return null;
  }
}

/**
 * 审计结果。
 *
 * @param {string} productRoot
 * @param {{ kitsReactTypesVersion?: string|null, kitsReactMajor?: number, kitsTypesMajor?: number }} kitsInfo
 * @returns {{ ok: boolean, checks: Array<{id:string,status:"pass"|"warn"|"fail",detail:string,hint?:string}> }}
 */
export function auditCompatibility(productRoot, kitsInfo = {}) {
  const checks = [];
  const versions = readTargetVersions(productRoot);

  if (!versions) {
    checks.push({
      id: "target-manifest",
      status: "fail",
      detail: "目标目录里没有 package.json",
      hint: "`kits add --target <产品根>` 必须指向一个 Node 项目根。",
    });
    return { ok: false, checks };
  }

  const react = versions.resolved["react"];
  const reactTypes = versions.resolved["@types/react"];

  // --- React 本体 ---------------------------------------------------------
  if (!react) {
    checks.push({
      id: "react-present",
      status: "fail",
      detail: "目标项目没有解析到 react",
      hint: "Kits 的 Signature Component 需要 React ^18 || ^19。",
    });
  } else {
    const major = majorOf(react);
    const ok = major === 18 || major === 19;
    checks.push({
      id: "react-major",
      status: ok ? "pass" : "fail",
      detail: `react ${react}（支持 ${SUPPORTED_REACT_RANGE}）`,
      hint: ok ? undefined : "把 react 升级到 18 或 19，或改用不依赖 react 的 style / effect 资产。",
    });
  }

  // --- @types/react 的 major 一致性（事故现场这一条是空的） ---------------
  if (!reactTypes) {
    checks.push({
      id: "react-types-present",
      status: "warn",
      detail: "目标项目没有解析到 @types/react",
      hint: "TypeScript 项目应安装 @types/react；否则 Kits 的组件源码无法被类型检查。",
    });
  } else {
    const targetMajor = majorOf(reactTypes);
    const kitsTypesMajor = kitsInfo.kitsTypesMajor ?? null;
    const sameMajor = kitsTypesMajor === null || targetMajor === kitsTypesMajor;
    checks.push({
      id: "react-types-major-parity",
      status: sameMajor ? "pass" : "fail",
      detail: sameMajor
        ? `@types/react ${reactTypes}，与 Kits 解析到同一 major（${targetMajor}）`
        : `@types/react 版本漂移：目标 ${reactTypes}（major ${targetMajor}）vs Kits ${kitsInfo.kitsReactTypesVersion ?? "?"}（major ${kitsTypesMajor}）`,
      hint: sameMajor
        ? undefined
        : `把两边对齐到同一个 minor 亦可。最省事的做法是把产品的 @types/react 钉到与 Kits 相同的版本。` +
          `漂移的后果是 Kits 自己的源文件会在你的 tsc 里报出「Two different types with this name exist」这类错误 —— 错误指向 Kits，根因在版本。`,
    });
  }

  // --- React 与 @types/react 的 major 应当一致 ----------------------------
  if (react && reactTypes) {
    const a = majorOf(react);
    const b = majorOf(reactTypes);
    checks.push({
      id: "react-vs-types-major",
      status: a === b ? "pass" : "warn",
      detail:
        a === b
          ? `react ${react} 与 @types/react ${reactTypes} 的 major 一致`
          : `react major ${a} 与 @types/react major ${b} 不一致`,
      hint: a === b ? undefined : "@types/react 的 major 通常应与 react 一致。",
    });
  }

  // --- TypeScript --------------------------------------------------------
  const ts = versions.resolved["typescript"];
  checks.push({
    id: "typescript-present",
    status: ts ? "pass" : "warn",
    detail: ts ? `typescript ${ts}` : "没有解析到 typescript",
    hint: ts ? undefined : "Kits 是源码分发（.ts/.tsx），产品需要 TypeScript 才能编译它。",
  });

  const ok = !checks.some((c) => c.status === "fail");
  return { ok, checks, versions };
}
