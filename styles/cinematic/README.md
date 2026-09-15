# Style Pack · cinematic

> 电影感 · 光与深度 —— 层级不是画出来的，是**打光**打出来的。

| | |
|---|---|
| **id** | `cinematic` |
| **status** | `approved` |
| **version** | `0.1.0` |
| **contract** | `1.0.0`（见 [`../_contract/tokens.css`](../_contract/tokens.css)） |
| **selector** | `[data-kits-pack="cinematic"]` |
| **performance** | B · 0 KB JS · ~6 KB CSS（含 backdrop-filter） |

---

## 1. 这套风格在解决什么问题

浅色界面里，让一个区块「更重要」的默认手段是加边框、加阴影、加背景色。
但在深色空间里这些都会变成噪音：边框像调试框，阴影看不见，背景色一加深就
和画布糊在一起。

cinematic 的答案是**用光分层**：越靠前的元素越亮、越大、越有光晕，
区块之间靠亮度差而不是边框分开。它假设用户是来**沉浸**的，不是来巡检的。

**第一视觉**：深色空间里一片从左上打下来的光，标题浮在光里。

---

## 2. 十个维度上的立场

| 维度 | 立场 | 落地方式 |
|---|---|---|
| typography | `spatial` | 无衬线 **500 字重**，clamp 到 4rem，line-height 1.08，**正字距 +0.005em**（与 editorial 的负字距相反）；正文用 ink-muted 而非 ink |
| spacing rhythm | `layered` | 脉搏 8px，但层级间距差极大：区块 **96px**、层级内 8px —— 是"层"的节奏不是"列"的节奏 |
| density | `medium` | 控件 36px、行高 44px、卡片内边距 24px |
| radius philosophy | `continuous` | 大圆角：surface **14px**、卡片 18px、控件 8px —— 让光沿边缘爬 |
| border treatment | `none-with-depth` | 默认 **0 边框**；确实需要边界时用 1px 白色 9%（"光边"而非描边） |
| surface treatment | `ambient-glow` | 玻璃（`blur(16px) saturate(140%)`）+ 内高光 + 24px 深投影 + 三层径向环境光 |
| navigation feel | `overlay-space` | 导航**浮**在内容上（半透明 + backdrop blur），当前项带青色光点 |
| data visualization | `glow-series` | 发光曲线 + 渐变面积 + 端点光点；网格极淡（7% 白），bar cap 6px |
| motion language | `atmospheric` | 四类角色全开；120–720ms；进入位移 24px + **6px 模糊**（从远到近）；指针视差因子 **1.0** |
| visual hierarchy | `light-and-depth` | 越亮越靠前。canvas → surface → raised，每层亮一点点 |

> **判据**：把三套 pack 都转成灰度，cinematic 依然可辨——深度感来自亮度差、
> 圆角连续性、以及漂浮的导航，不来自"它是深色的"。

---

## 3. 使用方式

```tsx
import "@kits/style-cinematic/tokens.css";

<section data-kits-pack="cinematic" className="kits-surface">
  {/* 环境光层：容器级一次绘制，z-index: -1 */}
  <div className="kits-ambient" aria-hidden="true" />

  <p className="kits-label">Signal</p>
  <h1 className="kits-display">让每一个数字都有光。</h1>
  <p className="kits-lead">实时读取 12 个数据源，把异常推到最亮的地方。</p>
  <hr className="kits-rule" />

  <button className="kits-control kits-control--primary">开始分析</button>
</section>
```

### 可用的工具类（由 pack 提供）

| class | 作用 |
|---|---|
| `.kits-display` | 大标题（500 字重 / 1.08 / 微弱 text-shadow 光） |
| `.kits-lead` | 导语（正文 ×1.15，颜色提亮到 ink） |
| `.kits-body` | 正文（ink-muted，1.65） |
| `.kits-label` | 青色标签 + 淡光 |
| `.kits-data` | 读数（2.25rem tabular-nums） |
| `.kits-mark` | 青色强调 + 光晕 |
| `.kits-ambient` | **环境光层**（容器级径向渐变，`position:absolute; z-index:-1`） |
| `.kits-surface` / `.kits-surface--glass` | 实表面 / 玻璃表面 |
| `.kits-rule` / `.kits-rule--short` | 发光渐变分隔线 / 短发光强调线 |
| `.kits-control` / `.kits-control--primary` | 玻璃次按钮 / 发光主按钮 |

### 环境光的正确用法

```html
<!-- ✅ 一个容器一次绘制 -->
<section class="kits-surface"><div class="kits-ambient"></div>…</section>

<!-- ❌ 每个卡片都画一次：N 次合成，且焦点消失 -->
<article><div class="kits-ambient"></div></article>
<article><div class="kits-ambient"></div></article>
```

---

## 4. 什么时候**不要**用

- 需要打印 / 导出浅色文档的场景。
- 户外强日光场景（深色 + 反光 = 不可读）。
- 长时间连续作业的表单密集后台（眼疲劳）。
- 医院、政务、财务合规类正式界面——这套风格的情绪太"发布会"。
- 同时显示 40+ 行数据的表格页（深色表格的横线会消失）。

更多见 `manifest.json` 的 `recommendedFor` / `avoidFor`（枚举标签）与 `recommendedForNotes` / `avoidForNotes`（人读的完整理由）。

---

## 5. 无障碍

- **对比度**：ink `#eef2f8` on surface `#0f1420` ≈ **15.3:1**；ink-muted `#93a0b8` ≈ **6.8:1**；accent `#4fd6ff` ≈ **10.9:1**。
- **禁用纯白**：`#ffffff` on `#000000` 会产生 halation（光晕残影），已用 `#eef2f8` 规避。
- **玻璃表面不承载正文**：`backdrop-filter` 的实际对比度取决于背后内容，不可控；正文容器必须用实表面。
- **焦点可见**：深色下浏览器默认 focus ring 可能不可见 → 使用 `--kits-color-focus`（青色），并提供 `focus-visible` 轮廓。
- **reduced-motion**：`collapseTo 0ms`，但**保留透明度淡入**——深色页面上直接切断会出现闪白。指针视差、网格动画、光标全部关闭。
- **环境光**：`aria-hidden="true"` + `pointer-events: none`，纯装饰。

---

## 6. 性能

| 项 | 值 |
|---|---|
| 分类 | **B**（合成友好，但有 backdrop-filter 与多层渐变成本） |
| JS | 0 KB |
| CSS | ~6 KB（未压缩） |
| 主要成本 | `backdrop-filter`（导航 + 浮层）、三层径向渐变、`text-shadow` 光晕 |

**硬约束**：

1. `backdrop-filter` 同屏 **≤ 2 处**，且只用于导航与浮层——绝不用在列表项或卡片上。
2. 环境光必须是**一个**绝对定位层，不是每个子元素的背景。
3. `text-shadow` 光晕限制在 40px / 12% 以内；低端 Android 会为每个发光文本创建额外合成层。
4. 指针视差必须走 `transform: translate3d`，禁止改 `top/left`。

---

## 7. 相关资产

- 组件：`spotlight-surface`（必配）、`data-cursor`（必配）、`animated-grid`（必配）、`interactive-hero` / `insight-reveal`（可选）
- 效果：`ambient-glow`、`animated-grid`
- 参考板：[`references/cinematic/`](../../references/cinematic/)
- 技能：[`skills/visual-direction/SKILL.md`](../../skills/visual-direction/SKILL.md)
