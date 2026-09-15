# Effect Packs

> 表面与环境的可复用效果。**纯 CSS**，零运行时。

---

## 一个判定：Effect 还是 Component？

```
需要 JS 驱动吗？
├── 需要（指针追踪、观察器、状态机） → Signature Component
└── 不需要（背景、纹理、光、扫描线）   → Effect
```

这条线是硬的。一旦一个 effect 需要监听 `pointermove`，它就已经是一个组件了 ——
把它塞进 `effects/` 会让"零运行时"这个承诺变得不可信。

---

## 现有的三个效果

| id | pack | class | 材质类别 | 性能 | 是什么 |
|---|---|---|---|---|---|
| `paper-grain` | editorial | `.kits-effect-paper-grain` | `texture` | A | 纸纹（内联 SVG 噪声，0.035 不透明度） |
| `ambient-glow` | cinematic | `.kits-effect-ambient-glow` | `light` | B | 环境光（三个有方向的径向光源） |
| `scanline-sweep` | instrument | `.kits-effect-scanlines` | `line` | A / B | 扫描线 + 单次扫掠 |

`material.kind`（K8）只有这三个值，用途是**与 pack 的材质预算交叉核对**：
声明 `ambient: none` 或 `glow: forbidden` 的 pack 不允许把 `light` 类 effect 列进
自己的 `effects[]`。它不描述移动端（那是 K2 的 `mobile` 字段），也不启动任何东西。

> **Effect 永远不会自己生效。** 装 effect 只是把能力放到
> `lib/kits/installed/<asset-id>/` 并生成一个适配层文件；产品不 import、不挂 class，
> 就没有任何像素变化。`pnpm registry` 会逐条扫描确认这一点（`material/paint-out-of-scope`）。

### 用法

```tsx
import "@kits/effects/paper-grain.css";

<section data-kits-pack="editorial">
  <div className="kits-effect-paper-grain">…</div>
</section>
```

三种效果都**只读 `--kits-*` 变量**，因此它们会自动适配所属 pack。

---

## Effect Contract —— 公开变量

效果的视觉参数必须通过 `--kits-effect-<id>-*` 公开，并在 `effects/manifest.json`
的 `variables[]` 里登记。产品只 override 这些变量，**不重写实现细节**。

### `ambient-glow`（v0.1.1 起）

| 变量 | 默认值 | 作用 |
|---|---|---|
| `--kits-effect-ambient-primary` | `rgb(79 214 255 / 0.16)` | 主光颜色（左上，冷色），含 alpha |
| `--kits-effect-ambient-primary-position` | `18% 8%` | 主光中心位置 |
| `--kits-effect-ambient-primary-size` | `60% 50%` | 主光椭圆尺寸 |
| `--kits-effect-ambient-primary-falloff` | `62%` | 主光衰减半径（越大越柔） |
| `--kits-effect-ambient-secondary` | `rgb(255 182 79 / 0.1)` | 辅光颜色（右上，暖色） |
| `--kits-effect-ambient-secondary-position` | `85% 20%` | 辅光中心位置 |
| `--kits-effect-ambient-secondary-size` | `50% 45%` | 辅光椭圆尺寸 |
| `--kits-effect-ambient-secondary-falloff` | `60%` | 辅光衰减半径 |
| `--kits-effect-ambient-rim` | `rgb(139 123 255 / 0.12)` | 补光颜色（底部，紫调） |
| `--kits-effect-ambient-rim-position` | `50% 105%` | 补光中心位置 |
| `--kits-effect-ambient-rim-size` | `70% 55%` | 补光椭圆尺寸 |
| `--kits-effect-ambient-rim-falloff` | `65%` | 补光衰减半径 |
| `--kits-effect-ambient-strength` | `1` | 整体强度 0..1（呼吸按比例跟随） |

```css
/* 浅色主题：光要弱得多，而且要换成冷灰蓝，否则深色光在浅底上只会显得脏 */
:root[data-theme="light"] {
  --kits-effect-ambient-strength: 0.45;
  --kits-effect-ambient-primary: rgb(0 92 175 / 0.1);
}
```

**为什么默认值声明在 `:root`**：如果声明在 `.kits-effect-ambient-glow` 自己身上，
元素自身的声明会压过继承 —— 产品在 `body` 或 `[data-theme]` 上写的覆盖将**永远
不生效**。放在 `:root`（所有人的祖先）之后，"元素自己 > 更近的祖先 > `:root`"
这个覆盖链才是你预期的那个。

**为什么没有 `--kits-effect-ambient-blur`**：本效果当前没有模糊，柔度由
`*-falloff` 控制。补一个 `filter: blur()` 会给每个使用者的 `::before` 多加一个
合成层，而没人需要 —— 那是新增能力，不是补契约。

> **v0.1.0 的做法（已改）**：光色曾经是硬编码 RGB，理由写的是"光属于 cinematic
> 的物理设定，不该被换色"。深色单模式下成立，但真实消费立刻证明它不够：浅色
> 主题需要另一套光。硬编码的结果是产品只能自己发明 `--finance-ambient-*` 并
> **把整个渐变抄一遍** —— 契约不成立的地方，产品就会绕过去。
> 见 CHANGELOG K-05。

---

## 约束（三条通用）

1. **容器级，不是元素级**
   环境光、纸纹、扫描线都必须是"一个容器一次绘制"。
   给列表里的每个子元素加一次 = N 次绘制 + 视觉噪音。

2. **不透明度上限**
   纹理类效果不透明度必须 < 0.06 —— 否则会实际降低文本对比度。

3. **必须退出命中测试与无障碍树**
   `pointer-events: none` + 装饰性容器 `aria-hidden="true"`（由调用方保证）。

---

## 降级矩阵

| effect | reduced-motion | 触屏 | 说明 |
|---|---|---|---|
| paper-grain | 无需降级（静态） | 保留 | 静态纹理没有动效成本 |
| ambient-glow | 关闭呼吸，保留静态光 | 关闭呼吸 | 光本身保留：它是层级手段，不是动画 |
| scanline-sweep | 取消扫掠 | 取消扫掠 | 扫掠是**冗余**信号（数值本身已变），取消零信息损失 |

---

## 预留命名（incoming，未实现）

| id | pack | 说明 |
|---|---|---|
| `dither-overlay` | instrument | 半调抖动覆盖层，工程印刷质感 |
| `film-bloom` | cinematic | 高光溢出，仅用于单个焦点元素 |

> 预留条目只是为了防止命名冲突，**不代表已经可用**。
> 它们必须走完整的 incoming 流程才能变成 `approved`。
