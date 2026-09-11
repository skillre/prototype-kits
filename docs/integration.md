# 集成指南 · 在 Prototype 里使用 Kits

> 本文回答一件事：**一个新 Prototype 怎么接上 Kits，而不把 Kits 的东西抄进业务代码。**

---

## 0. 三种接入方式（按侵入度排序）

| 方式 | 适用 | 代价 |
|---|---|---|
| **A. workspace 依赖**（推荐） | 与本仓库同一台机器 / 同一 monorepo 根 | 需要 pnpm workspace 或 file: 依赖 |
| **B. git 依赖** | 独立仓库、CI 拉取 | 每次改 Kits 需要重新 install |
| **C. 复制 CSS 与源码** | 单次交付、不需要持续同步 | **会失去可审计性**，只允许应急使用 |

方式 C 必须显式记录在 Prototype 的 README 里，并计划迁回 A/B。

---

## 1. 方式 A：workspace 依赖

```yaml
# prototype-xxx/pnpm-workspace.yaml
packages:
  - "."
  - "../prototype-kits/styles/*"
  - "../prototype-kits/components/*"
```

```json
// prototype-xxx/package.json
{
  "dependencies": {
    "@kits/style-cinematic": "workspace:*",
    "@kits/spotlight-surface": "workspace:*",
    "@kits/insight-reveal": "workspace:*"
  }
}
```

Kits 是**源码分发**（`.ts` / `.tsx` / `.css`，没有构建产物）。
Next.js 项目需要声明转译：

```ts
// next.config.ts
const nextConfig: NextConfig = {
  transpilePackages: [
    "@kits/style-cinematic",
    "@kits/spotlight-surface",
    "@kits/insight-reveal",
  ],
  // 如果需要从仓库外引入 TS 源码：
  // experimental: { externalDir: true },
};
```

> **为什么源码分发**：你在编辑器里看到的，就是产品会跑到的东西。
> 没有"发布的 d.ts 与实现不一致"这类问题，也没有"改了 Kits 但产物没更新"。

---

## 2. 最小接入：一个页面

```tsx
// app/page.tsx
import "@kits/style-cinematic/tokens.css"; // ① 契约 + pack（顺序固定）
import { InteractiveHero } from "@kits/interactive-hero";

export default function Page() {
  return (
    <main data-kits-pack="cinematic">        {/* ② 声明 pack 作用域 */}
      <InteractiveHero
        eyebrow="Q3"
        title="让每一个数字都有光。"
        lead="实时读取 12 个数据源，把异常推到最亮的地方。"
        depth="medium"
      />
    </main>
  );
}
```

三条规矩：

1. **`tokens.css` 必须在最前面导入**（它内含契约层，提供变量兜底值）。
2. **`data-kits-pack` 至少要有一个**：没有它，所有 `--kits-*` 变量都退回契约层的中立值。
3. **产品代码里不写视觉字面量**：`#hex`、`24px`、`cubic-bezier(...)` 一律不出现。

---

## 3. 页面级样式与 pack 的关系

Prototype 通常已经有自己的 `globals.css`（Tailwind、shadcn 等）。
两者可以共存，分工是：

| 谁 | 管什么 |
|---|---|
| Prototype 的 `globals.css` | **应用外壳**：导航框架、弹窗容器、业务组件的基础样式 |
| Kits 的 pack | **内容区**：页面主体、区块、组件 |

```css
/* prototype-xxx/app/globals.css */
@import "tailwindcss";
@import "@kits/style-cinematic/tokens.css";   /* 放在应用样式之后 */

/* 应用外壳继续用 Tailwind */
.app-shell { @apply min-h-screen bg-background; }
```

**冲突面只有一个**：契约层在 `:root` 上提供了中立兜底变量（`--kits-*`），
pack 的取值全部写在 `[data-kits-pack]` 作用域内 —— 不会和 Tailwind 的变量打架。

---

## 4. 品牌色覆盖

pack 提供的是**完整的一套取值**（含颜色），写在 `[data-kits-pack]` 作用域内。
产品要换品牌色，只需在自己的容器上重新声明同名变量：

```css
/* prototype-xxx/app/globals.css */

/* 例：保留 cinematic 的排版/间距/动效，只换主色 */
[data-kits-brand="acme"][data-kits-pack="cinematic"] {
  --kits-color-accent: #6d28d9;      /* 品牌主色 */
  --kits-color-accent-ink: #ffffff;
  --kits-color-glow: rgb(109 40 217 / 0.5);
  --kits-color-focus: #6d28d9;
}
```

```tsx
<section data-kits-pack="cinematic" data-kits-brand="acme">…</section>
```

**允许覆盖**：颜色（accent / accent-2 / surface / ink 系列）。
**不建议覆盖**：排版、间距、密度、圆角、边界、动效 —— 那是 pack 的身份，
改掉之后就不再是这套风格了；需要不同性格请**换 pack**。

> 这条边界是刻意的：如果产品可以覆盖排版，那 pack 就退化成了"一组默认值"，
> 可替换性也就不存在了。

---

## 5. 一个页面里两种性格

允许，但必须分区，且每区独立声明：

```tsx
<main>
  {/* 深色叙事首屏 */}
  <section data-kits-pack="cinematic">…</section>

  {/* 浅色数据附表 */}
  <section data-kits-pack="instrument">…</section>
</main>
```

两条约束：

1. **不要嵌套** `data-kits-pack`（内层会继承并覆盖外层变量，容易出意外）。
2. 每个区自己导入需要的 pack CSS；**同页多 pack 是支持的**（颜色都在作用域内）。

---

## 6. 渐进接入（推荐路径）

不要一次换掉整个 Prototype。按这个顺序：

```
第 1 步  只在一个新页面上用一套 pack（验证集成链路）
第 2 步  把该页面里最像"视觉决策"的部分交给 pack（间距、边界、表面）
第 3 步  接入 1–2 个 Signature Component
第 4 步  在真实数据与真实边界条件下验证（空态、错误态、超长文本、390px）
第 5 步  才考虑把更多页面纳入
```

**每一步都要跑**：`pnpm lint && pnpm typecheck && pnpm build`，以及
390px 宽度下的手动检查（横向溢出是接入期最常见的问题）。

---

## 7. 接入检查清单

- [ ] `tokens.css` 在应用样式之后导入，且只导入需要的 pack
- [ ] 页面至少有一处 `data-kits-pack`
- [ ] 产品代码里没有 `#hex` / `px` 视觉字面量 / `cubic-bezier`
- [ ] 没有直接依赖第三方组件 API（用 Kits 的适配层）
- [ ] 390px 视口无横向溢出
- [ ] `prefers-reduced-motion: reduce` 下信息完整
- [ ] 触屏下没有 hover-only 的信息（例如只靠指针揭示的读数）
- [ ] CI 里跑 `pnpm build`（SSR 阶段不能报错）
- [ ] 如果用了方式 C（复制源码），已在 README 记录并计划迁回

---

## 8. 常见错误

| 错误 | 症状 | 修法 |
|---|---|---|
| 忘了导入 `tokens.css` | 页面像没样式，或退回中立值 | 导入契约 + pack |
| 忘了 `data-kits-pack` | 变量拿不到取值 | 加在容器上 |
| 在组件里写死颜色 | 换 pack 时不变 | 改成 `var(--kits-*)` |
| 直接依赖第三方 API | 换库要全站重构 | 引入 Kits 的适配层 |
| 一个页面嵌套两个 pack | 内层样式诡异 | 改成并列分区 |
| 覆盖了 pack 的排版 | "换 pack 没效果" | 只覆盖颜色，或换 pack |
