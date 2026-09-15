# Prototype Kits · Asset Registry

本目录只有一件事：**登记**。

## 文件

| 文件 | 作用 |
|---|---|
| `assets.json` | 资产登记表 —— Kits 里每一个 style / component / effect / skill 都必须在这里有一条记录 |
| `assets.schema.json` | 登记表的结构契约（JSON Schema 2020-12）。**同时是全部枚举词汇表的唯一来源**（`$defs.fitTag` / `mobileCompatibility` / `darkStrategy` / `darkApproach` / `contrastTarget` / `packRole` / `mobileFallback`） |
| `manifest.schema.json` | style / component manifest 的结构契约。只声明 v0.2 **新增或收紧**的字段（适配标签、移动端降级、暗色方向、引用列表、角色表），其余既存字段由各自的契约负责 —— 重复声明就是第二份真相 |

### schema 与执行的关系（重要）

**仓库里没有通用 JSON-Schema validator，这是刻意的**：Kits CLI 零依赖，测试也不引第三方校验器。
所以 schema 不是"跑一遍就完事"的文件，它分两个角色被使用：

| 角色 | 谁 | 做什么 |
|---|---|---|
| **词汇表** | `scripts/lib/manifest-contract.mjs` | 从 schema 的 `$defs` **读枚举**（标签、取值、上下限），自己的判定里不写第二份字面量 |
| **执行** | 同一个模块 | 把 schema 声明的约束翻译成具名判定（`fit/unknown-tag`、`dark/target-too-low` …） |
| **消费者** | `pnpm registry` · `tests/manifest-contract.spec.ts` · Playground 审计页 | 全部调用同一个模块，不再各写一套规则 |
| **等价性** | `tests/manifest-contract.spec.ts` | 逐个枚举值钉住"schema 说的"与"执行做的"一致（含对比度下限 4.5 / 3） |

**schema 里写了、但没有对应判定的字段，不算契约** —— 那只是文档。这一条是本仓库
v0.1.1 的教训：`avoidFor` 在 schema 里躺了两个版本，而没有任何东西会因为它写错而变红。

## 为什么需要 Registry

因为"我们有资产库"和"我们真的在管资产"是两件事。区别在于：

- 有没有一张表，能一眼看出**哪些资产可以进产品、哪些不能**；
- 能不能在一个人试图引用未登记资产时**立刻失败**；
- 换掉一个第三方实现时，能不能查清**有多少地方依赖了它**。

`assets.json` 就是那张表。

## 必填字段

| 字段 | 说明 |
|---|---|
| `id` | kebab-case 唯一标识，与目录名一致 |
| `name` | 展示名 |
| `type` | `style` / `component` / `effect` / `skill` / `package` |
| `status` | `incoming` / `experimental` / `approved` / `deprecated` |
| `version` | 资产自身版本 |
| `path` | 源码路径（包目录，或 effect 这类共享包里的单个文件） |
| `package` | 该资产所属的包名（安装器用它做说明符解析） |
| `files` | 显式文件清单（当 `path` 是共享包目录时必需，例如三个 effect） |
| `dependencies` | 依赖的其它**资产 id**（安装器据此做拓扑解析；空数组 = 零依赖） |
| `performance` | `A` / `B` / `C` / `not-applicable` |
| `ssrCompatible` | 布尔，或说明字符串 |
| `mobileCompatible` | 布尔，或说明字符串 |
| `reducedMotion` | `supported` / `not-applicable` / `unsupported` |
| `source` | 来源、许可证、是否含第三方源码 |

### 分类型附加要求

| type | 必须额外具备 |
|---|---|
| `style` | `selector`、`cssEntry`、`contractVersion` |
| `component` | `apiVersion`、`manifest`、`demo`、`readme` |
| `effect` | `cssEntry` |
| `skill` | `entry` |
| `package` | `entry`（基础设施包：contracts / react-utils / cli） |

## 状态语义

| status | 含义 | 允许被引用吗 |
|---|---|---|
| `incoming` | 已登记但尚未审计完毕 | **禁止** |
| `experimental` | 已通过审计，可在**实验性 Prototype** 中使用 | 仅实验项目 |
| `approved` | 可以进入正式 Prototype | 允许 |
| `deprecated` | 不再推荐；不得用于新项目，存量项目应计划替换 | 仅存量 |

**approved 的门槛**（缺一不可）：

1. manifest 完整；
2. 有 demo，且 demo 在三种 Style Pack 下都能渲染；
3. 有 mobile fallback 与 reduced-motion fallback；
4. 有 SSR 兼容性说明；
5. 有性能分级与成本说明；
6. 有适配层（adapter），产品不依赖第三方 API；
7. `source` 与 `license` 可追溯。

## 自动化检查

```bash
pnpm test            # vitest：结构一致性 + 契约门禁 + 覆盖度
pnpm registry        # 审计脚本：把登记表与一致性检查打印成人类可读的清单
```

`pnpm registry` **是一个门，不是一段打印**：有 error 时退出码非 0，同时它会逐项列出
「这次检查了什么、每个检查覆盖了多少个对象」——「0 处问题」在「全部通过」和
「其实什么都没查」这两个世界里长得一样，所以必须说清楚是哪一种。

登记表层面的规则（`tests/registry.spec.ts`）：

- `assets.json` 必须能被解析，字段必须满足 `assets.schema.json` 的 `required` 与类型声明；
- 每个 `asset.path` 指向的目录/文件必须真实存在；
- `manifest` 指向的文件必须存在且能被解析；
- style 资产必须覆盖 `editorial` / `cinematic` / `instrument` 三个 id；
- component 资产必须覆盖五个 Signature Component 的 id；
- `status=approved` 的资产不得出现 `reducedMotion: "unsupported"`；
- 声明 `containsThirdPartyCode: false` 的资产目录里不得出现第三方源码痕迹
  （检查是否存在 `LICENSE-*` / `vendor/` / `raw/` 等目录）。

跨字段一致性规则（`tests/manifest-contract.spec.ts`，判定实现见
`scripts/lib/manifest-contract.mjs`）：

| 判定 | 什么时候红 |
|---|---|
| `manifest/missing-file` | registry 指向的清单读不到 |
| `ref/missing` · `ref/wrong-type` · `ref/duplicate` | 引用未登记资产 / 引用类型与字段语义不符 / 同一字段重复 |
| `ref/registry-manifest-drift` | registry 与 manifest 的 `signatureComponents` 不一致 |
| `usedby/unknown-role` · `usedby/unknown-pack` · `usedby/pack-does-not-list` · `usedby/role-mismatch` · `usedby/missing-pack` | 组件自报的角色词不在枚举里 / pack 不存在 / 说了角色但 pack 没列 / 两边角色不同 / pack 列了但组件没写 |
| `fit/unknown-tag` · `fit/not-array` · `fit/conflict` · `fit/registry-manifest-drift` | 标签不在枚举（且非 `x-` 扩展）/ 不是数组 / 同一维度既推荐又回避 / 两侧标签不一致 |
| `fit/notes-missing`（warn） | 有标签但人读散文丢失 |
| `mobile/unknown-value` · `mobile/registry-manifest-drift` · `mobile/fallback-missing` · `mobile/fallback-lossy` · `mobile/tag-conflict` · `mobile/unsupported-recommended` | 取值非法 / 两处声明不一致 / `fallback-only` 却没有降级行为 / 降级会丢内容 / `fallback-only` 却把 mobile 写进 recommendedFor / `false`（不得使用）却推荐 mobile |
| `dark/unknown-strategy` · `dark/unknown-approach` · `dark/approach-required` · `dark/target-required` · `dark/slots-required` · `dark/target-invalid` · `dark/target-too-low` · `dark/unknown-slot` · `dark/not-object` | 暗色方向不可执行（见下） |
| `dark/undeclared`（info） | 合法旧状态：没声明暗色方向 |
| `effect/not-in-aggregate` · `effect/id-mismatch` · `effect/unknown-pack` · `effect/pack-wrong-type` · `effect/required-field` · `effect/reserved-registered` | effect 与聚合清单 `effects/manifest.json` 不一致 |
| `package/name-drift` · `package/version-drift` | `package.json` 的 name / version 与 registry 不一致 |
| `coverage/styles` · `coverage/components` | approved 数量低于本仓库承诺的下限（3 套 pack / 5 个组件） |
| `material/unknown-value` · `material/unknown-key` · `material/missing-field` · `material/not-object` | 材质语言取值不在枚举 / 出现未知字段（例如偷偷塞 mobile）/ 缺必填字段 |
| `material/ambient-claim-unbacked` · `material/ambient-leak` · `material/glow-claim-conflict` · `material/glow-unused` | 环境光归属或发光预算与自己的 `tokens.css` 不一致 |
| `material/light-effect-forbidden` | 声明「没有环境光 / 禁止发光」的 pack 却把 `light` 类 effect 列进自己的 `effects[]` |
| `material/unknown-kind` · `material/effect-undeclared`（info） | effect 的 `material.kind` 不在枚举 / 未声明 |
| `material/paint-out-of-scope` | pack / effect 的样式表**在作用域之外作画**（安装即污染）—— 见 `docs/material-handoff.md` |
| `material/dark-authoring-gap`（warn） · `material/undeclared`（info） · `material/unverifiable`（warn） | 暗色由产品写但环境光写死在 pack 里 / 未声明材质语言 / 读不到 tokens.css 无法核对 |

---

## 适配维度：`recommendedFor` / `avoidFor`（v0.2 · K7）

这两个字段以前是**自由散文**（"移动端为主的产品"），typo 与真值一样通过。v0.2 起它们
是**有限枚举的标签数组**：

| 标签 | 意思 |
|---|---|
| `mobile` | 以移动 viewport 为主要使用场景 |
| `desktop` | 以大屏多列布局为主要场景 |
| `touch` | 触控是主要输入方式 |
| `pointer` | 精确指针（鼠标 / 触控板 / 手写笔）是主要输入方式 |
| `high-density` | 一屏承载大量高密度读数或字段 |
| `low-density` | 一屏只讲一件事、留白是主要手段 |
| `data-heavy` | 内容主体是数据 / 指标 / 表格 |
| `text-heavy` | 内容主体是长文本 / 阅读 |
| `motion-sensitive` | 场景对动效敏感（合规、审阅、长时间注视） |
| `accessibility-critical` | 无障碍是硬性要求（政务、医疗、金融合规） |

- **扩展**只有一条合法路径：`x-` 前缀（`x-internal-console`），必须小写 kebab。
  自由字符串一律 `fit/unknown-tag`；
- **同一个标签不能同时出现在两个列表里**（`fit/conflict`）——
  「推荐」与「回避」同一件事没有可操作意义；
- 标签是**机器可读投影**；人读的原话逐条保留在同名 manifest 的
  `recommendedForNotes` / `avoidForNotes` 里（条数不必与标签数相同）；
- **registry 与 manifest 两处都有标签，且必须逐字相等**（`fit/registry-manifest-drift`）。
  registry 是索引（CLI / Playground 直接读它），manifest 是上下文（人在这里读理由）。

---

## 材质语言：`materialDirection`（v0.2 · K8）

Style Pack 用三个字段说明自己的**材质语言**（可选；不声明 = 合法旧状态）：

| 字段 | 取值 | 可否核对 |
|---|---|---|
| `hierarchy` | `light` / `rule` / `space` / `texture` | 声明（给人与 agent 读） |
| `ambient` | `pack-authored` / `effect-only` / `none` | **可以** —— 与 `tokens.css` 里有没有 `.kits-ambient` 核对 |
| `glow` | `budgeted` / `forbidden` | **可以** —— 与 `--kits-color-glow` 是不是 `transparent` 核对 |

Effect Pack 在自己的聚合清单节点上声明 `material.kind`（`light` / `texture` / `line`），
用于与 pack 的材质预算交叉核对。归谁、为什么、怎么消费见
[`docs/material-handoff.md`](../docs/material-handoff.md)。

**它不会自动生效**：材质元数据只用于 agent 理解、推荐、交叉核对与文档 ——
用哪个 effect、挂在哪里，仍然由 Human Art Direction + Visual Manifest 决定。

---

## 移动端语义：`mobileCompatible`（v0.2 · K2）

**兼容 ≠ 推荐。** 这两个维度分开之后，取值与派生状态是：

| 取值 | 意思 |
|---|---|
| `true` | 在它自己声明的支持条件下**允许**在移动 viewport 使用，不会因 API / 布局假设而天然失效。**不表示** recommended for mobile、ideal for high density 或 no adaptation needed |
| `false` | 不得在移动 viewport 使用 |
| `"fallback-only"` | 只能在声明的 `mobileFallback` 行为下使用（能力本身在触屏上不激活，但零内容损失） |
| `"not-applicable"` | 非视觉资产（skill / package） |

推荐与否由 `recommendedFor` / `avoidFor` 决定，于是审计输出的是**状态词**：

| 派生状态 | 条件 | 当前例子 |
|---|---|---|
| `recommended` | `true` 且 `recommendedFor` 含 `mobile` | （暂无） |
| `discouraged` | `true` 但 `avoidFor` 含 `mobile` | `instrument`（高密度在 390px 下不再可读） |
| `compatible` | `true`，两边都没说 | 其余 pack 与组件 |
| `fallback-only` | 取值即 `"fallback-only"` | `data-cursor`（触屏上组件完全不激活） |
| `unsupported` | `false` | （暂无） |
| `not-applicable` | 非视觉资产 | 两个 skill、`cli` |

`mobileFallback` 是 `fallback-only` 的**执行条件**：`trigger` / `behavior[]` / `noContentLoss: true`
三者缺一不可（`mobile/fallback-missing`、`mobile/fallback-lossy`）。

---

## 暗色方向：`darkDirection`（v0.2 · K1）

v0.1.1 的产品只知道"颜色可以覆盖"，不知道往哪个方向覆盖、底线在哪里。`darkDirection`
把这件事变成可执行的声明，并且**它是可选的** —— 不声明是合法的旧状态（audit 报 info，
而不是静默当作"没有暗色问题"）。

```jsonc
"darkDirection": {
  "strategy": "product-authored",        // single-theme | pack-authored | product-authored
  "approach": "preserve-hue",            // product-authored 必填：preserve-hue | invert-contrast
  "contrastTarget": {                    // product-authored 必填
    "standard": "WCAG-AA",               // WCAG-AA | WCAG-AAA
    "normalText": 4.5,                   // ≥ 4.5，低于它一律非法
    "largeText": 3                       // ≥ 3
  },
  "slots": ["--kits-color-canvas"],      // product-authored 必填：必须是该 pack tokens.css 里真实声明的变量
  "notes": "为什么是这个方向"
}
```

- `single-theme`：pack 原生就是单一主题（例如原生深色），暗色等于默认值，不需要第二套；
- `pack-authored`：pack 自带暗色取值；
- `product-authored`：pack 不带，产品按 `approach` + `contrastTarget` 自己写覆盖 ——
  这是被契约明确允许的（颜色是唯一允许覆盖的维度）。

`slots` 会与 `tokens.css` **逐个变量核对**：写错一个字母就是 `dark/unknown-slot`。
"允许覆盖"这句话因此是可检查的，而不是一句邀请。


---

## `package` 类型：基础设施包

`style` / `component` / `effect` / `skill` 是**人看的资产**；
`package` 是**基础设施包**：

| id | 包名 | 为什么必须在 registry 里 |
|---|---|---|
| `contracts` | `@kits/contracts` | 契约的唯一一份定义。它曾经分散在两处并互相复制，`motionToCssVars` 还对消费方不可达 |
| `react-utils` | `@kits/react-utils` | 组件曾靠 `../_shared/*` 向上跨包引用 —— 这正是 `file:` 安装失败的原因 |
| `cli` | `@kits/cli` | Installer 自身；装进产品的 `lib/kits/.kits/`，让产品在 Kits 缺席时仍能 `doctor` |

它们不是"视觉决策"，所以不参与 Style Pack 的十维度比较，
但它们**同样走 registry 与状态门禁** ——
因为「哪些文件被装进产品」这件事必须永远可审计。
`kits add` 会把它们作为依赖自动装上，不需要手动指定。

---

## 安装器如何使用这张表

`registry/assets.json` 是安装器的**唯一输入**。一次 `kits add` 的信息流：

```
assets.json
   ↓ ①必须 status=approved（门禁在读取层，所有命令共用）
   ↓ ②按 dependencies 做拓扑解析（带环检测）
   ↓ ③读每个资产的 path / files，得到文件清单
   ↓ ④读它们的 package.json，得到 exports 映射
   ↓ ⑤解析文件里的 @kits/* 说明符，重写成相对路径
产品 lib/kits/installed/ + kits.lock.json
```

因此改这张表的 `dependencies`、加一个 `package` 条目、
或者把某个资产标成 `experimental`，都会**立刻**改变安装行为。
没有第二条路可以让一个资产进产品。
