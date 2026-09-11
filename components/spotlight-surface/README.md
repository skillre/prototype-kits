# Signature Component · SpotlightSurface

> 一块**响应指针的表面**。它是 Adapter 模式的参考实现：
> 产品只说「语调 + 强度」，光斑的颜色、尺寸、幅度全部由 Style Pack 决定。

| | |
|---|---|
| **内部 API** | `1.0.0` |
| **status** | `approved` |
| **performance** | **B** · ≈1.2 KB gzip · 0 运行时依赖 |
| **SSR** | ✅ 兼容 |
| **mobile** | ✅ 内建降级 |
| **reduced-motion** | ✅ 内建降级（退化为静态高光，不消失） |

---

## 1. 契约：产品只能这样调用

```tsx
import { SpotlightSurface } from "@kits/spotlight-surface";

<SpotlightSurface tone="brand" intensity="medium">
  <p className="kits-label">Active signal</p>
  <p className="kits-data">1,284</p>
</SpotlightSurface>
```

### Props

| prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `tone` | `"neutral" \| "brand" \| "signal" \| "critical"` | `neutral` | 映射到 pack 颜色槽位 |
| `intensity` | `"none" \| "subtle" \| "medium" \| "strong"` | `medium` | `none` = 完全关闭光斑 |
| `surface` | `"plain" \| "glass"` | `plain` | `glass` 只在 cinematic 下有意义 |
| `as` | `"div" \| "li" \| "section" \| "article"` | `div` | 语义元素 |
| `clip` | `boolean` | `true` | 裁切超出的光斑 |
| `children` | `ReactNode` | — | 内容（z-index 高于光斑） |
| `disableMotion` | `boolean` | `false` | 仅产品级开关 |

### 明确不暴露（传入即契约违规）

`glowColor` · `blurRadius` · `opacity` · `size` · `offsetX/Y` · `followSpeed` · 任何视觉字面量。

---

## 2. Adapter 模式（本组件的存在理由）

这是最容易被第三方 API 污染的一类组件。下面是**完整的换库演练**：

### 第 0 步：反例 —— 产品直接依赖第三方

```tsx
// ❌ 产品代码
import { FancyGlowCard } from "fancy-glow-ui";

<FancyGlowCard
  glowColor="#4fd6ff"   // ← 颜色泄漏到产品
  blurRadius={24}       // ← 实现细节泄漏到产品
  opacity={0.6}
  followSpeed={0.15}
/>
```

问题：第三方改一个 prop 名、换默认值、停止维护 —— 产品就要全站重构。
而且 `#4fd6ff` 一旦写进产品，**换 Style Pack 时它不会跟着变**。

### 第 1 步：第三方资产先进入 `incoming/`

```
incoming/components/fancy-glow-ui/
├── SOURCE.md        # 仓库、commit、作者
├── LICENSE          # 许可证原文（或指向）
├── AUDIT.md         # 依赖审计 / 体积 / 兼容性 / 已知问题
└── raw/             # 原始文件（禁止直接引用）
```

走完整流程：`inspect → license → dependency audit → compatibility audit`。

### 第 2 步：写 Adapter

```tsx
// components/spotlight-surface/adapters/fancy-glow.tsx
import { FancyGlowCard } from "fancy-glow-ui";
import { INTENSITY_SCALE, TONE_VAR } from "../../_shared/contract.ts";
import type { SpotlightSurfaceProps } from "../spotlight-surface.tsx";

export function SpotlightSurfaceAdapter({
  tone = "neutral", intensity = "medium", surface = "plain", children, ...rest
}: SpotlightSurfaceProps) {
  return (
    <FancyGlowCard
      // 产品语义 → 第三方数值，映射只写在这一行里
      glowColor={`var(${TONE_VAR[tone]})`}
      blurRadius={24 * INTENSITY_SCALE[intensity]}
      opacity={0.6 * INTENSITY_SCALE[intensity]}
      followSpeed={0.15}
      glass={surface === "glass"}
      {...rest}
    >
      {children}
    </FancyGlowCard>
  );
}
```

### 第 3 步：产品代码 **一行不改**

```tsx
<SpotlightSurface tone="brand" intensity="medium">…</SpotlightSurface>
```

> `productCodeChanged: false` —— 这就是 Adapter 存在的全部理由。
> manifest 里的 `adapter.workedExample` 记录了这次映射，供后续审计追溯。

---

## 3. 实现要点

- **光斑层是独立 `<span>`**：`aria-hidden="true"` + `pointer-events: none`，
  内容层 `z-index: 1` 盖在它之上。
- **位移用 `translate`，不用 `background-position`**：后者每帧触发绘制，
  前者只走合成层 —— 这是分级 B 而不是 C 的原因。
- **静止位置有 CSS 兜底**：`--kits-px: 0.5; --kits-py: 0`。
  即使 JS 完全没跑起来，表面也是完整可用的（顶部居中的静态高光）。
- **幅度三因子**：位移 = `(指针比例 − 0.5) × 容器宽度 × --kits-pointer-factor`。
  editorial `0.15` → 几乎不动；instrument `0.4`；cinematic `1.0` → 完整跟随。

### 同一份调用，三种结果

| pack | `--kits-spotlight-size` | `--kits-spotlight-opacity` | `--kits-pointer-factor` | 视觉结果 |
|---|---|---|---|---|
| editorial | 220px | **0** | 0.15 | 光斑**完全消失**，只剩纸质表面 |
| cinematic | 320px | 0.5 | 1.0 | 明显跟随的大光斑 |
| instrument | 140px | 0.16 | 0.4 | 读数上的呼吸式高光 |

> 这张表就是「Kits 负责变化」的证据：**组件代码零差异，视觉完全不同**。

---

## 4. 无障碍（accessibility notes）

- 光斑层 `aria-hidden="true"` + `pointer-events: none`：不进入无障碍树，不拦截点击。
- `tone` 用**语义命名**（`brand` / `signal` / `critical`）而不是色相命名 ——
  色相是视觉决策，语义是产品意图。
- `tone="critical"` 的颜色**不足以单独表达告警**：调用方必须在内容里同时给出文字或图标。
- 组件自身不含可聚焦元素。若 `children` 里放交互控件，焦点环由 pack 的
  `--kits-color-focus` 保证可见（深色 pack 尤其要注意）。
- 光斑**不是文字背景**：内容层 z-index 更高，文本可读性不依赖光斑。

---

## 5. 移动端降级

| 条件 | 行为 |
|---|---|
| `pointer: coarse` / `hover: none` | 不注册 `pointermove`；`translate` 归零；光斑停在顶部居中 |
| 视口 ≤ 640px | 内容内边距降到 `--kits-space-sm`，为卡片争取可用宽度 |

**为什么触屏要关跟随**：手指在屏上拖动 = 滚动，不是 hover。
跟随会造成滚动过程中光斑乱窜 + 每帧写入 CSS 变量，是纯粹的掉帧来源。

**无内容损失**：表面、边框、圆角、内容全部照常，只是光斑不跟随。

---

## 6. reduced-motion 降级

光斑**不消失**，而是变成一张静态的顶部高光：

```css
@media (prefers-reduced-motion: reduce) {
  :root { --kits-pointer-factor: 0 !important; }
}
```

- JS 层：`enabled === false` → 不注册监听，且 `flush()` 把 `--kits-px` 复位到静止值。
- CSS 层：`translate` 的乘子被强制为 0。
- 结果：视觉信息（"这里有一块高光"）保留，动效（跟随）移除。这是正确的取舍 ——
  reduced-motion 用户要的是**没有运动**，不是**没有设计**。

---

## 7. SSR / Next.js 兼容性

- 组件带 `"use client"`，可作为客户端叶子放进 RSC 树。
- **服务端产物本身可用**：静止位置由 CSS 兜底，HTML 里的表面是完整外观，
  不依赖 JS 才能正确显示。
- 首帧 `--kits-px` 不会被 JS 覆盖（`enabled` 初始为 `false`），
  挂载后才启用 → 无 hydration mismatch。
- 渲染期不读 `window`；无随机数、无时间戳。

---

## 8. 性能分级

**B** —— 位移走合成层，但 `radial-gradient` 有真实绘制成本。

| 项 | 值 |
|---|---|
| gzip | ≈1.2 KB |
| 每帧成本 | 仅 `translate` 合成（无绘制、无重排） |
| 首次绘制 | 1 次 radial-gradient（320px 直径，成本可忽略） |
| `surface="glass"` | 引入 `backdrop-filter` → **同屏 ≤ 2 处** |

**约束**：
1. 同屏 spotlight 数量 ≤ 6（每个都是独立绘制层）。
2. `surface="glass"` 不要用在列表项上 —— 每项一次滤镜 = 移动端掉帧。
3. 不要给光斑再叠加 `box-shadow` 动画（会从合成层退回绘制）。

---

## 9. Changelog

| 版本 | 变更 |
|---|---|
| `1.0.0` | 首个稳定版：tone / intensity / surface / as / clip |
