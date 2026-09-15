/**
 * 适配语义 —— 纯函数与固定表，**不碰文件系统**。
 *
 * 为什么单独一个文件：同一份语义有四个消费者，其中两个跑在浏览器/SSR 里
 * （Playground 的审计页与组件验收页是 Server Component），它们不能 import 带
 * `node:fs` 的模块。把「意义」与「读文件核对」分开之后：
 *
 *   scripts/lib/fit-semantics.mjs     ← 意义（这里，纯函数，可被任何环境 import）
 *   scripts/lib/manifest-contract.mjs  ← 执行（读 registry 与 manifest，做判定）
 *   scripts/registry-audit.mjs         ← 报告
 *   tests/manifest-contract.spec.ts    ← 门禁
 *   playground/components/registry-view.ts ← 展示（与 CLI 共用 deriveMobileState）
 *
 * 拆分的边界是**纯粹性**，不是功能：语义本身只有一份实现，谁也不许复制状态词表。
 */

/**
 * 兼容 ≠ 推荐。这两个维度分开之后，输出必须是**状态词**，不是 yes/no：
 *
 *   recommended      兼容，且 recommendedFor 含 mobile
 *   discouraged      兼容，但 avoidFor 含 mobile（技术上能用，设计上不推荐）
 *   compatible       兼容，两边都没说
 *   fallback-only    只能在声明的 mobileFallback 下使用（能力关闭，零内容损失）
 *   unsupported      false
 *   not-applicable   非视觉资产
 *
 * @param {{ mobileCompatible: boolean | string, recommendedFor?: string[], avoidFor?: string[] }} asset
 * @returns {"recommended"|"discouraged"|"compatible"|"fallback-only"|"unsupported"|"not-applicable"}
 */
export function deriveMobileState({ mobileCompatible, recommendedFor = [], avoidFor = [] }) {
  if (mobileCompatible === "not-applicable") return "not-applicable";
  if (mobileCompatible === false) return "unsupported";
  if (mobileCompatible === "fallback-only") return "fallback-only";
  // 「又推荐又回避」的冲突不在这里裁决：K7 把它判成 error，这里只负责派生状态。
  if (recommendedFor.includes("mobile")) return "recommended";
  if (avoidFor.includes("mobile")) return "discouraged";
  return "compatible";
}

/** `x-` 命名空间：允许扩展，但必须长得像扩展（audit 会把它全部列出来）。 */
export const isExtensionTag = (value) =>
  typeof value === "string" && /^x-[a-z0-9]+(-[a-z0-9]+)*$/.test(value);

/**
 * 资产分类（与 schema 的 asset.type 枚举一致）。
 */
export const ASSET_TYPES = ["style", "component", "effect", "skill", "package"];

/**
 * 引用字段 → 它允许指向的资产类型。
 * **字段名写 effect 不等于它真是 effect** —— 这正是 cinematic 把 `animated-grid`
 * （component）塞进 `effects[]` 还能过审的原因。
 */
export const REFERENCE_FIELDS = {
  signatureComponents: "component",
  optionalComponents: "component",
  discouragedComponents: "component",
  effects: "effect",
};

/**
 * 组件 manifest 的 `usedByStylePacks` 是 **pack id → 角色词**的映射，
 * 角色词与 pack manifest 的三个列表一一对应。同一件事两处写，就必须对得上。
 */
export const PACK_ROLE_FIELDS = {
  signature: "signatureComponents",
  optional: "optionalComponents",
  discouraged: "discouragedComponents",
};

/** `"optional（editorial 的 ...）"` → `"optional"`（角色词后的括号说明是给人读的）。 */
export function parsePackRole(value) {
  if (typeof value !== "string") return { role: null, raw: value };
  const match = value.match(/^\s*([a-z][a-z-]*)/);
  return { role: match ? match[1] : null, raw: value };
}
