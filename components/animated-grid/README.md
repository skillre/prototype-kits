# Signature Component · AnimatedGrid

> 一层**结构性的背景网格**：给界面一个空间度量，让内容看起来被放在一个有尺度的面上。

| | |
|---|---|
| **内部 API** | `1.0.0` |
| **status** | `approved` |
| **performance** | **B** · ≈0.7 KB gzip · **纯 CSS 网格** |
| **SSR** | ✅ 兼容（JS 完全失败也照常显示） |
| **mobile** | ✅ 内建降级 |
| **reduced-motion** | ✅ 内建降级 |

---

## 1. 契约：产品只能这样调用

```tsx
import { AnimatedGrid } from "@kits/animated-grid";

<div style={{ position: "relative", isolation: "isolate" }}>
  <AnimatedGrid cell="normal" fade="medium" motion="drift" />
  <h1>…</h1>
</div>
```

### Props

| prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `cell` | `"none" \| "dense" \| "normal" \| "wide"` | `normal` | 密度**乘数**（绝对尺寸来自 pack） |
| `fade` | `"none" \| "subtle" \| "medium" \| "strong"` | `medium` | 边缘淡出；`none` = 硬边铺满 |
| `motion` | `"none" \| "drift" \| "pulse"` | `none` | 语义档位 |
| `placement` | `"absolute" \| "fixed"` | `absolute` | 容器背景 / 全屏底纹 |
| `elevation` | `-1 \| 0` | `-1` | 堆叠层级 |
| `disableMotion` | `boolean` | `false` | 仅产品级开关 |

### 明确不暴露（传入即契约违规）

`lineColor` · `lineWidth` · `cellSize` · `speed` · `duration` · `opacity` · `blurRadius` · 任何视觉字面量。

---

## 2. `motion` 是语义档位，不是速度

这是本组件最重要的一个设计决定：

```tsx
// ❌ 速度是 Style Pack 的职责，不是产品的
<AnimatedGrid speed={2} opacity={0.08} cellSize={48} />

// ✅ 产品表达意图，pack 决定实现
<AnimatedGrid motion="drift" />
```

| `motion` | 含义 | 映射到 |
|---|---|---|
| `none` | 完全静态 | 不添加任何动画类 |
| `drift` | 环境动效：网格极缓慢移动，空间在延伸 | `--kits-dur-ambient`（cinematic 9s / instrument 4s）+ `--kits-ease-linear` |
| `pulse` | 环境/数据动效：网格亮度缓慢呼吸 | `--kits-dur-ambient` + `--kits-ease-inout` |

**换 pack 时同一份 `<AnimatedGrid motion="drift" />` 会得到不同速度** ——
因为 cinematic 的空间感和 instrument 的节奏本来就不该一样。

### 自动降级：pack 说不，网格就不动

`editorial` 与 `instrument` 的 `motion.roles` 里没有 `ambient`：

| pack | `motion="drift"` 的实际结果 |
|---|---|
| cinematic | 9s 匀速漂移 |
| instrument | **静止**（roles 无 ambient） |
| editorial | **静止**，而且网格本身也不出现（`--kits-grid-line-width: 0px`） |

组件不需要知道这些规则 —— 规则住在 pack 里。

---

## 3. 实现要点

- **`mask-image` 做边缘淡出**：`radial-gradient(ellipse at center, black 0%, transparent var(--kits-grid-mask-size))`。
  `fade="none"` 时 mask 半径 0% → 网格铺满整块（编辑器式的硬边网格）。
- **drift 走 `transform: translate3d`**，不是 `background-position` ——
  后者每帧触发一次 paint，前者只走合成。位移正好一个单元格，视觉上无缝循环。
- **pulse 只动 `opacity`**，不改线色 —— 改线色会触发整层重绘。
- **`scale: 1.02` 写在 keyframes 里**（不是独立属性）：`transform` 与 `scale`
  同时存在时 `transform` 会覆盖 `scale`，这是个容易踩的坑。
- **尺寸用 `calc` 相乘**：`calc(var(--kits-grid-cell) * 0.5)` —— 组件永远不知道
  "48px" 这个数，密度只是一个乘数。

---

## 4. 无障碍（accessibility notes）

- `aria-hidden="true"` —— 纯装饰，不进入无障碍树。
- `pointer-events: none` —— 不拦截点击，不遮挡任何可交互元素。
- `z-index: -1`（默认）—— 在所有内容之下。
  **注意**：若父容器没有 `isolation` / `position`，网格可能退到更远的层叠上下文。
  推荐父容器写 `position: relative; isolation: isolate;`。
- 网格不承载任何信息 —— 屏幕阅读器用户与低视力用户都**不需要**它理解页面结构。
- 不可聚焦，不参与 Tab 顺序。
- 线色不透明度由 pack 控制（最高 0.16），远低于文本对比阈值。

---

## 5. 移动端降级

| 条件 | 行为 |
|---|---|
| `pointer: coarse` / `hover: none` | `drift` / `pulse` 动画全部关闭（省电） |
| 同一条件（由**契约层**处理） | `--kits-grid-cell-scale` 置为 **1.5** —— 有效单元格 = `--kits-grid-cell` × 1.5，避免小屏上过密的网格产生摩尔纹 |

静态网格保留：它是背景结构，不是动效。

> **契约分界**：`--kits-grid-cell` 是 pack 的**基准尺寸**，
> `--kits-grid-cell-scale` 是契约的**指针能力因子**。两者相乘得到有效值
> （在 `.kits-grid` 上算，见 `animated-grid.css` 的 `--kits-grid-cell-size`）。
>
> 分成两个变量是必需的：v0.1.0 直接把 `--kits-grid-cell` 乘 1.5，
> 与 pack 的同名声明特异性相同而后者的源顺序更晚，缩放被静默吃掉
> （实测 64px 而非 96px）。详见 CHANGELOG K-02。

---

## 6. reduced-motion 降级

双保险：JS 层把 `motion` 解析为 `none`，CSS 层另有 `@media (prefers-reduced-motion: reduce)` 兜底
（应对系统偏好在运行时变化、或 JS 未执行的情况）。静态网格保留，信息零损失。

---

## 7. SSR / Next.js 兼容性

- **服务端产物本身就是完整网格**：全部由 CSS 生成，不依赖 JS。
- 组件带 `"use client"` 只是为了调用 `useMotionAllowed`；
  即使 JS 完全失败，网格照常显示，只是不动。
- `style` 由 props 经纯函数计算 → 服务端/客户端一致，无 hydration mismatch。
- 无随机数、无时间戳。

---

## 8. 性能分级

**B**

| 项 | 值 |
|---|---|
| gzip | ≈0.7 KB |
| 静态网格 | 一次性绘制 |
| `drift` | 合成层位移，无 paint |
| `pulse` | opacity 动画，无 paint |
| 额外成本 | `mask-image` 可能禁用 GPU 快速路径 |

**约束**：
1. 同屏只放 **一个** AnimatedGrid（每层都是一次全屏绘制 + 一次 mask 合成）。
2. 不要在滚动容器里放 `placement="fixed"` 的网格（每帧重新合成全屏层）。
3. `instrument` 使用 `fade="none"` → 无 mask → 避开这条成本。

---

## 9. Changelog

| 版本 | 变更 |
|---|---|
| `1.0.0` | 首个稳定版：cell / fade / motion / placement / elevation |
