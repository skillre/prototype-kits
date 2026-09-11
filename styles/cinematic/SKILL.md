---
name: style-cinematic
description: 使用 cinematic Style Pack 做 Visual Direction 与界面实现时的约束清单。当产品需要让人「沉浸」而不是让人「巡检」时加载。
---

# SKILL · cinematic Style Pack

你在用 **cinematic**。它的核心命题不是"深色"，而是**用光与深度分层**。
把边框换成阴影、把面板换成玻璃，只是表层；真正的规则是下面这些。

## 0. 先写 Visual Manifest，再写 JSX

```json
{
  "stylePack": "cinematic",
  "productType": "ai-analytics",
  "firstVisual": "深色空间里从左上打下来的环境光，标题浮在光里，下方一条发光曲线",
  "signatureComponents": ["spotlight-surface", "data-cursor", "animated-grid"],
  "effects": ["ambient-glow"],
  "motionDirection": "atmospheric",
  "density": "medium",
  "avoid": ["glassmorphism", "purple-gradient", "card-everywhere", "pure-white-on-pure-black"]
}
```

## 1. 必须做

1. **层级用光的亮度表达**。要更重要的区块 → 提亮表面 + 加大字号 + 给一层环境光，**不要**加边框。
2. **环境光是容器级的**：一个容器一个 `.kits-ambient`，`aria-hidden="true"`，`z-index:-1`。
3. **同时发光的东西最多一个**。页面上有两处 glow 就等于没有焦点。
4. **正文写 `var(--kits-color-ink-muted)`**，标题写 `ink`。深色页面靠这个差值建立阅读层级。
5. **圆角要大且一致**（surface 14px / 控件 8px），让光沿着边缘连续爬行。
6. **交互要有物理感**：hover 抬升 1px、`translate3d` 视差、spotlight 跟随。
7. **玻璃只用于浮层与导航**，正文容器必须是实表面。
8. **深色下的字重 ≥ 500**，否则字被背景吃掉。

## 2. 禁止做

| 禁止 | 原因 |
|---|---|
| `glassmorphism` 铺满（每个卡片都玻璃） | 深度需要对比，全是玻璃 = 没有深度 |
| 纯白 `#fff` 配纯黑 `#000` | halation 会让文字边缘发虚 |
| `purple-gradient` 当背景 | cinematic 的光必须有方向、有数量限制，不是背景图 |
| 同时多个 glow | 焦点失效 |
| 粗描边 / 深色下的实线边框 | 像调试框；用亮度差或 1px 白色 9% 的"光边" |
| 大元素回弹缓动 | 视觉晕眩（`spring` 只给 ≤ 8px 位移的元素） |
| 卡片悬浮上移 + 旋转 + 缩放三件套 | animation everywhere |
| 表格用深色横线 | 深色下 1px 线几乎不可见，改用交替背景亮度 |
| `backdrop-filter` 用在列表项 | 每项一次滤镜 = 移动端掉帧 |

## 3. 自检清单

- [ ] 页面转灰度后，是否仍能看出"越靠前越亮"？
- [ ] 同屏发光的元素是否 ≤ 1 个？
- [ ] 环境光层是否只有一个（而不是每个卡片一个）？
- [ ] 正文是否使用 `ink-muted`，标题才用 `ink`？
- [ ] 是否出现了纯白 `#fff` 或纯黑 `#000`？
- [ ] `backdrop-filter` 出现次数是否 ≤ 2？
- [ ] 所有指针视差是否走 `transform: translate3d`？
- [ ] `prefers-reduced-motion: reduce` 下是否保留淡入（避免闪白）但关闭所有位移动画？
- [ ] 触屏 / 390px 下视差与网格动画是否全部关闭？
- [ ] 焦点环在深色背景上是否可见？

## 4. 常见误用

**误用：深色背景 + 400 字重正文。**
→ 后果：文字看起来发灰、发虚，用户会以为显示器脏了。深色下字重必须 ≥ 500。

**误用：给每个卡片加 `.kits-ambient`。**
→ 后果：N 次径向渐变绘制 + 焦点彻底消失。环境光属于容器。

**误用：用 `border: 1px solid #333` 分区。**
→ 后果：页面变成深色表格。改用 `.kits-rule`（渐变光晕线）或纯亮度差。

**误用：照搬 editorial 的排版尺度。**
→ 后果：cinematic 的行高 1.08 比 editorial 的 1.02 松，因为光晕需要呼吸；
字距是**正**的，因为深色下收字距会让字粘连。不要跨 pack 抄数值。

## 5. 与其它 pack 的边界

- 需要**阅读优先、大留白、弱动效** → 换 `editorial`。
- 需要**密集读数、实时刷新、硬边界** → 换 `instrument`。
- 一页两性格（例如「深色叙事首屏 + 浅色数据附表」）→ 两个 `data-kits-pack` 容器分区，各自 `isolation: isolate`。

## 6. 换 pack 时你唯一要改的东西

```diff
- <section data-kits-pack="cinematic">
+ <section data-kits-pack="instrument">
```

`.kits-ambient` 这类 pack 专属工具类会自然失效（该 pack 没有定义它），
**这不是 bug**：换 pack 就该换掉 pack 专属的装饰层。若你发现组件本身依赖
了 `.kits-ambient`，那是组件违规——装饰层应由页面组合，不由组件内建。
