# FAQ · 设计决策与常见质疑

> 这里回答的是**"为什么这样做"**，不是"怎么做"。
> 怎么做见 [`integration.md`](integration.md)；边界见 [`architecture.md`](architecture.md)。

---

## 契约与抽象

### 为什么要求产品不能直接依赖第三方组件 API？

因为第三方组件的 API 是**它的**抽象，不是我们的产品语义。

```tsx
<FancyGlowCard glowColor="#4fd6ff" blurRadius={24} opacity={0.6} followSpeed={0.15} />
```

这一行里有三个问题：

1. `#4fd6ff` 是**视觉决策**，写进产品后换风格它不会跟着变；
2. `blurRadius` / `followSpeed` 是**实现细节**，第三方改默认值产品就变样；
3. 换库 = 全站重构。

```tsx
<SpotlightSurface tone="brand" intensity="medium" />
```

`tone` 是产品意图（这块表面是品牌重点），`intensity` 是强度刻度。
颜色与跟随幅度由 Style Pack 决定 —— 换 pack 时这一行**不用改**。

### 为什么"强度"是 4 档而不是 0–100 的数字？

因为 `intensity={73}` 意味着产品知道"73 是多少像素"。
四档（none / subtle / medium / strong）映射到乘数，绝对数值在 pack 里 ——
同一份调用在 cinematic 下是大光斑，在 instrument 下是小高光。

**任何需要精确数值的场景，说明这个决策属于 pack，不属于产品。**

### 为什么 `tone` 用 brand / signal / critical，而不是 primary / danger？

`primary` / `danger` 是**组件库的命名习惯**（它描述色相位置）；
`brand` / `signal` / `critical` 描述**产品意图**。

- `tone="critical"` 表示"这是需要立即注意的" —— 具体是红还是橙，由 pack 决定；
- 一个 pack 完全可以让 `critical` 呈现为"高对比的方形边框 + 琥珀"，而不是红色。

---

## 技术选型

### 为什么 Style Pack 不用 Tailwind 类，而是 CSS 变量？

因为 **pack 必须能被任意项目消费**，而 Tailwind 只是其中一种技术栈。

- 用 Tailwind：pack 把消费方锁死在 Tailwind v4 + 它的配置系统上；
- 用 CSS 变量：pack 是纯 CSS，Next.js / Vite / Remix / 静态 HTML 都能用。

Kits 的 Playground 用 Tailwind 来写**外壳**（它自己是个应用），
但 pack 与组件只输出 CSS + CSS 变量 —— 两者边界清晰。

**"换一个消费方不用重写 pack"** 是这条选择的全部理由。

### 为什么 Kits 是源码分发，不做构建产物？

因为**可审计**是 Kits 的第一价值，而构建产物是不可审计的。

- 你在评审时看到的 `tokens.css` / `motion.ts`，就是产品实际装上跑的东西；
- 没有"d.ts 与实现不一致""改了源但没重新构建"这类问题；
- 使用者可以逐行读完一套 pack（三套加起来不到 800 行）。

代价：消费方需要 `transpilePackages`。这个代价是明确且一次性的。

### 为什么不做 Storybook？

Storybook 解决的是"组件很多、需要逐个浏览与交互测试"的规模问题。

Kits v0.1 只有 5 个组件与 3 套 pack，真正需要回答的问题是：
**同一份组件调用在三套风格下分别长什么样**（并排对比）、
**契约是否真的不同**（十维对照）、**登记表是否诚实**（registry 审计）。

这三件事 Storybook 都不做。一个 3 页的 Next.js app 更合适，而且
它本身就是"Kits 可以被一个真实 Next.js 项目消费"的证明。

> 如果未来组件数量超过 20，会重新评估。当前不引入。

### 为什么组件用 `"use client"` 而不是做双版本（server + client）？

因为这些组件**都需要浏览器能力**（指针、观察器），做 server 版本没有意义。

真正需要保证的是 SSR 安全，而这通过三条实现：

1. 首帧一律渲染"静态/保守"状态（`data-kits-depth-active="false"` 等）；
2. 所有能力探测在 `useEffect` 内，且以 `mounted` 为门；
3. 服务端产物本身是完整可用的（例如 `InsightReveal` 的内容默认可见）。

→ 可放进 RSC 树作为客户端叶子，**不需要** `dynamic(..., { ssr: false })`。

### 为什么用 IntersectionObserver 单例，而不是每个组件一个？

一个 20 段落的报告页，如果每个 `InsightReveal` 自己 `new` 一个 observer，
就有 20 个 observer。移动端上这是真实的内存与回调开销。

模块级单例让整页只有 1 个 observer，代价是一点模块状态 ——
换来的确定收益。

---

## 视觉设计

### 三套 pack 会不会其实只是"三套配色"？

不会，而且这一条被**测试强制**。

`tests/contracts.spec.ts` 断言十个维度在三套 pack 中**取值三值互不相同**：

```
typeVoice        editorial / spatial / instrumental
spacingRhythm    generous  / layered / compact
density          low       / medium  / high
radiusPhilosophy flush     / continuous / square
borderTreatment  hairline-rule / none-with-depth / hard-technical
surfaceTreatment paper     / ambient-glow / panel
navigationFeel   running-head / overlay-space / rail-console
dataLanguage     ink-rules / glow-series / instrument-grid
motionLanguage   restrained / atmospheric / precise
hierarchyMethod  scale-and-space / light-and-depth / rule-and-label
```

再加上间距节奏、圆角半径、行高、控件高度也各有三值。
灰度化之后三套仍然一眼可分 —— 差异在结构与节奏，不在调色板。

### 为什么颜色也放在 `[data-kits-pack]` 作用域，而不是 `:root`？

因为**多 pack 同页共存**是硬需求（Playground 并排对比就是靠它）。

如果颜色写在 `:root`：同页导入三套 pack 时，**最后导入的那个会赢得所有子树**
（同特异度、后者胜出），三列会全都变成 instrument 的配色。

放进作用域后每个子树拿到自己完整的一套。（这个缺陷是 Browser QA 真实抓到的 ——
见 `.qa/kits-shots.mjs` 里对"三套画布色必须全部不同"的断言。）

### 产品可以改 pack 的颜色吗？

可以，而且这是**唯一**鼓励覆盖的部分：

```css
[data-kits-brand="acme"][data-kits-pack="cinematic"] {
  --kits-color-accent: #6d28d9;
  --kits-color-glow: rgb(109 40 217 / 0.5);
}
```

但**不建议**覆盖排版/间距/密度/圆角/动效 —— 那是 pack 的身份。
需要不同性格，请换 pack，而不是把 pack 改成另一个样子。

### 为什么 instrument 的 reduced-motion 不保留淡入？

因为监控面板上的状态切换**必须瞬时可见**。

保留淡入看起来更"体贴"，但在这个语义下是错的：告警晚 200ms 被看到，
是错误而不是关怀。所以 instrument 的 `reducedMotion.keepOpacity = false`。

> 这条差异是刻意保留的：降级策略不是全局统一值，由 pack 的语义决定。

---

## 降级与无障碍

### 为什么"默认可见、JS 隐藏"这么重要？

因为反过来写（默认隐藏、JS 显示）的情况下：

- 一次脚本错误 → **整页内容空白**；
- 关闭 JS 的用户 → 什么都读不到；
- 爬虫 / read-it-later → 读到空页面；
- SSR 产物 → 首屏没有内容。

`InsightReveal` 的隐藏规则**必须带 `.kits-reveal--animated` 前缀**，
所以只要 JS 没跑起来，内容就是可见的。这条由测试强制。

**验收方式**：浏览器关掉 JS，页面内容必须完整可读。

### 为什么组件都要内建降级，而不是让产品自己处理？

因为产品处理降级时会犯错，而且会**不一致**：

- 有的产品用 `window.matchMedia` 判断，忘了监听变化（用户改系统偏好后不生效）；
- 有的只在 CSS 里写 `@media`，忘了 JS 层仍然在跑 rAF 循环（白耗电）；
- 有的移动端直接关掉整个组件（信息丢失）。

组件内建之后，产品只需要说 `<AnimatedGrid motion="drift" />`，
"在触屏上不动 / 在 reduced-motion 下不动"是自动的。

### 触屏上关掉指针效果，会丢信息吗？

不会，而且这一条被写成契约：`mobileFallback.noContentLoss = true`（测试校验）。

`DataCursor` 是唯一有风险的组件 —— 它的标签只在对指针悬停时出现。
因此有强制要求：**`data-cursor-label` 的信息必须同时存在于可见文本中**。
光标标签是增强，不是唯一信息载体。

---

## 流程与治理

### 为什么要有 Incoming Workflow？直接复制一个组件不是更快吗？

更快，但会付出三种代价：

1. **许可证风险**：不知道来源与许可就进入产品；
2. **依赖风险**：一个组件带进来 40 个传递依赖；
3. **不可替换**：产品直接依赖它的 API，将来换掉要全站重构。

Incoming 的 12 步里，真正花时间的是第 2–5 步（审计）。
剩下的 6–11 步（adapter / fallback / demo / test / 登记）是**一次性的**，
以后所有产品都受益。

### 为什么 registry 里连效果和 skill 都要登记？

因为"没有登记就不能引用"必须是一条**无例外**的规则，否则它就不成立。

如果效果可以不登记，下一个人就会问"那组件是不是也可以不登记"。
规则的价值来自它没有例外。

### `experimental` 和 `approved` 的区别是什么？

- `experimental`：审计已通过，但还没有在真实 Prototype 里验证过。
  只能用于明确标注为实验的项目。
- `approved`：已在真实项目里用过，且满足全部准入条件（含降级、demo、
  性能说明、来源可追溯）。

**approved 不是"我觉得它可以"，而是"它在真实条件下成立"。**

---

## 反模式清单

以下行为在 Kits 里都是**违规**（部分由测试强制）：

| 反模式 | 为什么 |
|---|---|
| 组件里出现 hex 颜色 | 组件不该做视觉决策（测试强制） |
| 组件里出现 pack 的名字 | 组件不该知道有几套风格（测试强制） |
| 从组件暴露 `size` / `color` / `duration` | 视觉字面量泄漏到产品 |
| 未登记就引用资产 | 登记表失去权威性 |
| 复制外部源码进业务项目 | 绕过全部审计 |
| 在 starter 或产品里复制一个 Pack | 产生第二份"事实"，从此两处不同步 |
| 一个页面嵌套两个 `data-kits-pack` | 内层会继承并覆盖外层变量，行为难预测 |
| 产品里写 `if (pack === "cinematic")` | 分支应该由 pack 的变量表达（测试会发现组件里的 pack 名） |
| 无信息量的持续动画 | Motion 必须归入四类角色之一 |
| 把 Kits 的组件当"组件库"来收 | Kits 只收**可审计、要复用、会变化**的资产 |
