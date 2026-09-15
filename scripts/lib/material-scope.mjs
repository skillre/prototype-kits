/**
 * 材质边界扫描 —— 「Personality must remain explicit」的机械判据（Kits v0.2 · K8）。
 *
 * ===========================================================================
 * 它检查什么
 * ===========================================================================
 * 一个 pack / effect 的样式表**允许**：
 *
 *   · 在全局选择器（`:root` / `html` / `body` / `*`）上声明**自定义属性** ——
 *     变量是"能力"，声明它不会改变任何像素；
 *   · 在属于自己的选择器里作画（pack：`[data-kits-pack="<id>"]…`；
 *     effect：`.kits-effect-<id>…`）；
 *   · 定义 `@keyframes` —— 关键帧只是名字，只有被某条规则引用才生效，
 *     而那条规则本身要过这一关。
 *
 * **不允许**在全局选择器上作画（background / box-shadow / filter / text-shadow /
 * border / opacity / animation …）。否则"安装 Kits"就会自动改变页面外观 ——
 * 那正是 v1.2 从 Factory Core 移走 personality 要解决的事，不能在 Kits 里重演。
 *
 * ===========================================================================
 * 为什么写得这么小
 * ===========================================================================
 * 这里不是 CSS 解析器，只回答一个问题：「这条声明有没有属性作用域的祖先？」
 * 所以它只认两件事 —— 选择器文本与声明列表，不建 AST、不解析层叠、不评估优先级。
 * 判据必须是**可复核**的：任何一个开发者都能把规则贴进浏览器 DevTools 里验证。
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** 会改变像素的属性前缀。自定义属性（`--kits-*`）**不在**此列 —— 变量不是作画。 */
export const PAINT_PROPERTIES = [
  "background",
  "background-color",
  "background-image",
  "box-shadow",
  "filter",
  "backdrop-filter",
  "text-shadow",
  "border",
  "outline",
  "mask",
  "opacity",
  "mix-blend-mode",
  "animation",
  "content",
];

const isPaint = (prop) => {
  if (prop.startsWith("--")) return false;
  return PAINT_PROPERTIES.some((paint) => prop === paint || prop.startsWith(`${paint}-`));
};

/** 容器型 at-rule（内部还有真正的样式规则）；其余 `@…` 块整体跳过。 */
const CONTAINERS = ["@media", "@supports", "@layer", "@container", "@scope"];
const isContainer = (prelude) => CONTAINERS.some((at) => prelude.startsWith(at));
const isOpaque = (prelude) =>
  prelude.startsWith("@") && !isContainer(prelude) && !prelude.startsWith("@import");

/**
 * 把样式表切成 `{selector, declarations}` 列表。
 *
 * 嵌套容器（`@media` 内）会被展开成其中的样式规则 —— 判定只看选择器，
 * 不看它被哪一层容器包着。
 *
 * @param {string} css
 * @returns {Array<{selector: string, declarations: Array<{prop: string, value: string}>}>}
 */
export function parseRules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  /** @type {Array<{prelude: string, opaque: boolean, container: boolean}>} */
  const stack = [];
  let cursor = 0;
  let preludeStart = 0;

  while (cursor < text.length) {
    const char = text[cursor];
    if (char === "{") {
      const prelude = text.slice(preludeStart, cursor).trim();
      stack.push({
        prelude,
        opaque: isOpaque(prelude),
        container: isContainer(prelude),
      });
      preludeStart = cursor + 1;
      cursor += 1;
      continue;
    }
    if (char === "}") {
      const frame = stack[stack.length - 1];
      const body = text.slice(preludeStart, cursor);
      const insideOpaque = stack.some((entry) => entry.opaque);
      if (frame && !frame.opaque && !frame.container && !insideOpaque) {
        rules.push({ selector: frame.prelude, declarations: parseDeclarations(body) });
      }
      stack.pop();
      preludeStart = cursor + 1;
      cursor += 1;
      continue;
    }
    cursor += 1;
  }
  return rules;
}

/** `prop: value` 列表（跳过 `@…` 声明语句）。 */
function parseDeclarations(body) {
  const declarations = [];
  for (const chunk of body.split(";")) {
    const text = chunk.trim();
    if (!text || text.startsWith("@")) continue;
    const colon = text.indexOf(":");
    if (colon === -1) continue;
    declarations.push({
      prop: text.slice(0, colon).trim().toLowerCase(),
      value: text.slice(colon + 1).trim(),
    });
  }
  return declarations;
}

/* -------------------------------------------------------------------------- */
/* 作用域判定                                                                   */
/* -------------------------------------------------------------------------- */

/** pack 的作用域：选择器里出现它自己的根选择器即算"在自己的地盘上作画"。 */
export function packScope(packId) {
  return (selector) => selector.includes(`[data-kits-pack="${packId}"]`);
}

/** effect 的作用域：选择器里出现它自己声明的类。 */
export function effectScope(className) {
  return (selector) => selector.includes(`.${className}`);
}

/**
 * 扫描一份样式表，返回 `{ rules, paintRules, violations }`。
 *
 * violations 里每条都带上**为什么**：`selector` + `prop` + `value` + 判断依据，
 * 因为「你违反了规则」没有用，「body 上的 background-image 会污染每一个页面」才有用。
 *
 * @param {string} css
 * @param {{ scoped: (selector: string) => boolean, label: string }} options
 */
export function scanPaintScope(css, { scoped, label }) {
  const rules = parseRules(css);
  let paintRules = 0;
  const violations = [];
  for (const rule of rules) {
    const paints = rule.declarations.filter((decl) => isPaint(decl.prop));
    if (paints.length === 0) continue;
    paintRules += 1;
    if (scoped(rule.selector)) continue;
    for (const decl of paints) {
      violations.push({
        label,
        selector: rule.selector,
        prop: decl.prop,
        value: decl.value,
        why:
          `选择器 \`${rule.selector}\` 没有作用域（既不是自己的资产选择器，也不是子选择器），` +
          `却声明了 \`${decl.prop}\` —— 这会在任何人显式使用它之前就改变页面外观`,
      });
    }
  }
  return { rules: rules.length, paintRules, violations };
}

/** 读一个仓库相对路径的 CSS（不存在则 null）。 */
export function readAssetCss(root, rel) {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, "utf8");
}
