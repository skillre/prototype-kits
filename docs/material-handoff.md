# 材质归属 · Core / Style Pack / Effect Pack / Product

> v0.2 · K8（Art Direction Material Handoff）。这一页回答一个问题：
> **Factory v1.2 把 personality 从 Core 移出去之后，那些材料归谁？**

Factory v1.2 的 Core Neutrality 把 ambient glow / hero glow / chart glow /
cinematic lighting / decorative halo / surface sheen 从 `app/globals.css`
移进了 Reference Sample 的显式 opt-in 层。那是正确的一步，但它只解决了
"Core 不该默认拥有" —— **没有回答"那谁该拥有"**。

K8 的答案是：**Style Pack 提供材质语言，Effect Pack 提供可独立启停的视觉行为，
产品决定在哪里用。** Kits 不替产品做 composition，也绝不自动生效。

---

## 1. 四层各管什么

| 层 | 拥有 | 不拥有 |
|---|---|---|
| **Factory Core** | spacing · typography mechanics · 语义 surface / ink · focus · 无障碍状态 · responsive 容器 · layout primitives · density 机制 · border / rule 的基础语义 · reduced-motion 行为 | 任何"性格"：ambient / hero glow / chart glow / cinematic lighting / 装饰性 halo / brand sheen |
| **Style Pack** | **材质语言**：用什么建立层级（`hierarchy`）、光归谁（`ambient`）、发光有没有预算（`glow`）；以及它的 CSS 变量（`--kits-color-glow`、`--kits-surface-*`、`--kits-texture-*`、`--kits-grid-*` …） | 决定某个页面要不要用；决定产品结构 |
| **Effect Pack** | **可独立启停的视觉行为**：环境光（`ambient-glow`）、表面材质（`paper-grain`）、线（`scanline-sweep`）；每个效果自己的公开变量 | 自己启动自己；组合到哪个容器上 |
| **Product** | **在哪里、为什么**：Hero 要不要 wash、某条折线要不要 glow、这个 dashboard 是不是完全不用 ambient；以及所有 composition | 重新发明一套光/材质（那是 pack 与 effect 的职责） |

一句话：**pack 给词汇，effect 给动作，产品写句子。**

---

## 2. "Personality must remain explicit" 是可执行的

装 Kits **不会**自动给 `body` 加光、给 hero 加 wash、给 chart 加 halo。
这句话不是承诺，是一条机器判据（`scripts/lib/material-scope.mjs`）：

> pack / effect 的样式表**可以**在 `:root` 这样的全局选择器上声明**自定义属性**
> （变量是"能力"，声明它不改变任何像素），但**只能在属于自己的选择器里作画**
> （pack：`[data-kits-pack="<id>"]…`；effect：`.kits-effect-<id>…`）。

`pnpm registry` 会对三套 pack 与三个 effect 的样式表逐条扫描，把它作为
`material/paint-out-of-scope` 判为 **error**（当前：6 份文件、64 条规则、
其中 40 条作画，0 条越界）。判据非空有反证测试：`body { background-image: … }`
与 `* { box-shadow: … }` 一定会被抓到。

于是三件事同时成立：

1. 装 pack → 只买到变量与作用域内的 class，页面外观不变；
2. 装 effect → 只落到 `lib/kits/installed/<asset-id>/`，产品不 import 就没有像素变化；
3. 移除 effect → 托管区被整体替换、lock 不再记录它，产品自己的文件一个字节都不动。

---

## 3. `materialDirection`：Style Pack 的材质语言

写在 `styles/<pack>/manifest.json`，**可选**（不声明 = 合法旧状态，audit 报 info）：

```jsonc
"materialDirection": {
  "hierarchy": "light",            // light | rule | space | texture —— 用什么建立层级
  "ambient": "pack-authored",      // pack-authored | effect-only | none —— 环境光归谁
  "glow": "budgeted",              // budgeted | forbidden —— 发光有没有预算
  "notes": "cinematic 用光建立层级：…"
}
```

三个字段里，`hierarchy` 是**声明**（给人和 agent 读，判定不去猜审美），
`ambient` 与 `glow` 是**可核对的**：

| 声明 | 靠什么核对 | 不一致时 |
|---|---|---|
| `ambient: "pack-authored"` | 该 pack 的 `tokens.css` 里必须真的有 `.kits-ambient` | `material/ambient-claim-unbacked` |
| `ambient: "none"` / `"effect-only"` | 不许出现 `.kits-ambient` | `material/ambient-leak` |
| `glow: "forbidden"` | `--kits-color-glow` 必须是 `transparent` | `material/glow-claim-conflict` |
| `glow: "budgeted"` | 它必须**不是** `transparent` | `material/glow-unused` |

当前三套 pack：

| pack | hierarchy | ambient | glow | 依据 |
|---|---|---|---|---|
| `editorial` | `space` | `none` | `forbidden` | 0 个 radial-gradient、`--kits-color-glow: transparent`、无 `.kits-ambient` |
| `cinematic` | `light` | `pack-authored` | `budgeted` | `.kits-ambient`（三个径向光源）、`--kits-color-glow: rgb(79 214 255 / 0.5)` |
| `instrument` | `rule` | `none` | `forbidden` | 0 个 radial-gradient、`--kits-color-glow: transparent`、无 `.kits-ambient` |

**它不做什么**：不把 CSS token 搬进 JSON（那只是又一份清单）；不含任何 mobile 字段
（移动端语义仍然只有 K2 的 `mobileCompatible` / `mobileFallback` 一份）；
不驱动任何自动行为。

---

## 4. `material.kind`：Effect Pack 的材质类别

写在 `effects/manifest.json` 的每个 effect 节点上（可选），词表只有三个值：

| kind | 含义 | 当前 |
|---|---|---|
| `light` | 画的是光 | `ambient-glow` |
| `texture` | 画的是表面材质 | `paper-grain` |
| `line` | 画的是线 | `scanline-sweep` |

它的唯一用途是**交叉核对**：声明 `ambient: none` 或 `glow: forbidden` 的 pack，
不允许把 `light` 类的 effect 写进自己的 `effects[]` —— `material/light-effect-forbidden`。
三个值是从现有实现反推的，不是一张待填的目录：**K8 没有新增 effect pack，
也没有给 `ambient-glow` 加旋钮** —— 它早就有 `--kits-effect-ambient-*`
（颜色 / 位置 / 尺寸 / 衰减 / 整体强度）与 `--breathing` 修饰符。

---

## 5. 与 K1 / K2 / K6 的关系

- **K1 `darkDirection`**：两件事，互补而不重复（一个是暗色怎么来，一个是材质是什么）。
  唯一**可证明**的交叉：`darkDirection.strategy = product-authored`（暗色由产品写）
  却 `ambient: pack-authored`（环境光写死在 pack 里）→ `material/dark-authoring-gap`
  （**warn，不是 error**：这不是矛盾，是缺口 —— 产品的暗色覆盖没有 ambient 槽位可改）。
  其余组合不做检查：**不创造伪精确规则**。
- **K2 移动端**：材质字段里没有、也不允许有 mobile 语义；
  effect 的移动端 story 仍然写在 `effects/manifest.json` 的 `mobile` 字段与
  registry 的 `mobileCompatible` / `reducedMotion` 里（K2 的一份）。
- **K6 引用**：`material.kind` 的交叉核对只对 `effects[]` 里**类型正确**的引用生效；
  引用本身是否登记、类型是否匹配仍由 K6 负责。链路依旧是
  `schema $defs → manifest.schema.json → manifest-contract.mjs → registry-audit → tests / Playground`。

---

## 6. Reference Sample 的 personality：谁被吸收，谁留给自己

对照 `prototype-starter/app/sample-command-center.css`（只读）与 N1 的 Core Neutrality 名单：

| Reference Sample 的概念 | 判定 | Kits 里的对应物 |
|---|---|---|
| ambient wash（品牌 + 暖色径向晕染） | **absorbed by Kits** | `effect/ambient-glow`（`--kits-effect-ambient-primary/secondary/rim` + `strength`） |
| hero wash（Hero 自己的一束光） | **absorbed by Kits** | `effect/ambient-glow`（容器级实例：position / size / falloff 都可以只改这一处） |
| cinematic lighting（用光建立层级） | **absorbed by Kits** | `style/cinematic` 的 `materialDirection.ambient = pack-authored` + `.kits-ambient` |
| ambient grid（表面后方的极淡网格） | **absorbed by Kits** | `component/animated-grid`（`--kits-grid-cell/line-color/fade`）+ pack 的 `--kits-data-grid-*` |
| ambient drift（晕染缓慢漂移） | **absorbed by Kits** | `effect/ambient-glow` 的 `--breathing` 修饰符 + `--kits-dur-ambient` |
| glow 颜色预算（`--chart-glow` / `--ambient-ring`） | **absorbed by Kits** | pack 的 `--kits-color-glow` + `materialDirection.glow` |
| surface sheen（高级卡片顶部高光） | **remain Product-only** | pack 已有表面处理（`--kits-surface-shadow` / `--kits-surface-backdrop`）；一层渐变高光属于 composition |
| chart glow（只给一条折线的一次 bloom） | **remain Product-only** | 颜色来自 pack，**用在哪一条 path 上**是产品的决定 |
| live halo / ambient ring（实时点的扩散光晕与环色） | **remain Product-only** | 指示器是 composition；节奏可复用 `--kits-dur-ambient` 与 reduced-motion 契约 |
| CRM / demo 的组合层（dashboard hero、KPI 卡片、侧栏品牌块） | **remain Product-only** | 与 Kits 无关的产品结构 |

这张表是**可执行的**：`tests/material-handoff.spec.ts` 里逐条核对 ——
说"被 Kits 吸收"的必须指出资产与证据（文件 + 变量/类），
说"只属于产品"的名字（`surface-sheen` / `chart-glow` / `live-halo` …）
**不允许出现在 Kits 的任何 CSS 里**。

**不追求 100% 搬走。** 搬不动的、或者本来就属于 composition 的，明确留在产品里 ——
"Kits 什么都管"与"每个产品自己发明一套"是同一个错误的两面。

---

## 7. 怎么用（产品侧）

```bash
# 1. 只买你需要的能力（不写 --effects 就是完全不要 effect）
kits add --target ../my-prototype --style cinematic \
         --components spotlight-surface \
         --effects ambient-glow
```

```tsx
// 2. 显式消费：import 适配层（产品 → adapters → installed），再挂到容器上
import "@/lib/kits/adapters/effect-ambient-glow.css";

<section data-kits-pack="cinematic">
  <div className="kits-effect-ambient-glow">…</div>
</section>
```

```css
/* 3. 需要时只覆盖公开变量 —— 那才是"允许覆盖"的含义 */
.hero {
  --kits-effect-ambient-strength: 0.6;
}
```

移除时：把 `--effects` 去掉重跑 `kits add`。托管区会被整体替换、lock 随之更新，
**产品自己的文件不被触碰**；上一次生成的 `adapters/effect-<id>.*` 会留在产品目录里，
`kits doctor` 会点名提示删掉它或把它声明成一个角色 —— 残留不会静默。

---

## 8. 明确不做

- **不自动选择**：Kits 不会因为 `materialDirection` 就替产品装 effect、插组件、
  加 class、打开 ambient；最终决定仍然由 Human Art Direction + Visual Manifest 做出。
- **不新增 effect pack**：现有三个能承接的就扩正式契约，接不住的明确留在产品里。
- **不做 token dump**：材质语言是少量语义字段（3 个 + notes），不是几十个微调旋钮。
- **不改 Factory / 不改产品仓库**：K8 只在 Kits 侧交付契约、判定与文档；
  Factory 的 Visual Manifest 仍然只说 `stylePack / signatureComponents / effects / …`。
