# Changelog

## Unreleased · Factory Governance v1.3（治理采纳 + 端口迁移）

本次**不改资产、不改 registry 内容、不改组件 API、不改已安装产品的任何东西**。
变的是这个仓怎么被管、以及 Playground / QA 用哪个端口。

### 治理采纳（policy 1.3.0）

- 新增 `AGENTS.md`（含 `factory-core-policy v1.3.0` 管理块）、`factory-policy.json`、
  `lib/factory-policy.schema.json`、`factory.lock.json`、`lib/factory-lock.schema.json`。
- 新增 `scripts/guard-agent-policy.mjs` + `scripts/lib/agent-policy.mjs`，命令是
  `pnpm factory:agents`，并且是 `pnpm check` 的**第一项**门禁。它核：编排边界、管理块逐字一致、
  schema 关键值、锁的身份与受管面、registry 角色、端口事实、以及 CI 契约（无部署调用、
  test/qa 串行）。
- 治理锁的 `kind` 写作 **`kits-registry`**，**不是 `product`**。Kits 是 registry 的**来源仓**，
  不是从 Factory 基线派生的产品（本仓没有 `init-contract.json`，也不该有）。把 `kind` 写成
  `product` 只会让「这个仓是什么」变成一句假话。
- **跨仓缺口（已知、已留档、未解决）**：根控制面 `contracts/factory-lock.schema.json` 目前用
  `oneOf` 只描述两种形态 —— `factory-baseline`（基线自己）与 product lock；后者的
  `additionalProperties: false` 里**没有 `kind` 字段**。因此一份如实写着 `kits-registry` 的锁
  两个分支都不匹配，控制面一侧会报 `factory-lock-off-contract`（UNKNOWN）。这不是本仓能自决的：
  正确顺序是**根契约扩 schema**，本仓据此收敛。缺口记录在 `factory.lock.json` 的
  `unresolved[]` 里，条目 id 为 `upstream/contract-kits-registry-shape`（`value: null`）。
- 新增 `.github/workflows/ci.yml`：**只做质量门** —— `factory:agents` → `registry` →
  `verify:standalone` → lint / typecheck / test / build，然后一个用 `needs:` 串行的 browser QA job。
  workflow 文本里没有任何部署 CLI 调用、没有任何部署 token；这不是靠约定，而是 `pnpm factory:agents`
  逐行扫这个文件并对此断言。
- `pnpm check` 现在是 `pnpm factory:agents && pnpm lint && pnpm typecheck && pnpm test && pnpm build`。

### 端口迁移：Playground / QA 迁到独立槽位 3300

- **原端口是 3200，由 starter / s1 / kits 三个仓共用。** 三个仓都自管 server，任意两个同时运行
  就会互相把对方的页面当成被测应用 —— 而且不报错。Kits 是 Playground、不是业务原型，
  按根控制面 `catalog/ports.json` 的 advisory 让到独立槽位 **3300**，从此不与任何原型互撞。
- 迁移覆盖面：`playground/package.json` 的 `dev` / `start`、`.qa/kits-shots.mjs` 与
  `.qa/reveal-probe.mjs` 的默认地址、`README.md`、以及端口守卫的提示文案。旧端口号
  **不再出现在任何声明面**上（`pnpm factory:agents` 的 `port/retired-fact` 会核）。
  本节是**历史记录**，所以这里保留旧端口号；声明面只写当前值，一个事实一个答案。
- 新增 `.qa/qa.config.mjs` 作为端口与 Playground server 的**唯一来源**：在此之前端口散落在四处，
  四处各写一遍就必然有一处先过期，而过期的那一处恰好是「QA 打谁」。
- 新增 `scripts/check-qa-port.mjs` 预检守卫：端口被占用时 fail loudly 并给出 `lsof` 定位命令，
  不 adopt、不猜、不替人杀进程。
- **QA 不再复用未知 server。** 原先 `.qa/*.mjs` 直接 `page.goto` 一个默认地址 —— 那等于
  「这个端口上有谁就算谁」。现在新增 `.qa/qa-server.mjs`：server 由本次 run 启动（独立**进程组**，
  结束只杀自己那一组），起完先做**身份检查**（页面必须带着 Kits 自己的标记 `data-kits-pack` /
  `data-kits-component`），通过之后才跑断言。设了 `KITS_BASE` 时走 EXTERNAL 模式：不起也不停
  server，但身份检查照跑。**就绪 ≠ 身份**：前者任何 server 都能满足。
- 新增 `tests/qa-port.spec.ts`，把上面这些钉成静态断言（端口单来源、无旧端口残留、
  入口必须走受管 server、只杀自己的进程组）。

> 已知未验证项：本次改动**没有在真实 GitHub Actions runner 上跑过** —— 本仓远端
> `skillre/prototype-kits` 尚未发布（2026-09-15 探测返回 404），workflow 因此还没有运行场所。
> 记录在 `factory.lock.json` 的 `unresolved[]`，条目 id 为 `upstream/kits-remote`。

## v0.2.0 · Contract Hardening

`v0.1.1` → `v0.2.0`。两次独立消费之间（AI Finance 的 Source Installation 与
第三个 Prototype「AI Research」的自建 Art Direction）暴露出同一类问题：
**metadata 看起来是契约，实际上只是字符串** —— 写错也不会变红。本次把八件事
变成可执行的判定，没有加 Style Pack、没有加 Signature Component、没有视觉 redesign。

**兼容**：资产 id、组件 API、CSS 变量、`kits.lock.json` 的 `schemaVersion`（仍是 1）
全部不变；v0.1.1 安装的产品可以直接重跑 `kits add`。变的是 metadata 的表达方式与
判定强度 —— 三个 pack、五个组件、effects 与 CLI 的分发内容因此升到 `0.2.0`，
未变更的 `contracts`（0.1.1）与 `react-utils`（0.1.0）保持原版本，`kits diff`
说出的仍然是实话。

### K4 · 中性适配接缝（neutral Product adapter seam）

适配层以前只生成**资产名**文件，产品代码只能写
`import { DataCursor } from "@/lib/kits/adapters/data-cursor"` —— 资产身份被焊进
产品源码。现在生成骨架（`adapters/seam/{README.md,seam.json,_template.ts}`），
由产品自己命名角色；doctor 双向核对声明与实现（悬空绑定 fail、有文件无声明 warn、
角色名与资产 id 撞车 fail、无接缝的旧安装 warn + 迁移路径）。
`ADAPTER_TEMPLATE_VERSION` 与 `lock.seam` 随之升到 `0.2.0`。

### K5 · doctor 诚实性（zero-scan 不得 PASS）

`boundary` 有一条正式的静默失败路径：扫过 0 个产品源文件、发现 0 个违规 → ✓ pass。
现在它是三态（pass / fail / not-applicable），`na` 在摘要里单独计数，
**有 na 时不会说"全部通过"**；扫描同时给出 `scanned` 与 `excluded` 作为范围证据。

### K1 · `darkDirection`

Style Pack 可以声明暗色方向（`single-theme` / `pack-authored` / `product-authored`）。
可选，但一旦声明就必须可执行：`product-authored` 必须给出 `approach`、
WCAG `contrastTarget`（正文 ≥ 4.5、大字 ≥ 3）与 `slots`，且每个槽位要与该 pack 的
`tokens.css` 逐个变量核对。三套 pack 首次给出真实取值：instrument `preserve-hue`、
editorial `invert-contrast`、cinematic `single-theme`。

### K2 · `mobileCompatible` 语义

`true` 现在有明确定义：**在它自己声明的支持条件下允许使用，不表示推荐**。
新增 `"fallback-only"`（只能在声明的 `mobileFallback` 下使用）并首次用于
`data-cursor`；审计输出的是**状态词**（推荐 / 可用但不推荐 / 允许（需适配）/
仅降级形态 / 不支持 / 不适用），不再是真假值。instrument 成为"兼容但不推荐"的
真实样本（`avoidFor` 含 `mobile`）。

### K3 · `technical-grid` 漂移归零

三处引用了一个从未实现、也从未登记进 registry 的效果名，全部删除。

### K6 · 类型化引用一致性

`signatureComponents` / `optionalComponents` / `discouragedComponents` 必须指向
component，`effects` 必须指向 effect —— 字段名不再等于类型（cinematic 曾把
`animated-grid` 写在 `effects[]` 里）。同时核对 registry ↔ manifest 的
`signatureComponents`、组件 `usedByStylePacks` 的角色词 ↔ pack 三列表（双向）、
effect 与聚合清单的一致性、`package.json` 的包名与版本。

### K7 · 适配维度（fit taxonomy）

`recommendedFor` / `avoidFor` 从自由散文变成**枚举标签**（10 个维度 + `x-` 扩展），
同一维度不得同时推荐与回避；v0.1.1 的 46 条散文**逐字**保留在同名 manifest 的
`recommendedForNotes` / `avoidForNotes` 里。标签同时写进 registry 与 manifest，
两侧必须逐字相等。

### K8 · 材质归属（material handoff）

Factory v1.2 把 personality 从 Core 移出之后，归属由 K8 补齐：Style Pack 用
`materialDirection`（`hierarchy` / `ambient` / `glow`）声明材质语言，Effect Pack 用
`material.kind`（`light` / `texture` / `line`）声明材质类别，产品决定在哪里用。
`ambient` 与 `glow` **与 CSS 逐条核对**，并与 `effects[]` 交叉；
"装 Kits 不会自动污染页面"由 `scripts/lib/material-scope.mjs` 扫描证明
（作画必须在自己的选择器里）。**没有新增 Effect Pack，也没有给 ambient-glow 加旋钮。**

### 单一事实来源

`registry/assets.schema.json` 的 `$defs` 是全部枚举（fit 标签、mobile 取值、
dark 策略、材质语言、角色词、effect 材质）的**唯一来源**；
`scripts/lib/{fit-semantics,material-scope,manifest-contract}.mjs` 是判定的唯一实现；
`pnpm registry`、Kits 测试与 Playground 审计页共用它，并有一条测试钉住
"schema 声明的"与"执行做的"等价。`pnpm registry` 现在**是一个门**：
有 error 时退出码非 0，并逐项说明这次检查了什么、覆盖了多少对象。

---

## v0.1.1 · Patch Hardening

`v0.1.0` → `v0.1.1`。第二次真实消费（AI Finance × Source Installation）
证明了 Source Installation 架构成立，也暴露出五个 Kits 缺陷。本次把它们修回 Kits。

**这是 PATCH**：没有新 Style Pack、没有新 Signature Component、没有视觉 redesign。
资产 id、组件 API、Visual Manifest 全部保持兼容；`cinematic` 的默认渲染逐字等价。

只有 5 个资产的**分发内容**变了（`contracts` / `cli` / `insight-reveal` /
`animated-grid` / `ambient-glow`），它们的版本号随之升到 0.1.1；
其余资产仍是 0.1.0 —— 独立版本号让 `kits diff` 说出实话。

### 修复 · K-01 InsightReveal 无障碍回归（P0）

`step="group"` 的自建宿主带了 `aria-hidden="true"`。`display: contents` 只影响
布局、**拦不住剪枝**，于是整个内容子树从无障碍树消失：

```
DOM 里按钮存在          → getByRole("button") 命中 0
屏幕阅读器读到的洞察层   → 空白
```

→ 宿主改用 `role="presentation"`：同样声明"本元素无语义"，但**不剪枝**。
后代 heading / button / link / listitem 全部照常暴露。

用 `role="presentation"` 而不是"什么都不写"：产品若把 `display: contents` 改成
`block`（例如为了给每段做位移动画），不带 role 的 div 会变成匿名节点，
破坏 `ul` 与 `listitem` 之间的父子关系。

> 附带一条教训：`tests/insight-reveal-group.spec.ts` 里原来有一条测试
> **断言了 `aria-hidden="true"`** —— 它把 bug 写进了期望值，所以一整轮真实消费之后
> 测试仍然是绿的。现在那条测试断言的是反面（"绝不带 aria-hidden"）。

### 修复 · K-02 coarse-pointer 契约被 pack 覆盖

移动端把网格单元格放大 1.5 倍的反摩尔纹降级**静默失效**。两处错叠在一起：

```css
/* v0.1.0 */
--kits-grid-cell: calc(var(--kits-grid-cell) * 1.5);
```

1. **自引用** → 该声明在 computed-value 阶段被判无效（依赖环）；
2. 即便不循环，`[data-kits-pack]` 与 pack 的 `[data-kits-pack="cinematic"]`
   特异性相同（0-1-0）而 pack 源顺序更晚 → pack 的 `64px` 获胜。

实测：期望 96px，得到 64px。

→ 拆成两个名字，乘法写在消费点上：

| 变量 | 归属 | 值 |
|---|---|---|
| `--kits-grid-cell` | pack | 基准尺寸（48 / 64 / 32） |
| `--kits-grid-cell-scale` | **契约** | 指针能力因子（细指针 1 / 触屏 1.5，`!important`） |
| `--kits-grid-density` | **组件** | 密度乘数（none 0 / dense 0.5 / normal 1 / wide 2） |

三者由 `animated-grid.css` 在 `.kits-grid` 上相乘得到有效值。
两个名字不可能互相覆盖 —— 这比加 `!important` 更根本；`!important` 只是
再挡一层"有人把因子当风格旋钮"的情况。乘法写在 `.kits-grid` 自己身上
（自定义属性在**声明它的元素**上完成 var() 替换；写在 `:root` 会认死
`:root` 的值，产品把 pack 作用域放到容器上时会拿到过期基准）。

> **这一条第一次没修对，值得记下来。**
> 第一版只改了 CSS，单元测试全绿，而浏览器里量出来仍然是 64px。
> 原因不在 CSS：`AnimatedGrid` 自己在**行内样式**里写了
> `"--kits-grid-cell-size": calc(var(--kits-grid-cell) * 2)`，
> 行内样式优先级高于样式表，把契约的能力因子整个盖掉了。
>
> 修法是把密度降级成一个**乘数输入**（`--kits-grid-density`），
> 组合权收回到样式表。同时在组件侧立了一条测试
> （"组件不得出现 `--kits-grid-cell-size` / `--kits-grid-cell-scale`"）——
> 只断言 CSS 是查不出这个缺陷的。
>
> 这也是本节唯一一处**必须靠浏览器量**才发现的修复：playground 的 coarse-pointer
> 探针给出 64 → 96 之后，才算真的修好了。

### 修复 · K-03 doctor 在独立安装下把"没查"说成"查过了"

```js
// v0.1.0
const sameMajor = kitsTypesMajor === null || targetMajor === kitsTypesMajor;
```

Kits 仓库不可见时 `kitsTypesMajor` 是 `null`，这一条**恒为真**；而 detail 文案
照写"与 Kits 解析到同一 major（19）"。

→ 每个检查新增 `state`，明确说明结论是靠什么得到的：

| state | 含义 |
|---|---|
| `verified` | 直接读到了实际解析出的版本并据此判定 |
| `compatible` | 未读到上游；依据**声明的支持区间**判定 |
| `upstream-unavailable` | 两者都没有 → 无法判定（warn，不静默） |
| `not-applicable` | 本次安装不涉及该检查 |

安装时把声明区间写进 lock（`compat.declaredReactRange`），独立安装据此判定。
doctor 输出多一列 `[state]`，并新增 `upstream-kits` 检查说明当前处于哪种模式。

### 修复 · K-04 Style / Effect 缺 TS 缝（最重要的结构性改进）

v0.1.0 只给 style pack 生成了 CSS 缝，没有 TS 缝。产品要拿 `cinematicMotion`
去做 `motionToCssVars()`，**没有合规的路可走**，只能：

```ts
import { cinematicMotion } from "../installed/cinematic/index";   // ← 越过适配层
```

第二次真实 Source Installation 里产品就是这么写的。契约说"产品不得依赖托管区"，
但工具链没给合规的路 —— 那就不是产品的错。

→ 三条缝补全：

| 资产 | CSS 缝 | TS 缝 |
|---|---|---|
| style pack | `style-<id>.css` | `style-<id>.ts` + `style-pack.ts`（稳定别名） |
| component | （组件自己 import） | `<id>.tsx` |
| effect | `effect-<id>.css` | `effect-<id>.ts` |

产品现在可以只写：

```ts
import { stylePackMotion, stylePackMotionVars, stylePackMeta } from "@/lib/kits/adapters/style-pack";
import { effectClass, effectVars } from "@/lib/kits/adapters/effect-ambient-glow";
```

`motionToCssVars` 由 TS 缝从**正式安装的契约层**调用，不是手抄的映射表。
`style-pack.ts` 是稳定别名（`export * from "./style-cinematic"`），
因此换 pack 时产品代码引用面不动。

effect 的 TS 缝导出的是**标识符**（类名 + 公开变量名）—— 效果是纯 CSS，
托管区里没有可 import 的模块，但产品不该在 JSX 里硬编码
`"kits-effect-ambient-glow"` 这样的实现细节。

缝仍然遵守"**已存在则保留**"：Kits 永不覆盖产品文件。代价是模板升级不会
自动流到已存在的适配层 —— 这件事由 `kits doctor` 的 `adapters-template`
检查报出来（lock 里记录了生成时的模板版本），并告诉产品"删掉该文件再跑
`kits add`"，而不是替它覆盖。

### 修复 · K-05 Effect 没有公开变量

`ambient-glow` 的三个光源色是硬编码 RGB。v0.1.0 的理由是"光属于 cinematic 的
物理设定，不该被换色"—— 深色单模式下成立，但真实消费立刻证明它不够：
浅色主题需要完全不同的光。硬编码的结果是产品只能自己发明
`--finance-ambient-*` 并**把整个渐变抄一遍**。

→ 收敛为 13 个 `--kits-effect-ambient-*` 公开变量（三个光的颜色 / 位置 / 尺寸 /
衰减 + 整体强度）。默认值与 v0.1.0 **逐字等价**（`tests/effects.spec.ts` 核对
清单里的默认值与 CSS 字面量一致）。

两个设计决定：

- **默认值声明在 `:root`，不是效果自己的类上**。元素自身的声明会压过继承 ——
  声明在类上，产品在 `body` / `[data-theme]` 上的覆盖将永远不生效。
- **不加 `--kits-effect-ambient-blur`**。本效果没有模糊，柔度由 `*-falloff`
  控制；补一个 `filter: blur()` 会给每个使用者的 `::before` 多加一个合成层，
  而没人需要 —— 那是新增能力，不是补契约。

呼吸的振幅改成**相对**的（`calc(var(--…-strength) * 0.85)`），否则产品把强度
调低之后，动画会把光"提"回原强度。

### 新增 · §7 引用边界检查（doctor 报 fail）

正式确立：**产品代码 SHOULD NOT import `lib/kits/installed/*`**，
只有 installer / doctor / 内部工具可以。

`kits doctor` 新增 `boundary` 检查，扫描产品源码（.ts/.tsx/.js/.jsx/.mjs/.css）：

- 不扫描托管区、CLI 副本与 `adapters/`（从适配层指向 installed/ 正是设计）
- 识别三种越界：相对路径、`@/` 别名、残留的 `@kits/*` 裸说明符
- 报 **fail** 而不是 warn —— 它破坏的是"升级 Kits 不动产品代码"这个承诺本身

### 修复 · K-06 `kits add` 只有在一种组合下能跑通（本次期间发现）

**这个缺陷不在最初的五个之列**，但它在 v0.1.0 上是致命的，只是没人试过
"cinematic + 三个组件 + 一个效果"之外的组合：

```
kits add --style editorial           → ✗ contracts/README.md 引用了 @kits/style-cinematic
kits add --style cinematic           → ✗ .kits/README.md 引用了 @kits/react-utils
（不带 --components 时）
```

两个独立原因叠在一起：

1. 安装器扫描**所有**被安装的文件，包括 `README.md`，而 README 里到处是
   代码示例（`import … from "@kits/style-cinematic"`）；
2. 扫描是纯正则、**不看注释** —— 修好第 1 条之后，`installer.mjs` 自己的注释
   又把安装弄挂了一次。

→ 文档文件不参与依赖解析（照常安装进产品）；扫描前先剥注释，
且**行注释必须先剥**：反过来时，行注释里的 `/*` 会开启一个区间，
把夹在中间的真实 import 一起吃掉，那些说明符就不会被重写。

### 新增 · 验收装置

- `tests/insight-reveal-a11y.spec.ts`（13）—— K-01 的无障碍回归
- `tests/pointer-fallback.spec.ts`（17）—— K-02 的级联契约 + "组件不得重算变量"
- `tests/doctor-standalone.spec.ts`（25）—— K-03 的状态词汇 + §7 的边界检查
- `tests/adapter-seam.spec.ts`（21）—— K-04 的缝生成、所有权、生成物语法合法性
- `tests/effects.spec.ts`（16）—— K-05 的 Effect Contract
- `tests/specifier-scan.spec.ts`（18）—— K-06 的说明符扫描
- Playground 新增 `/effects` 页：同一份调用、三种覆盖（默认 / 浅色 / 品牌）
- `.qa/kits-shots.mjs` 新增四组探针（无障碍树 / coarse pointer / effect 覆盖 /
  第三条移动端判据），路由从 3 个增加到 4 个
- `fixtures/standalone-product` 改用新的 TS 缝，并演示只覆盖公开变量的浅色主题

### 测试

| | v0.1.0 | v0.1.1 |
|---|---|---|
| 断言总数 | 274 | **384** |
| spec 文件 | 7 | 13 |

**原 274 条全部保留。** 其中 1 条被改写（它断言的是 K-01 的 bug 本身），
改写后的断言方向相反且更强。

### 兼容性

- 资产 id / 组件 API（`apiVersion 1.0.0`）/ Visual Manifest / `data-kits-pack`
  选择器全部不变
- `contractVersion` 仍是 `1.0.0`：契约是**追加**变量，没有改语义
- lock 的 `schemaVersion` 仍是 1（新增 `compat` / `adapters` 两个字段）
- 默认视觉与 v0.1.0 逐字等价（K-05 的 13 个变量默认值、K-02 的因子默认 1）
- **升级方式：重新 `kits add`**，不要手工改 `lib/kits/installed/` 下的文件
  （那是托管区，手工修改会被 `doctor` 判为篡改）

### 已知限制

- `kits upgrade` 仍然没有；本版只有 `doctor` / `diff` 报告 + 重新 `add`
- 适配层模板升级不会自动流到已存在的产品文件（刻意的所有权设计），
  只由 `doctor` 的 `adapters-template` 提示
- K-05 只覆盖 `ambient-glow`。`scanline-sweep` 的扫描线颜色同样是硬编码字面量
  （同一类缺陷），但没有真实消费撞上它，本次**刻意不改** —— patch 不该顺手扩面

---

## v0.1 · Integration Hardening（未发布，feature/kits-v0.1）

第一次真实产品集成（`prototype-ai-finance` × cinematic Style Migration）
暴露了五个 Contract / Distribution 缺口。本次把它们**修回 Kits**，
并建立正式的 Source Installation 机制。

本版**不改任何视觉**：没有新 Style Pack、没有新组件、没有改设计。
只解决 Integration / Distribution / Contract。

### 修复 · 五个真实缺口

**1. Package boundary 不闭合（`file:` 安装必败）**
组件靠 `../_shared/*` 向上跨包引用契约与 hook，style pack 靠 `../_contract/*`。
任何真正的安装机制只搬运包目录本身，因此这些引用必然断掉。
→ 抽出两个真正的包，契约与共享运行时各有自己的 `package.json` 与 `exports`：
`packages/contracts`（`@kits/contracts`）、`packages/react-utils`（`@kits/react-utils`）。
现在每个可安装资产都是 self-contained，由 `tests/package-boundary.spec.ts`
的 51 个断言守着。

**2. `motionToCssVars()` 对消费方不可达**
它存在，但不在任何包的 `exports` 里；契约类型也没被 re-export。
结果是产品把 13 行变量表**手抄**了一遍 —— 一次静默的脱钩。
更糟的是同一份 Style Pack Contract 在仓库里有两个副本（`_contract/` 与
`_shared/` 的后半段），会各自漂移。
→ 契约收敛到 `@kits/contracts` 的**唯一一份**，`motionToCssVars` 成为公开 API。
`tests/public-api.spec.ts` 断言消费方需要的每个符号都能从公开入口拿到。

**3. Next.js 集成文档不完整**
真实集成证明 `transpilePackages` + `experimental.externalDir` **还不够**，
缺 `turbopack.root`（Turbopack 只解析项目根之内的文件）会直接
`Module not found`。
→ `docs/integration.md` 重写，给出 Next.js 16 + Turbopack 的完整四处配置，
并**明确区分** Delivery Mode 与 Development Mode。
`docs/distribution.md` 新增，讲机制与承诺。

**4. `@types/react` 版本漂移造成跨 repo TS2322**
产品 19.2.18 / Kits 19.3.0 → **产品的** `tsc` 在 **Kits 自己的源文件**上报
`Two different types with this name exist`。错误指向 Kits，根因在版本。
→ 依赖策略重做：组件把 react/react-dom 声明为 `peerDependencies`
（`^18 || ^19`），devDependencies 放一份自检副本；style pack 完全不碰 React
（它们一行 React 都没用，原来的 `peerDependencies: {"react": ">=18"}` 是错的）。
新增 `kits doctor` 的 `react-types-major-parity` 检查：两边 major 不一致时
**直接报错并给出修法**，而不是让产品收到一条费解的类型错误。
另外把 `insight-reveal.tsx` 的 `ref as React.Ref<never>` 保持原样 ——
它是无辜的，加断言只会掩盖版本问题。

**5. `InsightReveal step="group"` 的步进序号到不了 DOM**
旧实现用 `cloneElement` 把 `--kits-reveal-index` 写给子元素，要求消费方的
子元素把 `style` 转发到宿主元素。而产品里的子元素是自定义组件（不接收
style），于是变量被静默丢弃 —— **不报错、不警告，步进彻底失效**。
→ 序号改由**组件自己建立的宿主**承载（`<div class="kits-reveal__item">`
+ `display: contents`，对布局不可见）。消费方不需要知道这件事。
`tests/insight-reveal-group.spec.ts` 用 `renderToStaticMarkup` 做**真实渲染**
断言，并以「一个不转发 style 的自定义子组件」为对手 ——
即旧实现失败的那个场景。

### 新增 · Source Installation（正式交付机制）

不依赖兄弟目录、不需要私有 npm 认证、可追踪版本、可升级：

```bash
kits add     --target ../my-prototype --style cinematic --components …
kits list
kits doctor
kits diff
```

- `packages/cli` —— Installer，零运行时依赖（只用 `node:` 内置模块）
- 安装后的目录：`installed/`（Kits 托管）· `adapters/`（产品托管）·
  `.kits/`（Installer 自身）· `kits.lock.json`
- **依赖重写**：`@kits/*` 说明符 → 相对路径，并**剥掉 `.ts`/`.tsx` 扩展名**
  （否则产品被迫打开 `allowImportingTsExtensions`）
- **`kits.lock.json`**：逐文件 checksum + 来源 commit + 依赖图 + layout
- 九条 Installer Rules，每条都有可执行的对手（`tests/installer.spec.ts`，26 断言）：
  approved 门禁 · 依赖解析 · 兼容性门禁 · checksum · 不覆盖人工修改 ·
  dry-run · diff · **幂等（逐字节）** · **失败回滚**

### 新增 · 验收装置

- `fixtures/standalone-product` —— 一次性 fixture
- `scripts/verify-standalone.mjs` —— **把 prototype-kits 仓库改名移走**，
  然后要求 fixture 仍然 `tsc --noEmit` + `next build` 通过，
  且用产品自己的 `lib/kits/.kits/` 跑通 `doctor`。
  这条是整个 Distribution 设计的核心判据。

### 测试

| | 首次交付 | Hardening 之后 |
|---|---|---|
| 断言总数 | 164 | **274** |
| spec 文件 | 3 | 7 |

新增：`package-boundary`（51）· `installer`（26）· `public-api`（20）·
`insight-reveal-group`（13）。

### 未做（明确边界）

- **不改任何视觉**：三套 pack、五个组件、三个 effect 的取值一个都没动
- **不改任何其它仓库**：`prototype-starter` / `prototype-hub` /
  `prototype-ai-finance` 零改动
- **不做 `kits upgrade`**：本版只有 `diff` 报告 + 重新 `add`，留到 v0.2
- **不做私有 npm 发布**：本次目标明确排除

### 已知限制

- `kits diff` 需要 `--kits` 指向 Kits 仓库（它的语义就是"与上游比"）；
  `doctor` / `list` 不需要
- Installer 不自动改产品的 `tsconfig.json` / `next.config.ts` ——
  它刻意不碰产品配置，因此"装完还要做什么"由 CLI 在结尾打印出来
- `fixtures/standalone-product` 的依赖需要真实下载 Next.js

---


## v0.1.0 · feature/kits-v0.1

首次交付。目标不是"做很多炫酷组件"，而是建立**一套可复用、可审计、可替换、
不会污染 Factory Core 的视觉资产体系**。

### 新增

**Style Packs（3）**

- `editorial` —— 纸与字：大留白、强排版、少卡片、暖色纸感、极克制 motion
- `cinematic` —— 光与深度：深色、空间纵深、环境光、局部 glow、更强 interaction
- `instrument` —— 刻度与读数：工业仪表、工程感、密集数据、硬边界、小圆角

每套交付 `tokens.css` / `motion.ts` / `manifest.json` / `README.md` / `SKILL.md`，
且在**十个维度**上取值三值互不相同（由测试强制）。

**Signature Components（5）**

- `interactive-hero`（API v1.0.0，性能 B）
- `spotlight-surface`（API v1.0.0，性能 B，Adapter 模式参考实现）
- `animated-grid`（API v1.0.0，性能 B）
- `data-cursor`（API v1.0.0，性能 B）
- `insight-reveal`（API v1.0.0，性能 A）

每个交付稳定内部 API + implementation + manifest + demo + README
+ accessibility notes + mobile fallback + reduced-motion fallback
+ SSR/Next.js 兼容性说明 + 性能分级。

**Effect Packs（3）** —— `paper-grain` / `ambient-glow` / `scanline-sweep`（纯 CSS）

**Skills（2）** —— `visual-direction`（强制先产出 Visual Manifest）、
`motion-direction`（动效只服务四类角色）

**契约层** —— `styles/_contract/`：变量词汇表 + 类型 + `assertStylePackMotion`
+ `motionToCssVars`；`registry/assets.schema.json`

**Registry** —— `registry/assets.json` 登记 13 条资产，含状态生命周期与准入门槛

**Reference Board** —— `references/{editorial,cinematic,instrument,incoming}/`，
只存设计语言分析，不存源码

**Incoming Workflow** —— 12 步准入流程 + 模板（`incoming/.template/`）

**Playground** —— 轻量 Next.js 验收台（3 路由：并排 / 组件 / 审计），不引入 Storybook

**质量门** —— 164 个契约断言（vitest）+ Browser QA（双视口、溢出、报错、降级）

### 关键设计决定

1. **颜色也放进 pack 作用域**（不是 `:root`）—— 由 Browser QA 抓到的真实缺陷驱动：
   写在 `:root` 上会导致同页多 pack 时最后导入者通吃。
2. **组件只读 `var(--kits-*)`，不知道 pack 的名字** —— 由测试强制（组件源码里
   不得出现 `"editorial"` / `"cinematic"` / `"instrument"`）。
3. **InsightReveal 默认可见** —— 隐藏规则必须带 `--animated` 前缀，
   因此 JS 失败时内容不会消失（三层降级）。
4. **instrument 不保留淡入** —— 监控面板的状态切换必须瞬时可见，
   降级策略由 pack 语义决定，不是全局统一值。
5. **源码分发，不做构建产物** —— 可审计性优先。

### 未做（明确排除）

- ❌ Style Migration（未修改任何现有项目的视觉）
- ❌ Factory Core 改动
- ❌ 第三个业务 Prototype
- ❌ 未触碰 `prototype-starter` / `prototype-hub` / `prototype-ai-finance` / AI CRM

### 已知限制

- 一个页面只应有一个 `DataCursor`（多个会争抢 `cursor: none`）。
- `SpotlightSurface` 的 `surface="glass"` 会引入 `backdrop-filter`，同屏 ≤ 2 处。
- `AnimatedGrid` 的 `mask-image` 在小概率场景下会禁用 GPU 快速路径。
- `instrument` 不适合移动端主场景（高密度在 390px 下需降密度）。
