---
name: style-editorial
description: 使用 editorial Style Pack 做 Visual Direction 与界面实现时的约束清单。当产品需要「被阅读」而不是「被操作」时加载。
---

# SKILL · editorial Style Pack

你在用 **editorial**。这不是一套配色，是一套关于**阅读**的立场。
以下每条都是硬约束；违反其中任何一条，产物就不再是 editorial，而只是"用了衬线字体的普通后台"。

## 0. 先写 Visual Manifest，再写 JSX

```json
{
  "stylePack": "editorial",
  "productType": "research-report",
  "firstVisual": "一个 4.5rem 的衬线标题，下面一条 1px 横线，然后是 46ch 的导语",
  "signatureComponents": ["insight-reveal", "interactive-hero"],
  "effects": ["paper-grain"],
  "motionDirection": "restrained",
  "density": "low",
  "avoid": ["glassmorphism", "purple-gradient", "card-everywhere", "drop-shadow-elevation"]
}
```

没有 Manifest 就开始写样式 = 违规。完整要求见 [`../../skills/visual-direction/SKILL.md`](../../skills/visual-direction/SKILL.md)。

## 1. 必须做

1. **留白是主结构**。段落间距 ≥ 64px，标题上方间距 ≥ 2× 下方间距。先给空间，再给内容。
2. **层级只用字号与留白**。需要「更重要的区块」时，加大字号 + 加多上方留白，**不要**加深背景色。
3. **分区用 `<hr class="kits-rule">`**，不用带边框的盒子。
4. **标题用衬线、正文用衬线、标签用等宽**。三者角色不能混。
5. **数字用 `.kits-data`**（衬线大字号 + `tabular-nums`），不用彩色徽章。
6. **一屏一个视觉焦点**。首屏只允许一个 `h1` 级别的元素。
7. **动效只用 enter**：10px 上移 + 透明度，`cubic-bezier(0.16, 1, 0.3, 1)`，最高 220ms。
8. **宽度要收**：正文 58ch、导语 46ch、标题 22ch。一行超过 70 个字符就不叫阅读了。

## 2. 禁止做

| 禁止 | 原因 |
|---|---|
| `glassmorphism` / 毛玻璃 | 与纸质表面互斥，会立刻变成"科技风" |
| `purple-gradient` / 霓虹渐变 | 破坏印刷色彩关系 |
| `card-everywhere` | 卡片承载边界，editorial 用线承载边界 |
| `drop-shadow-elevation` | 纸不投影。层级来自线与留白 |
| `heavy-border`（≥2px 描边） | 页面会变成表格 |
| `neon-glow` / bloom / 内发光 | 光属于 cinematic，不属于纸 |
| 回弹 / 弹跳缓动 | 与 restrained 动效语言冲突 |
| animation everywhere（卡片悬浮上移、按钮抖动、图标旋转） | editorial 的动效预算近乎为零 |
| 三色以上的数据系列 | editorial 图表只有墨色 + 一个强调色 |
| 正文 uppercase | 大写仅限标签层 |

## 3. 自检清单（提交前逐条过）

- [ ] 页面转成灰度后，层级是否依然清楚？（靠字号/留白，而不是靠颜色）
- [ ] 是否有一条 1px 横线在承担分区职责？
- [ ] 一屏是否只有一个视觉焦点？
- [ ] 正文行宽是否 ≤ 70 字符？
- [ ] 有没有出现任何 `box-shadow`？
- [ ] 所有动效是否 ≤ 480ms、位移 ≤ 10px、无回弹？
- [ ] `prefers-reduced-motion: reduce` 下页面是否完全可读、无信息丢失？
- [ ] 390px 宽度下是否仍无横向溢出、无被压成单字一行的标题？
- [ ] 所有颜色是否都来自 `var(--kits-*)`，没有硬编码 hex？

## 4. 常见误用

**误用：标题用了衬线，正文也用了衬线，但行高压到 1.3。**
→ 后果：像报纸缩版，读两段就累。正文行高必须 ≥ 1.6。

**误用：为了"显得高级"，给数据加了柔和投影。**
→ 后果：立刻变成 dashboard。editorial 的数据靠**字大、字距紧、等宽对齐**显高级。

**误用：拿 editorial 做一个实时刷新页。**
→ 后果：每次刷新都触发一次 70ms 步进的 stagger，页面永远在动。
→ 正确做法：不是 editorial 的活，换 `instrument`。

## 5. 与其它 pack 的边界

- 需要**空间纵深与光** → 换 `cinematic`。
- 需要**密集读数与实时刷新** → 换 `instrument`。
- 需要**同一个页面里两种性格** → 用两个 `data-kits-pack` 容器分区，不要让它们互相渗透。

## 6. 换 pack 时你唯一要改的东西

```diff
- <section data-kits-pack="editorial">
+ <section data-kits-pack="cinematic">
```

组件、工具类名、结构**都不需要改**。如果你发现必须改组件才能换 pack，
说明你把 pack 的职责写进了组件——那是契约违规，请回头修组件，而不是修 pack。
