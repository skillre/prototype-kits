# Style Pack · editorial

> 编辑式 · 纸与字 —— 把界面当印刷品，而不是当仪表盘。

| | |
|---|---|
| **id** | `editorial` |
| **status** | `approved` |
| **version** | `0.1.0` |
| **contract** | `1.0.0`（见 [`../_contract/tokens.css`](../_contract/tokens.css)） |
| **selector** | `[data-kits-pack="editorial"]` |
| **performance** | A · 0 KB JS · ~4 KB CSS |

---

## 1. 这套风格在解决什么问题

大多数后台界面默认「一个字段一个卡片」。当信息本身是**需要被读完的**——
一份季报、一段分析、一组结论——卡片会把阅读切成碎片，读者永远在排版里找内容。

editorial 的做法是把这些还回去：**大留白 + 强排版 + 细分隔线**。
它假设用户在阅读，而不是在巡检。

**第一视觉**：一个巨大的衬线标题，下面一条 1px 横线，然后是正文。

---

## 2. 十个维度上的立场

| 维度 | 立场 | 落地方式 |
|---|---|---|
| typography | `editorial` | 衬线标题 4.5rem / line-height **1.02** / tracking −0.022em；正文衬线 1.0625rem / 1.7 / 58ch；标签等宽 uppercase +0.16em |
| spacing rhythm | `generous` | 脉搏 **4px**，段落间距 **96px**，gutter 32px —— 间距是主要设计手段 |
| density | `low` | 控件 40px 高、行高 52px、卡片内边距 24px；一屏少放，但每条读得清 |
| radius philosophy | `flush` | 全部 **0**。纸是方的，印刷不切圆角 |
| border treatment | `hairline-rule` | 默认 `border-width: 0`，只用 1px 横线（opacity 0.14）分区；强线 0.4 |
| surface treatment | `paper` | 暖纸底色 + 内联 SVG 纸纹（opacity **0.035**，multiply）；**零投影** |
| navigation feel | `running-head` | 导航 = 书眉行：一条线 + 一行小标签，不吸附、不背景、不占空间 |
| data visualization | `ink-rules` | 只用墨色 + 一个暖强调色；细线网格；数字用衬线 tabular-nums，无发光无填充块 |
| motion language | `restrained` | 唯一角色是 enter + 极轻 interact；80–480ms；位移仅 **10px**；无回弹 |
| visual hierarchy | `scale-and-space` | 只有两个工具：字号与留白。不靠颜色、不靠投影、不靠边框 |

> **判据**：把三套 pack 都转成灰度，editorial 仍然可辨——因为差异在排版与
> 空间节奏，不在颜色。

---

## 3. 使用方式

```tsx
// 1. 引入契约 + pack（顺序固定：契约在前）
import "@kits/style-editorial/tokens.css";

// 2. 在任意容器上声明 pack —— 产品代码从此不再出现任何视觉字面量
<section data-kits-pack="editorial">
  <p className="kits-label">Annual review</p>
  <h1 className="kits-display">把复杂还给简单。</h1>
  <p className="kits-lead">
    我们重新设计了数据层的读取路径，把原本需要 4 步的操作压缩成 1 步。
  </p>
  <hr className="kits-rule" />
  <p className="kits-body">详细分析见下。</p>
</section>
```

```ts
// 3. 需要把 motion 编译成 CSS 变量（Playground / 自定义渲染器）
import { motionToCssVars } from "../_contract/contract.ts";
import editorialMotion from "./motion.ts";

const style = motionToCssVars(editorialMotion); // { "--kits-dur-quick": "140ms", ... }
```

### 可用的工具类（由 pack 提供，不是全局样式）

| class | 作用 |
|---|---|
| `.kits-display` | 大标题（衬线 / 1.02 行高 / 收紧字距 / 22ch 上限） |
| `.kits-lead` | 导语段（正文 ×1.2，46ch） |
| `.kits-body` | 正文（58ch，1.7 行高） |
| `.kits-label` | 等宽 uppercase 小标签 |
| `.kits-data` | 数据读数（衬线大字号 + tabular-nums） |
| `.kits-mark` | 强调（暖色文字，不是色块） |
| `.kits-rule` / `.kits-rule--short` | 分隔线 / 短强调线 |
| `.kits-surface` | 纸面（含纸纹伪元素） |
| `.kits-control` / `.kits-control--primary` | 下划线式控件（不是描边按钮） |

---

## 4. 什么时候**不要**用

- 实时监控大屏：editorial 的信息吞吐量不够。
- 每屏 30+ 字段的密集工作台：留白会变成浪费。
- 强实时反馈工具：140ms 起步的动效在这里显得迟钝。
- 需要并列对比大量卡片的目录页。

更多用例见 `manifest.json` 的 `recommendedFor` / `avoidFor`。

---

## 5. 无障碍

- **对比度**：ink `#1a1614` on paper `#fdfbf7` ≈ **15.9:1**；muted `#6f665c` ≈ **5.4:1**（均达标）。
- **uppercase 标签**：必须保留 `letter-spacing ≥ 0.1em`，否则全大写小字号的可读性会掉。
- **分隔线**：`opacity 0.14` 的线只是装饰，**不得**作为唯一的分组语义；分组必须同时由标题或留白表达。
- **纸纹**：`pointer-events: none`，不拦截点击；`opacity 0.035` 低于 WCAG 的感知阈值，不影响文本对比。
- **reduced-motion**：`collapseTo 0ms`，完全静态；信息全部在文字里，不依赖动画。

---

## 6. 性能

| 项 | 值 |
|---|---|
| 分类 | **A**（纯 CSS，零运行时） |
| JS | 0 KB |
| CSS | ~4 KB（未压缩） |
| 合成开销 | 唯一非静态属性是 `.kits-surface::before` 的 `opacity` + `mix-blend-mode`，封闭在单个伪元素内，不触发重排 |

约束：纸纹必须保持为**一个**伪元素。不要在滚动容器里给每个子元素加纹理——那样会把一次合成变成 N 次。

---

## 7. 相关资产

- 组件：`insight-reveal`（必配）、`interactive-hero`（必配）、`spotlight-surface`（可选）
- 效果：`paper-grain`
- 参考板：[`references/editorial/`](../../references/editorial/)
- 技能：[`skills/visual-direction/SKILL.md`](../../skills/visual-direction/SKILL.md)
