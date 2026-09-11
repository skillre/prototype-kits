---
name: visual-direction
description: 在写任何 UI 之前必须先做视觉方向决策。产出 Visual Manifest（stylePack / signatureComponents / effects / firstVisual / motionDirection / density / avoid），再动 JSX。适用于新建页面、新 Prototype、视觉重构、以及从外部引入设计参考之后。
---

# SKILL · Visual Direction

> **写 UI 之前，先写 Manifest。**
> 没有 Visual Manifest 就开始写 JSX = 违规。

这个技能解决的问题：Agent 一上来就写组件、加圆角、加渐变，最后得到的是一个
"哪都还行、哪都不成立"的页面。视觉方向必须先被**声明**，然后才被**实现**。

---

## 0. 顺序（不可交换）

```
1. 读 Reference Board        → 提取设计语言，不复制布局
2. 写 Visual Manifest        → 做出决策并写下来
3. 读对应 Style Pack 的 SKILL → 知道这套风格的硬约束
4. 选 Signature Components   → 只从 registry 里 status=approved 的选
5. 应用 Motion Direction     → 动效只服务四类角色
6. 写 JSX                    → 此时才允许动代码
```

**跳过任何一步都会在后面付出十倍代价。** 尤其是第 1 步：不读参考就写，
产出的东西会回到默认审美（卡片 + 阴影 + 渐变 + 紫色）。

---

## 1. Reference Board：先读，再提取，不复制

在写 Manifest 之前，先读对应 pack 的参考板：

```
references/editorial/    references/cinematic/    references/instrument/
```

参考板里存的是**设计语言分析**（为什么这样排、为什么用这条线），
不是可复制的源码。

### 提取什么

| 提取 | 不提取 |
|---|---|
| 这套设计的**层级建立方式** | 具体的页面布局 |
| 它的**间距节奏**（脉搏多大） | 具体的像素值 |
| 它的**排版性格**（衬线/等宽/字距） | 具体字体文件 |
| 它的**边界与表面哲学** | 具体的颜色 hex |
| 它的**动效语言** | 具体的动画实现 |

### 铁律

> **禁止复制别人的页面布局。**
> 你提取的是**语言**（语法与词汇），不是**句子**。
> 看到一个漂亮的 hero 区，你要回答的是"它为什么这样排"，
> 而不是"把它的栅格抄过来"。

---

## 2. Visual Manifest（必须产出）

在写任何 JSX 之前，先输出这段 JSON，并解释每个决策：

```json
{
  "productType": "ai-finance-console",
  "firstVisual": "深色空间里从左上打下来的环境光，标题浮在光里，下方一条发光曲线",
  "stylePack": "cinematic",
  "signatureComponents": ["interactive-hero", "data-cursor"],
  "effects": ["ambient-glow"],
  "motionDirection": "atmospheric",
  "density": "medium",
  "avoid": ["glassmorphism", "purple-gradient", "card-everywhere"]
}
```

### 字段说明

| 字段 | 必填 | 说明 |
|---|---|---|
| `productType` | ✅ | 产品类型（决定推荐 pack）。用 kebab-case：`research-report` / `ai-analytics` / `observability-console` |
| `firstVisual` | ✅ | **一句话描述首屏第一眼看到什么**。写不出这一句 = 还没想清楚 |
| `stylePack` | ✅ | `editorial` / `cinematic` / `instrument`（必须是 registry 里 `approved` 的） |
| `signatureComponents` | ✅ | 从五个组件里选，通常 2–3 个（**不是越多越好**） |
| `effects` | ✅ | 从 `effects/manifest.json` 里选（可为空数组） |
| `motionDirection` | ✅ | 与 pack 的 `motionLanguage` 一致：`restrained` / `atmospheric` / `precise` |
| `density` | ✅ | 与 pack 的 `density` 一致，或说明为何偏离 |
| `avoid` | ✅ | **明确列出这次不要出现的东西**（这是最有价值的一栏） |

### `avoid` 为什么最重要

因为 Agent 的默认审美会强烈回拉：紫色渐变、卡片阴影、圆角 16px、
到处 glow。写下 `avoid` 就是在动手前先把这些门关掉。

常用 `avoid` 词表：

```
glassmorphism          紫色渐变（purple-gradient）
card-everywhere        到处投影（drop-shadow-elevation）
neon-glow              粗描边（heavy-border）
animation-everywhere   回弹缓动（bouncy-easing）
generous-whitespace    多色图表（multi-hue-charts）
```

---

## 3. 怎么选 Style Pack

| 产品特征 | 推荐 pack |
|---|---|
| 内容要被**读完**（报告、分析、叙事、品牌页） | **editorial** |
| 用户要**沉浸**（AI 界面、Demo、发布会、增长看板） | **cinematic** |
| 一屏要放**很多必须读准的数字**（监控、交易、运维、工程工具） | **instrument** |

### 判定话术

问三个问题：

1. **用户是来读的还是来扫的？** 读 → editorial；扫 → instrument。
2. **这一屏要讲一个故事，还是要展示 40 个指标？** 故事 → cinematic；指标 → instrument。
3. **如果页面上有 40 个字段，会发生什么？** editorial 会崩（留白不够）；
   cinematic 会糊（光把注意力分散）；instrument 刚好。

### 不要做的事

- **不要混搭两个 pack 的变量体系。** 一个 `data-kits-pack` 容器只对应一套风格。
  需要两种性格 → 用两个容器分区。
- **不要因为"好看"选 pack。** pack 是产品语义的一部分：
  一个财务合规界面用 cinematic 会显得不可信。

---

## 4. 选 Signature Components

只能从 `registry/assets.json` 中 `status: "approved"` 的组件里选：

| 组件 | 一句话 | 什么时候用 | 什么时候不用 |
|---|---|---|---|
| `interactive-hero` | 首屏第一视觉（结构 + 视差） | 需要一个"开场"的页面 | instrument 页面（首屏英雄区是浪费） |
| `spotlight-surface` | 指针响应的表面 | cinematic 的卡片/面板 | instrument 的密集读数区（干扰） |
| `animated-grid` | 结构性背景网格 | 需要空间感（cinematic / instrument） | editorial（pack 已自动禁用） |
| `data-cursor` | 指针即探针，悬停读数值 | 数据密集、需要"不点开就能读" | 有输入框/需要文本选择的页面 |
| `insight-reveal` | 按阅读顺序逐段揭示 | 长内容、需要引导阅读顺序 | 首屏以上内容、密集表格行 |

### 数量约束

- 首屏最多 **2 个** 签名组件（一个 hero + 一个效果层）。
- 一页最多 **3 个**。
- 用了 ≥ 4 个 → 说明你在堆效果，而不是在做设计。**删掉多余的。**

---

## 5. 然后才是 JSX

```tsx
// 1. 引入 pack（契约在前，pack 在后）
import "@kits/style-cinematic/tokens.css";

// 2. 声明作用域
<section data-kits-pack="cinematic" className="kits-surface">
  {/* 3. 用 pack 的工具类表达层级 */}
  <div className="kits-ambient" aria-hidden="true" />
  <p className="kits-label">Signal</p>
  <h1 className="kits-display">让每一个数字都有光。</h1>

  {/* 4. 用组件表达行为 */}
  <SpotlightSurface tone="brand" intensity="medium">…</SpotlightSurface>
</section>
```

**禁止**在这一步出现任何视觉字面量：

```
❌ #4fd6ff   ❌ padding: 24px   ❌ border-radius: 14px   ❌ ease-out 300ms
✅ var(--kits-*)    ✅ data-kits-pack="…"    ✅ <SpotlightSurface tone="brand" />
```

---

## 6. 交付前的自检清单

- [ ] 写出了 Visual Manifest，且 `firstVisual` 是一句具体的话（不是"现代简洁"）
- [ ] 读过了该 pack 的 Reference Board，并能说出提取到的三条设计语言
- [ ] 没有复制任何外部页面布局
- [ ] `stylePack` 来自 registry 且 status=approved
- [ ] `signatureComponents` ≤ 3，且每一个都有"为什么是它"的理由
- [ ] `avoid` 里的每一条在产物里都确实没有出现
- [ ] 代码里没有任何视觉字面量（颜色/尺寸/缓动）
- [ ] 灰度化之后层级依然清楚（不依赖颜色）
- [ ] 移动端 390px 无横向溢出、无不可读降级
- [ ] `prefers-reduced-motion: reduce` 下信息完整
- [ ] 已按 `skills/motion-direction/SKILL.md` 复核过动效

---

## 7. 常见失败模式

| 失败 | 表现 | 修正 |
|---|---|---|
| **跳过 Manifest** | 页面"哪都还行、哪都不成立" | 回到第 2 步 |
| **Manifest 写了但不执行** | Manifest 说 cinematic，产物里全是卡片阴影 | Manifest 是约束，不是文档 |
| **`firstVisual` 写空话** | "现代化、简洁、高级感" | 改写成"第一眼看到什么" |
| **堆组件** | 一页 5 个签名组件 | 删到 ≤ 3 |
| **混搭 pack** | 一个页面同时出现纸纹与霓虹光 | 拆成两个容器分区 |
| **抄参考布局** | 产物与参考板截图高度相似 | 只提取语言，重做布局 |
| **无视口降级** | 390px 下横向溢出 | 按 pack 的 mobile 段处理 |
