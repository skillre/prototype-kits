# 架构 · 契约分层与边界

> 本文回答：**为什么这样分层，以及什么该留在 Kits、什么该进 Core。**

---

## 1. 四层结构

```
┌───────────────────────────────────────────────────────────────┐
│  4. Product（业务 Prototype）                                  │
│     只写 data-kits-pack + 组件调用；零视觉字面量                 │
├───────────────────────────────────────────────────────────────┤
│  3. Signature Components / Effects                            │
│     行为 + 结构 + 降级；只读 var(--kits-*)，不知道 pack 的名字    │
├───────────────────────────────────────────────────────────────┤
│  2. Style Packs                                               │
│     在 [data-kits-pack] 作用域内提供契约变量的全部取值           │
├───────────────────────────────────────────────────────────────┤
│  1. Contract                                                  │
│     变量词汇表 + 类型 + 运行时校验 + manifest schema            │
└───────────────────────────────────────────────────────────────┘
```

**依赖方向永远向下**：第 4 层可以引用第 3 层与第 2 层；
第 3 层只引用第 1 层；第 2 层只引用第 1 层。
**第 3 层与第 2 层之间没有任何依赖** —— 这正是"可插拔"的技术定义。

```
      Contract
       ↑    ↑
       │    └────────────┐
   Components           Style Packs
       ↑                    ↑
       └────────┬───────────┘
             Product
```

组件与 pack 互相不认识，唯一的中介是 `var(--kits-*)`。
于是：

- 加一套新 pack：不动任何组件；
- 换一个组件实现：不动任何 pack；
- 换产品的视觉风格：只改 `data-kits-pack` 的值。

---

## 2. 为什么契约要单独成层

因为**契约是唯一需要"冻结"的东西**。

- 具体风格会变（今天三套，明天可能五套）；
- 具体组件会换（可能引入第三方实现）；
- 但变量名与语义必须稳定 —— 否则每一层都要跟着改。

契约层包含三件事，它们必须一起演进：

| 文件 | 内容 | 演进节奏 |
|---|---|---|
| `packages/contracts/tokens.css` | 变量词汇表 + 中立兜底值 + reduced-motion/触屏全局降级 | **最慢**（破坏性变更需升 major） |
| `packages/contracts/contract.ts` | 十个维度的枚举、`StylePackProfile`、`StylePackMotion`、`assertStylePackMotion`、`motionToCssVars` —— 契约**只有这一份**，且是公开 API | 慢 |
| `registry/assets.schema.json` | 资产登记表的结构契约，**同时是全部枚举词汇表的唯一来源** | 慢 |
| `registry/manifest.schema.json` | style / component manifest 的结构契约（v0.2 起只覆盖新增/收紧的字段） | 慢 |
| `scripts/lib/manifest-contract.mjs` | 把上面两份 schema 的声明翻译成**具名判定**；`pnpm registry`、Kits 测试、Playground 审计页共用它 | 中 |
| `scripts/lib/material-scope.mjs` | 材质边界扫描：pack / effect 的样式表**只能在属于自己的选择器里作画**（K8 的「安装不会自动污染页面」判据） | 中 |

---

## 3. 组件与 pack 的解耦机制

### 3.1 一切通过 CSS 变量

```tsx
// 组件：我只知道"有一个因子叫 pointer-factor"
<p style={{ "--kits-layer-dx": `${dx}px` }} />
```

```css
/* 组件样式：乘以 pack 给的因子。组件不知道 1.0 还是 0.15 */
transform: translate3d(calc(var(--kits-layer-dx, 0) * 1px * var(--kits-pointer-factor)), …);
```

```css
/* pack：这才是我说话的地方 */
[data-kits-pack="cinematic"] { --kits-pointer-factor: 1; }
[data-kits-pack="editorial"] { --kits-pointer-factor: 0.15; }
```

### 3.2 强度与语调是"语义刻度"，不是数值

```tsx
<SpotlightSurface tone="brand" intensity="medium" />
```

- `intensity` 映射到乘数（`medium = 1`），**绝对像素在 pack 里**；
- `tone` 映射到颜色槽位名（`brand → --kits-color-accent`），**具体颜色在 pack 里**。

这样"更强一点"永远由 pack 解释，产品不参与视觉决策。

### 3.3 测试把解耦变成可执行约束

`tests/ssr-fallbacks.spec.ts` 与 `tests/contracts.spec.ts` 强制：

- 组件实现里不出现 `"editorial"` / `"cinematic"` / `"instrument"` 任何字符串；
- 组件 CSS 里不出现 hex 颜色；
- 组件目录里不出现 pack 专属文件；
- 每个 pack 的十个维度取值三值互不相同（"不能只是换颜色"）。

任何人试图把 pack 逻辑写进组件，CI 立刻红。

### 3.4 schema 不会自己执行

仓库里没有通用 JSON-Schema validator（Kits CLI 零依赖，这是刻意的）。所以
`registry/*.schema.json` 不是"跑一遍就完事"的文件，它分两个角色被使用：

- **词汇表**：`scripts/lib/manifest-contract.mjs` 从 schema 的 `$defs` **读枚举**
  （适配标签、mobileCompatible 取值、暗色 strategy / approach、对比度下限、pack 角色词），
  自己的判定里不写第二份字面量 —— "schema 说合法、执行说非法"这种两套真相在结构上不可能出现；
- **等价性由测试钉住**：`tests/manifest-contract.spec.ts` 逐个枚举值与下限，断言
  "schema 声明的"与"执行做的"一致。

**schema 里写了、却没有对应判定的字段不算契约**，只是文档。v0.1.1 的 `avoidFor`
就是这么躺了两个版本 —— 自由散文、typo 与真值一样通过。v0.2（K1 / K2 / K6 / K7）
把适配标签、移动端语义、引用一致性与暗色方向全部变成具名判定，判据与词汇表见
[`registry/README.md`](../registry/README.md)。

### 3.5 材质归谁（K8）

Factory v1.2 把 personality 从 Core 移出去之后，归属由 K8 补齐：
**Style Pack 提供材质语言**（`materialDirection`：层级 / 环境光 / 发光预算）、
**Effect Pack 提供可独立启停的视觉行为**（`material.kind`：light / texture / line）、
**产品决定在哪里用**。`ambient` 与 `glow` 两个字段与 pack 自己的 `tokens.css`
逐条核对（`.kits-ambient`、`--kits-color-glow`），并与 `effects[]` 的材质类别交叉；
「装 Kits 不会自动改变页面外观」由 `scripts/lib/material-scope.mjs` 扫描证明。
完整归属表、Reference Sample 的 absorbed / product-only 分类与消费方式见
[`docs/material-handoff.md`](material-handoff.md)。

---

## 4. 与 Factory Core 的边界

Factory Core（`prototype-starter` 的骨架、交付流程、AGENTS 约束）与 Kits 的分工：

| | Factory Core | Kits |
|---|---|---|
| 职责 | **稳定**：目录结构、构建配置、质量门、交付流程、Agent 规范 | **变化**：风格、组件、效果、参考 |
| 变更频率 | 低（季度级） | 高（周级） |
| 影响面 | 所有 Prototype | 引用它的 Prototype |
| 谁说了算 | 架构决策 | 设计探索 |

### 判断某样东西该放哪

问三个问题：

1. **它会不会因为"想试另一种感觉"而变？** 会 → Kits。
2. **换成另一个值之后，业务代码需要改吗？** 需要 → 它还没被抽象到位，继续在 Kits 里打磨。
3. **所有 Prototype 都必须一样吗？** 是 → 可能是 Core。

---

## 5. 未来适合进入 Factory Core 的

**只搬"约定"，不搬"内容"**。具体候选：

| 候选 | 为什么适合 Core | 迁移方式 |
|---|---|---|
| **Style Pack Contract** | 它定义的是"什么叫一套可替换的风格"，与具体风格无关；所有 Prototype 都应遵守同一个契约 | 把 `packages/contracts/` 提为 Core 的 `contract/`，Kits 依赖它。它已经是纯 TS、零依赖，迁移成本最低 |
| **manifest schema** | 资产登记的结构是流程约定，不是设计内容 | 提为 Core 的 `schemas/` |
| **Incoming Workflow** | 准入流程属于交付流程 | 写进 Core 的 AGENTS.md / 交付清单 |
| **Visual Manifest 字段约定** | "写 UI 前先声明视觉方向"是一条流程规则 | 写进 Core 的 Agent 规范；详细方法留在 Kits 的 skill |
| **质量门脚本形态** | `lint/typecheck/test/build/qa` 五件套 + Browser QA 脚本模式 | 提为 Core 的脚本模板（含 `.qa/` 脚本骨架） |

**判据**：如果它是一句话就能说清的规则，且违反它一定出错 → Core。
如果它需要举例、需要审美判断 → Kits。

---

## 6. 必须永远留在 Kits 的

| 内容 | 为什么不能进 Core |
|---|---|
| 具体风格（editorial / cinematic / instrument / console …，且会继续变） | Core 一旦包含具体风格，就等于让架构层做设计决策；下次想要第五套风格就要动 Core |
| 五个具体组件 | 组件的 API 会演进，进 Core 会把 Core 变成组件库 |
| Effect Packs | 效果是最容易过时的一类资产 |
| Reference Board | 参考与审美判断天然随时间和项目变化 |
| SKILL.md 的具体约束清单 | 它们是"当前这套风格怎么做才对"，不是通用规则 |
| 具体颜色 / 排版 / 密度取值 | 这是设计内容 |

一句话：**Core 回答"怎么做"，Kits 回答"做成什么样"。**

---

## 7. 数据流（一次完整的资产引入）

```
incoming/components/fancy-glow/
   │
   ├─ 1. inspect：读源码，写 AUDIT.md
   ├─ 2. license check：写 LICENSE，确认可用
   ├─ 3. dependency audit：列出依赖与体积
   ├─ 4. compatibility audit：SSR？触屏？reduced-motion？
   ├─ 5. normalize：剥掉品牌视觉与多余 API
   ├─ 6. adapter：包成 <SpotlightSurface tone intensity> 形状
   ├─ 7. fallback：补 mobile + reduced-motion + no-JS
   ├─ 8. demo：三种 pack 下都能渲染
   ├─ 9. test：契约测试通过
   ├─ 10. registry：登记为 experimental
   └─ 11. approved：登记状态升级，可进入正式 Prototype
                    │
                    └──→ Product 只调用适配层之后的内部 API
```

**关键点**：第 9 步之后，产品才可以引用；第 11 步之后，才允许进入正式 Prototype。
每一步都有可能在当前阶段被否决（最常见的是 license 不清与依赖过重）。

---

## 8. 目录归属速查

| 我想加的东西 | 放哪 | 需要什么 |
|---|---|---|
| 一套全新风格 | `styles/<id>/` | 五件套 + registry 登记 + 十维互不相同 |
| 一个可复用组件 | `components/<id>/` | 六件 + adapter 说明 + 降级 + demo |
| 一个纯 CSS 效果 | `effects/` | manifest 条目 + 降级矩阵 |
| 一条 Agent 流程 | `skills/<id>/SKILL.md` | 可执行的自检清单 |
| 一个外部参考 | `references/<pack>/` 或 `references/incoming/` | 设计语言分析（不存源码） |
| 一份外部源码 | `incoming/<type>/` | 走完整 incoming 流程 |
| 一条资产记录 | `registry/assets.json` | `pnpm registry` 0 处 error（结构一致性 + 覆盖度，退出码即判据） |
