import type { StylePackMotion, StylePackProfile } from "@kits/contracts";
import {
  editorialMotion,
  editorialProfile,
} from "@kits/style-editorial";
import {
  cinematicMotion,
  cinematicProfile,
} from "@kits/style-cinematic";
import {
  consoleMotion,
  consoleProfile,
} from "@kits/style-console";
import {
  instrumentMotion,
  instrumentProfile,
} from "@kits/style-instrument";

import cinematicManifest from "@kits/style-cinematic/manifest.json";
import consoleManifest from "@kits/style-console/manifest.json";
import editorialManifest from "@kits/style-editorial/manifest.json";
import instrumentManifest from "@kits/style-instrument/manifest.json";

import registry from "../../registry/assets.json";

// 状态词的唯一实现（与 CLI 审计共用）。刻意从 fit-semantics 进：
// 那是纯模块，不 import node:fs —— manifest-contract.mjs 会用 fs 核对文件，
// 在 Server Component 里 import 它会让 Turbopack 追踪整个项目。
import { deriveMobileState } from "../../scripts/lib/fit-semantics.mjs";

/**
 * Registry 视图数据。
 *
 * **「有哪些 Style Pack」不在这个文件里。** 名单的唯一权威是
 * `registry/assets.json`：这里只把它筛成视图要用的形状
 * （`type === "style"` 且 `status === "approved"`），并**保持 registry 的登记顺序**。
 *
 * 为什么这仍然不是「第二份数据源」：
 *   - **名单**（有哪些 pack、什么顺序）来自 registry；
 *   - **单个 pack 的运行时数据**（profile / motion / material）来自该包的
 *     `index.ts` 与 `manifest.json`，两者必须一致 —— 由 `tests/contracts.spec.ts` 强制校验。
 *
 * 之所以在 Playground 里内联这些常量而不是运行时读 manifest.json：
 * manifest 是给审计者读的文件，不是运行时数据源。让 Playground
 * 直接 import 类型化导出，可以在构建期就发现契约漂移。
 *
 * 新增一套 pack = 改 registry + 在下面的 `PACK_RUNTIME` 里接线。
 * 只登记而忘了接线时，视图**不会静默地少一列**：`MISSING_PACK_RUNTIME`
 * 会被 Playground 显式渲染成一条缺口说明，`pnpm test` 也会红
 * （`tests/playground-pack-coverage.spec.ts`）。
 */

/** 只取视图真正要读的字段：其余形状由 registry schema 与 `pnpm registry` 负责。 */
type RegistryAsset = {
  id: string;
  name?: string;
  type: string;
  status: string;
  selector?: string;
  cssEntry?: string;
};

/**
 * 已登录且已批准的 Style Pack，**按 registry 顺序**。
 *
 * 不再写死 pack id：K1 新增 `console` 之后，「三套」这种常量在本仓里
 * 已经变成了一句过期的话（它自己的 Playground 从没渲染过第四套）。
 */
export const STYLE_PACK_ASSETS: RegistryAsset[] = (
  registry.assets as unknown as RegistryAsset[]
).filter((asset) => asset.type === "style" && asset.status === "approved");

export interface PackView {
  /** 来自 registry，不是手写的字面量联合类型。 */
  id: string;
  label: string;
  selector: string;
  cssEntry: string;
  profile: StylePackProfile;
  motion: StylePackMotion;
}

/** `materialDirection` 只住在 pack manifest 里（与 `darkDirection` 一样）。 */
export interface MaterialView {
  hierarchy: string;
  ambient: string;
  glow: string;
}

/**
 * id → 运行时数据。
 *
 * 这个映射**只提供数据，不决定名单**：它的键是接线记录，少了谁由
 * `MISSING_PACK_RUNTIME` 说出来，而不是由它静默决定。
 */
const PACK_RUNTIME: Record<
  string,
  { profile: StylePackProfile; motion: StylePackMotion; material: MaterialView }
> = {
  editorial: {
    profile: editorialProfile,
    motion: editorialMotion,
    material: editorialManifest.materialDirection as MaterialView,
  },
  cinematic: {
    profile: cinematicProfile,
    motion: cinematicMotion,
    material: cinematicManifest.materialDirection as MaterialView,
  },
  instrument: {
    profile: instrumentProfile,
    motion: instrumentMotion,
    material: instrumentManifest.materialDirection as MaterialView,
  },
  console: {
    profile: consoleProfile,
    motion: consoleMotion,
    material: consoleManifest.materialDirection as MaterialView,
  },
};

interface PackEntry {
  view: PackView;
  material: MaterialView;
}

/** registry 里 approved、但视图还没接线的 pack。空数组是正常状态，非空是**视图缺口**。 */
export const MISSING_PACK_RUNTIME: string[] = STYLE_PACK_ASSETS.filter(
  (asset) => !PACK_RUNTIME[asset.id],
).map((asset) => asset.id);

const PACK_ENTRIES: PackEntry[] = STYLE_PACK_ASSETS.flatMap((asset) => {
  const runtime = PACK_RUNTIME[asset.id];
  if (!runtime) return [];
  return [
    {
      view: {
        id: asset.id,
        label: asset.name ?? asset.id,
        selector: asset.selector ?? `[data-kits-pack="${asset.id}"]`,
        cssEntry: asset.cssEntry ?? "",
        profile: runtime.profile,
        motion: runtime.motion,
      },
      material: runtime.material,
    },
  ];
});

export const PACK_VIEWS: PackView[] = PACK_ENTRIES.map((entry) => entry.view);

/** 契约里要求"明显不同"的十个维度，按顺序列出便于逐行对比。 */
export const PROFILE_DIMENSIONS: Array<{
  key: keyof StylePackProfile;
  label: string;
  hint: string;
}> = [
  { key: "typeVoice", label: "typography", hint: "排版性格" },
  { key: "spacingRhythm", label: "spacing rhythm", hint: "间距节奏" },
  { key: "density", label: "density", hint: "信息密度" },
  { key: "radiusPhilosophy", label: "radius philosophy", hint: "圆角哲学" },
  { key: "borderTreatment", label: "border treatment", hint: "边界处理" },
  { key: "surfaceTreatment", label: "surface treatment", hint: "表面处理" },
  { key: "navigationFeel", label: "navigation feel", hint: "导航手感" },
  { key: "dataLanguage", label: "data visualization", hint: "数据语言" },
  { key: "motionLanguage", label: "motion language", hint: "动效语言" },
  { key: "hierarchyMethod", label: "visual hierarchy", hint: "层级建立方式" },
];

/* -------------------------------------------------------------------------- */
/* 移动端状态（K2）                                                            */
/* -------------------------------------------------------------------------- */

/**
 * 兼容 ≠ 推荐。这一层**不自己发明状态词**：它调用 CLI 审计用的同一个函数
 * （`scripts/lib/manifest-contract.mjs` 的 `deriveMobileState`），
 * 所以「instrument 可用但不推荐」「data-cursor 仅降级形态」在 CLI、审计页、
 * 组件验收页上是同一句话。
 */
export interface FitFields {
  mobileCompatible: boolean | string;
  recommendedFor?: string[];
  avoidFor?: string[];
}

export const mobileStateOf = (asset: FitFields): string =>
  deriveMobileState(asset);

export const MOBILE_STATE_LABEL: Record<string, string> = {
  recommended: "推荐",
  discouraged: "可用但不推荐",
  compatible: "允许（需适配）",
  "fallback-only": "仅降级形态",
  unsupported: "不支持",
  "not-applicable": "不适用",
};

export const MOBILE_STATE_CLASS: Record<string, string> = {
  recommended: "pg-pill--approved",
  compatible: "pg-pill--approved",
  discouraged: "pg-pill--experimental",
  "fallback-only": "pg-pill--experimental",
  unsupported: "pg-pill--deprecated",
  "not-applicable": "pg-pill--incoming",
};

/* -------------------------------------------------------------------------- */
/* 材质语言（K8）                                                              */
/* -------------------------------------------------------------------------- */

/**
 * `materialDirection` 只住在 pack manifest 里（与 `darkDirection` 一样）——
 * 它描述的是"这套 pack 的材质性格"，不是运行时数据。
 *
 * 这一页只做一件事：让人一眼看懂**这套 pack 用什么建立层级、光归谁、发光有没有预算**。
 * 它刻意不展示 token 清单 —— 那会把审计页变成 token 浏览器。
 */
export const MATERIAL_VIEWS: Array<{ pack: PackView; material: MaterialView }> =
  PACK_ENTRIES.map((entry) => ({
    pack: entry.view,
    material: entry.material,
  }));

export const MATERIAL_LABEL: Record<string, string> = {
  light: "光与明暗",
  rule: "线与边界",
  space: "留白与间距",
  texture: "表面材质",
};

export const MATERIAL_AMBIENT_LABEL: Record<string, string> = {
  "pack-authored": "pack 自带（.kits-ambient）",
  "effect-only": "只能来自 Effect Pack",
  none: "没有环境光",
};

export const MATERIAL_GLOW_LABEL: Record<string, string> = {
  budgeted: "有预算（允许发光）",
  forbidden: "禁止（glow = transparent）",
};
