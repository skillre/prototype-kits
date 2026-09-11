# Visual Inventory · prototype-starter 视觉资产盘点

> 回答题面 C 问题：**当前 prototype-starter 里哪些视觉内容未来应该逐步剥离到 Kits？**
>
> 本文是**盘点与计划**，不是执行记录。v0.1 **没有修改 starter 的任何文件**。
> 所有提议都需要在 starter 与 Kits 都有稳定依赖路径之后，单独开分支执行。

---

## 0. 盘点结论（先说结果）

starter 目前的视觉资产分四类：

| 类别 | 处置 | 优先级 |
|---|---|---|
| **A. 视觉语言（配色 / 排版 / 间距 / 材质）** | 提炼为第 4 套 Style Pack（`command-center`） | 高 |
| **B. 可复用的签名组件** | 包装成 Signature Component 迁入 Kits | 中 |
| **C. 业务组件（CRUD / 表单 / 数据表）** | **留在 starter** | — |
| **D. 应用外壳（导航 / 布局 / i18n / 主题切换）** | **留在 starter** | — |

一句话：**把"风格"和"签名组件"搬走；把"业务"和"外壳"留下。**

---

## 1. 现状：starter 里有什么视觉资产

### 1.1 `app/globals.css`（643 行）—— 这是最大的一块

| 区块 | 内容 | 归属判断 |
|---|---|---|
| Design System V2 theme bridge | `@theme inline` 把 CSS 变量映射成 Tailwind 工具类（约 124 行） | **外壳机制，留 starter** |
| Design tokens —— "single source of truth" | 颜色、间距、圆角、阴影、动效时长/曲线（约 360 行） | **风格内容 → 提炼为 pack** |
| Utilities | `.eyebrow`、`.section-marker`、`.ambient-wash`、hero 光源、`live-halo` | **风格内容 + 效果 → 提炼** |
| `@keyframes` | `skeleton-sheen`、`ambient-drift`、`live-halo` | **效果 → 提炼** |
| `@layer base` | 全局 reset 与基础排版 | **外壳机制，留 starter** |

### 1.2 `lib/motion-presets.ts`（170 行）—— 动效契约的雏形

`durations` / `easings` / `cssEasings` / `softSpring` / `snappySpring` /
`hoverLift` / `pressScale` / `staggerContainer` / `staggerItem` / `swapVariants` / `enter()`

**归属判断**：这就是 Kits 的 `motion.ts` 合同在 starter 里的**前身**。
它应该被拆成两半：

- **形状**（有哪些字段、什么层级）→ 已是 Kits 的 `StylePackMotion`，建议反向对齐；
- **取值**（具体多少 ms、哪条曲线）→ 属于第 4 套 pack 的 `motion.ts`。

### 1.3 `components/prototype/`（19 个组件，2206 行）

| 组件 | 性质 | 归属判断 |
|---|---|---|
| `ambient-backdrop.tsx` | 环境光 + 网格层 | **→ Kits**（已在 Kits 有对应：`animated-grid` / `ambient-glow`） |
| `stats-card.tsx`（253 行） | 指标卡（含趋势、迷你图、语义色） | **→ Kits**（作为 `metric-card` 签名组件） |
| `metric-strip.tsx` | 一排读数的横条 | **→ Kits**（可并入 `metric-card` 家族） |
| `chart-card.tsx` | 图表容器 + 图例 | **→ Kits**（作为 `chart-frame`，但图表库本身留在 starter） |
| `section-heading.tsx` | 区块标题（eyebrow + title + 描述） | **→ Kits**（排版件，已有 `kits-label` 等工具类可覆盖） |
| `command-palette.tsx` | ⌘K 命令面板 | 边界：**外壳能力，留 starter**；但其"浮层视觉"由 pack 决定 |
| `data-table.tsx` / `filter-bar.tsx` / `pagination.tsx` | 数据表格族 | **留 starter**（业务逻辑重） |
| `detail-drawer.tsx` / `profile-dialog.tsx` / `sign-out-dialog.tsx` | 抽屉/弹窗 | **留 starter** |
| `empty-state.tsx` / `error-state.tsx` / `loading-state.tsx` / `not-found-state.tsx` | 状态族 | 边界：**结构留 starter，视觉表达走 pack 的状态语言** |
| `onboarding-wizard.tsx` | 向导 | **留 starter** |
| `ai-summary-panel.tsx` | AI 摘要面板 | **留 starter**（业务语义重，但可受益于 pack 的排版规则） |

### 1.4 `components/motion/`（6 个）

`fade-in` / `slide-in` / `scale-in` / `stagger-container` / `animated-number` / `page-transition`

**归属判断**：这是**动效原语**。两个去处：

- `stagger-container` / `fade-in` 的语义与 Kits 的 `insight-reveal` 重叠 → **收敛到 Kits**；
- `page-transition` 属于应用外壳 → **留 starter**；
- `animated-number` → **→ Kits**（作为 `readout` 签名候选，与 instrument 的读数语言天然契合）。

### 1.5 其他

| 位置 | 内容 | 判断 |
|---|---|---|
| `components/layout/` | sidebar / top-nav / mobile-nav / page-container | **留 starter**（外壳） |
| `components/ui/` | shadcn 基础件 | **留 starter**（原语，不是风格） |
| `components/i18n/`、`theme-provider` | 语言与主题 | **留 starter** |

---

## 2. 剥离计划（建议顺序）

不要一次性搬迁 —— starter 是所有 Prototype 的起点，动它风险最高。

### 阶段 0（已完成，v0.1）

- ✅ 建立 Kits，交付 3 套 pack + 5 个组件 + 契约 + registry + QA。
- ✅ **未触碰 starter**。

### 阶段 1：提炼第 4 套 pack（`command-center`）

目标：把 starter 现有的视觉语言变成"可以被选择的一种"，而不是"唯一的一种"。

| 动作 | 产物 | 验收 |
|---|---|---|
| 把 `globals.css` 的 tokens 段按契约变量重写 | `styles/command-center/tokens.css` | 十个维度填满；与现有三套互不相同 |
| 把 `motion-presets.ts` 的取值搬进 `motion.ts` | `styles/command-center/motion.ts` | 通过 `assertStylePackMotion` |
| 写 manifest / README / SKILL | 三件 | 通过 contracts.spec |
| 登记 registry | `assets.json` 增一条 | 通过 registry.spec |

> 这一步**不动 starter**，只是让第 4 套风格在 Kits 里先成立。

### 阶段 2：starter 改为"消费 pack"

| 动作 | 风险 | 回退方式 |
|---|---|---|
| starter 加 `@kits/style-command-center` 依赖 | 低 | 移除依赖即回退 |
| `globals.css` 保留 `@theme` bridge 与 `@layer base`，tokens 段改为导入 pack | 中 | 保留原 tokens 段于注释/分支 |
| 页面根节点加 `data-kits-pack="command-center"` | 低 | 删一行 |
| 逐页替换 `.eyebrow` / `ambient-wash` 等工具类为 `kits-*` 等价物 | 中 | 分页 PR |

**验收**：视觉**逐像素**不接受变化（这一步的目标是"零视觉变化地改变实现"）。
用 Browser QA 截图做前后对比。

### 阶段 3：签名组件迁出

按"变化速度 × 复用度"排序，一次搬一个组件：

1. `ambient-backdrop` → 用 `animated-grid` + `ambient-glow` 替代（收益最大，重复度最高）
2. `stats-card` + `metric-strip` → 合成一个 `metric-card` 签名组件
3. `section-heading` → 用 pack 工具类替代（可能不需要组件）
4. `animated-number` → 作为 readout 组件迁入
5. `chart-card` → 作为 `chart-frame`（图表库仍留 starter）

每搬一个都要走完整 incoming 流程的等价步骤（demo 三种 pack + 降级 + 契约测试），
因为"从 starter 搬"与"从外部搬"在审计要求上没有区别。

### 阶段 4：收尾

- starter 的 `globals.css` 只剩：`@theme` bridge、`@layer base`、pack 导入；
- starter 不再包含任何"风格取值"；
- `docs/` 里记录一次迁移报告。

---

## 3. 明确**不**剥离的（并说明原因）

| 内容 | 为什么留下 |
|---|---|
| `@theme inline` bridge | 它是"Kits 变量 ↔ Tailwind 工具类"的桥。桥属于应用，因为只有应用知道自己在用 Tailwind 还是别的 |
| `@layer base` reset | 全局基础样式，每个应用都需要自己拥有 |
| 导航与布局 | 应用外壳；不同 Prototype 的导航结构本来就该不同 |
| shadcn 的 `components/ui/` | 无风格倾向的原语，不是视觉资产 |
| 数据表格 / 表单 / 抽屉 / 向导 | 业务行为重，进 Kits 会让 Kits 变成"第二个 starter" |
| i18n / theme-provider | 应用能力，不是视觉 |

---

## 4. 风险与对策

| 风险 | 对策 |
|---|---|
| starter 是所有 Prototype 的起点，动它影响面大 | 分阶段、每阶段单独分支、每阶段可回退 |
| "零视觉变化"迁移容易漏掉深色模式 | 迁移前后都跑 Browser QA 双视口截图对比（含 dark） |
| 两套 token 系统短期并存（starter 的 + Kits 的） | 阶段 2 的目标就是消灭并存；并存期用 `data-kits-pack` 隔离 |
| 组件搬迁引入回归 | 一次一个组件，先加新、后删旧，中间允许短暂重复 |
| 有人直接复制 Kits 源码进 starter | 在 starter 的 AGENTS/README 里写明禁止（与 Kits README 的禁止条款对齐） |

---

## 5. 判定速查（给未来的自己）

看到 starter 里的一段视觉代码，用这三个问题判断：

1. **换一套风格时，它需要变吗？** 需要 → Kits。
2. **它承载业务语义吗？**（例如"客户流失风险"）承载 → starter。
3. **它是"怎么做"还是"做成什么样"？** 怎么做 → starter；做成什么样 → Kits。
