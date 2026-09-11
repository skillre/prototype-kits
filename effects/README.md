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

| id | pack | class | 性能 | 是什么 |
|---|---|---|---|---|
| `paper-grain` | editorial | `.kits-effect-paper-grain` | A | 纸纹（内联 SVG 噪声，0.035 不透明度） |
| `ambient-glow` | cinematic | `.kits-effect-ambient-glow` | B | 环境光（三个有方向的径向光源） |
| `scanline-sweep` | instrument | `.kits-effect-scanlines` | A / B | 扫描线 + 单次扫掠 |

### 用法

```tsx
import "@kits/effects/paper-grain.css";

<section data-kits-pack="editorial">
  <div className="kits-effect-paper-grain">…</div>
</section>
```

三种效果都**只读 `--kits-*` 变量**，因此它们会自动适配所属 pack。
（`ambient-glow` 的光色是硬编码 RGB —— 那是刻意的：光属于 cinematic 的物理设定，
不该被换色。若产品要改光色，应改的是 pack 的光源定义，不是效果本身。）

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
