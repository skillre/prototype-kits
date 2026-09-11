# Signature Component · InteractiveHero

> 首屏「第一视觉」。只负责**结构 + 节奏 + 视差行为**，不负责任何视觉决策。

| | |
|---|---|
| **内部 API** | `1.0.0` |
| **status** | `approved` |
| **performance** | **B** · ≈1.6 KB gzip · 0 运行时依赖 |
| **SSR** | ✅ 兼容（RSC / Next.js App Router） |
| **mobile** | ✅ 内建降级 |
| **reduced-motion** | ✅ 内建降级 |

---

## 1. 契约：产品只能这样调用

```tsx
import { InteractiveHero } from "@kits/interactive-hero";

<InteractiveHero
  eyebrow="Q3 Review"
  title="把复杂还给简单。"
  lead="重新设计数据层读取路径……"
  actions={<button className="kits-control">查看报告</button>}
  media={<RevenueChart />}
  mediaPlacement="side"
  depth="subtle"
/>
```

### Props

| prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `title` | `ReactNode` | **必填** | 渲染为真实 `h1` |
| `lead` | `ReactNode` | — | 导语段 |
| `eyebrow` | `ReactNode` | — | 标题上方小标签（普通 `<p>`，不是 heading） |
| `actions` | `ReactNode` | — | 行动区 |
| `media` | `ReactNode` | — | 视觉插槽 |
| `mediaPlacement` | `"side" \| "below" \| "background"` | `side` | 插槽位置 |
| `align` | `"start" \| "center"` | `start` | 文案对齐 |
| `depth` | `"none" \| "subtle" \| "medium" \| "strong"` | `subtle` | 视差强度 |
| `as` | `"h1" \| "h2"` | `h1` | 标题语义层级 |
| `disableMotion` | `boolean` | `false` | **仅**产品级「用户主动关动画」开关 |

### 明确不暴露（传入即契约违规）

`glowColor` · `blurRadius` · `fontSize` · `padding` · `borderRadius` · `easing` · `blur` · `scale` · 任何视觉字面量。

> 需要改这些 → 改 **Style Pack**。组件不知道也不该知道"medium 是多少像素"。

---

## 2. Adapter 模式（为什么必须存在）

```
外部资产 → inspect → adapter → 内部稳定 API → Product
                                    ↑
                          产品只允许依赖这一层
```

假设将来引入一个第三方 Hero 库 `FancyHero`：

```tsx
// ❌ 产品直接依赖第三方 API —— 第三方一改 prop，全站重构
<FancyHero splitText glowColor="#4fd6ff" blurRadius={24} speed={1.4} />
```

```tsx
// ✅ 先包一层 adapter，把第三方 API 翻译成我们的产品语义
// adapters/fancy-hero.tsx
export function InteractiveHero({ title, lead, depth, ...rest }: InteractiveHeroProps) {
  return (
    <FancyHero
      splitText={false}
      glowColor={undefined}          // 视觉决策不来自第三方 props
      speed={INTENSITY_SCALE[depth]} // 强度刻度 → 第三方的数值
      headline={title}
      description={lead}
      {...rest}
    />
  );
}
```

切换实现时，**产品代码一行不改**。这就是 Adapter 存在的全部理由。

---

## 3. 实现要点

- **深度只存在于 DOM**：`data-kits-depth="0.55"` 写在标签上，
  偏移量由 `useParallaxLayers` 计算并写入 `--kits-layer-dx/dy`，
  CSS 用 `translate3d(calc(var(--kits-layer-dx, 0) * 1px * var(--kits-pointer-factor)))` 消费。
- **幅度由 pack 决定**：视差真实幅度 = 深度 × `--kits-pointer-factor`。
  editorial `0.15`（几乎看不见）/ instrument `0.4` / cinematic `1.0`（完整）。
  → **换 pack 时组件零改动，效果自动变**。
- **rAF 合并**：`pointermove` 只记录坐标，写入发生在下一帧；不会每帧多次触发样式重算。
- **合成层**：只用 `transform` + `will-change`，静态模式下移除 `will-change` 释放显存。

---

## 4. 无障碍（accessibility notes）

- `title` 渲染为真实 `h1`（`as` 可改成 `h2`）；**视觉大小不改变语义层级**。
- `eyebrow` 是 `<p>` 而不是 heading —— 避免产生多个同级标题破坏文档大纲。
- `mediaPlacement="background"` 时，背板带 `aria-hidden="true"` + `pointer-events: none`：
  既不出现在无障碍树里，也不拦截点击。
- 视差是**纯装饰增强**：没有任何信息依赖指针位置，
  `depth="none"`、触屏、reduced-motion 三种情况下信息完全一致。
- 组件自身不含可聚焦元素；键盘可达性由 `actions` 插槽传入的节点负责。
- 组件**不引入任何新颜色** —— 对比度责任在 Style Pack（见各 pack 的 a11y 段）。

---

## 5. 移动端降级（mobile fallback）

| 条件 | 行为 |
|---|---|
| `pointer: coarse` 或 `hover: none` | 指针视差不注册任何监听；所有层 `translate3d` 归零 |
| 视口 ≤ 900px | `mediaPlacement="side"` 自动堆叠为单列，**不隐藏 media** |
| 视口 ≤ 640px | 背景板不透明度降到 0.6（保证文字对比）；`actions` 占满整行（触控目标面积） |

**无内容损失**：移动端只是重新排列，不裁剪信息。

---

## 6. reduced-motion 降级

```css
@media (prefers-reduced-motion: reduce) {
  :root { --kits-pointer-factor: 0 !important; }
}
```

外加 JS 层 `useMotionAllowed()` —— 双保险：

1. CSS 层把 `--kits-pointer-factor` 强制归零；
2. JS 层直接不注册 `pointermove` 监听（省掉事件处理成本）；
3. `data-kits-depth-active="false"` → `.kits-hero--static` 移除 `will-change`。

用户改系统偏好时（运行中）组件会实时响应 —— `matchMedia` 是订阅式的，不是读一次。

---

## 7. SSR / Next.js 兼容性

- 组件带 `"use client"`，可作为客户端叶子放进 RSC 树。
- **首帧永远是静态**：`enabled` 初始为 `false`，`data-kits-depth-active="false"`。
  挂载后才可能启用视差 → 服务端 HTML 与客户端首帧完全一致，**不存在 hydration mismatch**。
- 渲染期不读 `window` / `document`；所有能力探测在 `useEffect` 内。
- 无随机数、无 `Date.now()`、无 `useId` → 输出确定性。
- **Next.js 使用提示**：不要用 `dynamic(..., { ssr: false })` —— 会白白丢掉首屏 HTML
  和 SEO。直接放进 JSX 即可。

---

## 8. 性能分级

**B** —— 合成友好，但有真实的合成层开销。

| 项 | 值 |
|---|---|
| gzip | ≈1.6 KB（React 外置） |
| 布局抖动 | 无（只写 `--kits-layer-dx/dy` + `transform`） |
| 重排 | 无 |
| 合成层 | 每个视差层 1 个（提示：`depth="strong"` + 5 层 = 5 个层，不要嵌套使用） |

**约束**：一屏只放一个 hero。视差层数量由组件的 `LAYER_DEPTH` 固定为最多 5 个，
不要通过 `media` 插槽再塞入会自己位移的节点。

---

## 9. Changelog

| 版本 | 变更 |
|---|---|
| `1.0.0` | 首个稳定版：title / lead / eyebrow / actions / media / depth / align / mediaPlacement |
