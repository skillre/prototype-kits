/**
 * @kits/style-editorial —— pack 的 TypeScript 入口。
 *
 * CSS 是主入口，`tokens.css` 通过包名直接引入：
 *
 *   import "@kits/style-editorial/tokens.css";
 *
 * 本文件导出 pack 的 motion 契约与维度立场，供 Playground 的并排对比、
 * Registry 审计和测试使用。产品代码通常只需要 CSS + `data-kits-pack`。
 */

import type { StylePackMotion, StylePackProfile } from "../_contract/contract.ts";
import { editorialMotion } from "./motion.ts";

export { editorialMotion };
export default editorialMotion;

export const editorialMotionTokens: StylePackMotion = editorialMotion;

export const editorialProfile: StylePackProfile = {
  typeVoice: "editorial",
  spacingRhythm: "generous",
  density: "low",
  radiusPhilosophy: "flush",
  borderTreatment: "hairline-rule",
  surfaceTreatment: "paper",
  navigationFeel: "running-head",
  dataLanguage: "ink-rules",
  motionLanguage: "restrained",
  hierarchyMethod: "scale-and-space",
};

export const editorialMeta = {
  id: "editorial",
  name: "Editorial",
  selector: '[data-kits-pack="editorial"]',
  cssEntry: "@kits/style-editorial/tokens.css",
} as const;
