import {
  editorialMotion,
  editorialProfile,
} from "@kits/style-editorial";
import {
  cinematicMotion,
  cinematicProfile,
} from "@kits/style-cinematic";
import {
  instrumentMotion,
  instrumentProfile,
} from "@kits/style-instrument";

/**
 * Registry 视图数据。
 *
 * **这里不是第二份数据源**：所有值都从各包的 `index.ts` 导出派生，
 * 而包的 `index.ts` 又必须与 `manifest.json` 保持一致 ——
 * 这一点由 `tests/contracts.spec.ts` 强制校验。
 *
 * 之所以在 Playground 里内联这些常量而不是运行时读 manifest.json：
 * manifest 是给审计者读的文件，不是运行时数据源。让 Playground
 * 直接 import 类型化导出，可以在构建期就发现契约漂移。
 */

export interface PackView {
  id: "editorial" | "cinematic" | "instrument";
  label: string;
  selector: string;
  cssEntry: string;
  profile: typeof editorialProfile;
  motion: typeof editorialMotion;
}

export const PACK_VIEWS: PackView[] = [
  {
    id: "editorial",
    label: "Editorial",
    selector: '[data-kits-pack="editorial"]',
    cssEntry: "@kits/style-editorial/tokens.css",
    profile: editorialProfile,
    motion: editorialMotion,
  },
  {
    id: "cinematic",
    label: "Cinematic",
    selector: '[data-kits-pack="cinematic"]',
    cssEntry: "@kits/style-cinematic/tokens.css",
    profile: cinematicProfile,
    motion: cinematicMotion,
  },
  {
    id: "instrument",
    label: "Instrument",
    selector: '[data-kits-pack="instrument"]',
    cssEntry: "@kits/style-instrument/tokens.css",
    profile: instrumentProfile,
    motion: instrumentMotion,
  },
];

/** 契约里要求"明显不同"的十个维度，按顺序列出便于逐行对比。 */
export const PROFILE_DIMENSIONS: Array<{
  key: keyof typeof editorialProfile;
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
