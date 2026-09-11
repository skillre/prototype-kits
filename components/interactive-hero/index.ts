/**
 * @kits/interactive-hero —— 组件入口。
 *
 * CSS 由组件自己引入（`interactive-hero.css`），产品不需要单独 import。
 * 组件只输出 `kits-*` 前缀的类名，不使用任何 CSS Modules / Tailwind，
 * 因此可以被任意 Next.js / Vite / Remix 项目直接消费。
 */

export {
  InteractiveHero,
  default,
  type InteractiveHeroProps,
} from "./interactive-hero.tsx";
