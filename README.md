# prototype-kits

> **Prototype Factory 的可插拔视觉与能力资产库。**
>
> **Starter 负责稳定。Kits 负责变化。**

[![status](https://img.shields.io/badge/status-v0.1%20%C2%B7%20feature%2Fkits--v0.1-blue)]()
[![assets](https://img.shields.io/badge/assets-13%20registered-green)]()
[![tests](https://img.shields.io/badge/tests-164%20passing-green)]()

---

## 1. 这是什么

一个**独立仓库**，用来管理未来可复用的视觉与能力资产：

| 资产类型 | 内容 | 数量（v0.1） |
|---|---|---|
| **Style Packs** | 整套视觉语言（排版/间距/密度/圆角/边界/表面/导航/数据/动效/层级） | 3 |
| **Signature Components** | 有稳定内部 API 的签名组件 | 5 |
| **Effect Packs** | 纯 CSS 的表面与环境效果 | 3 |
| **Skills** | 给 Agent 的强制流程（Visual Direction / Motion Direction） | 2 |
| **Reference Board** | 设计参考与设计语言分析（**不存源码**） | 4 目录 |
| **Incoming** | 外部资产的准入暂存区 | 4 目录 |
| **Asset Registry** | 资产登记表（唯一权威） | 13 条 |

它**不是**：组件库、设计系统、应用框架、monorepo 里的业务包。

---

## 2. 为什么要独立出来

因为"视觉资产"和"业务代码"的变化速度不一样。

- 业务 Prototype 每天都在改需求；
- 视觉资产（一套风格、一个组件）改一次会影响所有 Prototype。

把两者放在一起，结果是**任何一个想试新风格的人都要动业务的仓库**。
拆开之后：

```
prototype-starter   稳定，很少变，所有 Prototype 的起点
prototype-kits      变化，频繁加新风格/新组件，独立版本
prototype-<业务>    快，随时可换 pack 而不动业务逻辑
prototype-hub       展示，只登记结果
```

**核心原则**：外部资产（UI 组件、动效、Shader、Dashboard、Skill、
Design System、Landing Page、React Component）**都不能直接塞进 Prototype 或 Factory**。
必须先进入本仓库做审计、包装、测试，通过之后才可用。

---

## 3. 目录结构

```
prototype-kits/
├── styles/                     Style Packs（每套一个包）
│   ├── _contract/              契约层：变量词汇表 + 类型 + 校验
│   ├── editorial/              纸与字
│   ├── cinematic/              光与深度
│   └── instrument/             刻度与读数
├── components/                 Signature Components（每个一个包）
│   ├── _shared/                契约类型 + 环境探测 + 指针/视差/揭示 hook
│   ├── interactive-hero/
│   ├── spotlight-surface/
│   ├── animated-grid/
│   ├── data-cursor/
│   └── insight-reveal/
├── effects/                    Effect Packs（纯 CSS）
├── skills/                     Agent 技能
│   ├── visual-direction/       → 写 UI 前必须产出 Visual Manifest
│   └── motion-direction/       → 动效只服务四类角色
├── references/                 Reference Board（只存分析，不存源码）
│   ├── editorial/  cinematic/  instrument/  incoming/
├── incoming/                   外部资产准入暂存区
│   ├── components/  styles/  effects/  skills/
├── registry/                   Asset Registry
│   ├── assets.json             登记表（唯一权威）
│   ├── assets.schema.json      结构契约
│   └── README.md               状态语义与准入门槛
├── playground/                 轻量 Next.js 验收台（不是业务产品）
├── docs/                       集成 / 架构 / FAQ
├── tests/                      契约审计（164 个断言）
└── .qa/                        Browser QA（截图 + 溢出 + 报错）
```

---

## 4. 三套 Style Pack

| | **editorial** | **cinematic** | **instrument** |
|---|---|---|---|
| 一句话 | 纸与字 | 光与深度 | 刻度与读数 |
| 第一视觉 | 巨大衬线标题 + 一条 1px 横线 | 深色空间里从左上打下来的环境光 | 一屏被 1px 实线切开的等宽面板 |
| 排版 | 衬线 4.5rem / 行高 **1.02** / 字距 **−0.022em** | 无衬线 500 / 1.08 / 字距 **+0.005em** | 全站等宽 / 1.12 / 字距 **+0.02em** |
| 间距节奏 | 脉搏 4px，段落 **96px** | 脉搏 8px，段落 **96px**（层级内 8px） | 脉搏 4px，段落 **32px** |
| 密度 | 控件 40px / 行 52px | 控件 36px / 行 44px | 控件 **28px** / 行 **32px** |
| 圆角 | **0**（印刷直角） | **14px**（材质连续） | **2px**（机械公差） |
| 边界 | 只用 1px 横线（opacity 0.14） | **无边框**，靠亮度差 | **处处 1px 实线** |
| 表面 | 纸纹 0.035 + 零投影 | 玻璃 + 三层环境光 + 深投影 | 平面面板 + 极淡扫描线 |
| 导航 | 书眉行（不吸附） | 浮起玻璃（overlay） | 机架轨道（左侧 2px 条） |
| 数据 | 衬线大字号 tabular | 发光曲线 + 端点光点 | 等宽读数 + 刻度网格 |
| 动效 | restrained · 80–480ms · 位移 10px | atmospheric · 120–720ms · 24px + 6px 模糊 | precise · **50–220ms** · 位移 4px |
| 指针视差 | 0.15（几乎不动） | **1.0**（完整跟随） | 0.4 |
| ambient 角色 | ✗ 不授予 | ✓ 9s | ✗ **不授予**（仪表不呼吸） |

> **判定标准**：把三列都转成**灰度**之后，差异是否依然一眼可见？
> 是 —— 因为差异在排版、间距、圆角、边界与层级手段上，不在调色板上。
> 这一条由 `tests/contracts.spec.ts` 强制执行（十个维度三值互不相同）。

---

## 5. 契约（为什么换 pack 不用改组件）

### 5.1 Style Pack Contract

每个 pack 必须交付五件套：

```
styles/<id>/
├── tokens.css      契约变量的取值 + scoped 排版规则
├── motion.ts       动效契约（通过 assertStylePackMotion 校验）
├── manifest.json   推荐场景 / 反模式 / 性能 / 无障碍
├── README.md       设计与使用
└── SKILL.md        给 Agent 的硬约束
```

关键设计：**组件只读 `var(--kits-*)`，pack 只在 `[data-kits-pack]` 作用域内提供取值。**

```css
/* 组件里（永远不会变） */
.kits-hero [data-kits-depth] {
  transform: translate3d(calc(var(--kits-layer-dx, 0) * 1px * var(--kits-pointer-factor)), …);
}
```

```css
/* pack 里（换 pack 就换这一段） */
[data-kits-pack="cinematic"] { --kits-pointer-factor: 1; }
[data-kits-pack="editorial"] { --kits-pointer-factor: 0.15; }
```

→ **同一份组件代码，在 cinematic 下完整跟随指针，在 editorial 下几乎不动。**
零条件判断，零 pack 名字出现在组件里（由测试保证）。

### 5.2 Signature Component Contract

```
外部资产 → inspect → license/source check → dependency audit
        → compatibility audit → normalize → ADAPTER
        → fallback → demo → test → experimental → approved
                                    ↑
                        产品只允许调用这一层之后的 API
```

```tsx
// ❌ 产品直接依赖第三方 API —— 第三方改一个 prop 就要全站重构
<FancyGlowCard glowColor="#4fd6ff" blurRadius={24} opacity={0.6} />

// ✅ 产品只表达产品语义
<SpotlightSurface tone="brand" intensity="medium" />
```

每个组件交付：稳定 API + implementation + manifest + demo + README
+ accessibility notes + mobile fallback + reduced-motion fallback
+ SSR 说明 + 性能分级。全部由测试校验存在性。

---

## 6. 五个 Signature Component

| 组件 | 一句话 | 性能 | 产品可见的 API |
|---|---|---|---|
| `interactive-hero` | 首屏第一视觉（结构 + 视差节奏） | B | `title` / `lead` / `eyebrow` / `actions` / `media` / `depth` |
| `spotlight-surface` | 指针响应的表面（Adapter 参考实现） | B | `tone` / `intensity` / `surface` |
| `animated-grid` | 结构性背景网格（纯装饰） | B | `cell` / `fade` / `motion` |
| `data-cursor` | 指针即探针，悬停读数值 | B | `mode` / `inspection` / `data-cursor` DOM 契约 |
| `insight-reveal` | 按阅读顺序逐段揭示 | A | `step` / `shift` / `blur` / `once` |

全部内建：`prefers-reduced-motion` 降级、触屏降级、SSR 安全、零第三方运行时。

**三条被测试强制的铁律**：

1. 组件实现里不出现任何 hex 颜色，也不出现 pack 的名字；
2. 每个组件必须显式列出「明确不暴露」的视觉 prop；
3. 装饰层必须 `aria-hidden` + `pointer-events: none`。

---

## 7. Incoming Workflow（外部资产准入）

> **任何外部资产都必须走完这条链路，才能被 Prototype 引用。**

```
1.  incoming            落到 incoming/<type>/<资产名>/（先登记，不改产品）
2.  inspect             读源码：它到底做了什么？依赖了什么？
3.  license/source check 许可证是什么？能不能用？来源可追溯吗？
4.  dependency audit    引入多少依赖？有没有原生模块 / 体积炸弹？
5.  compatibility audit SSR？多浏览器？触屏？reduced-motion？
6.  normalize           剥掉品牌视觉、剥掉不必要的依赖与 API
7.  adapter             包成内部稳定 API（产品只见我们的 prop）
8.  fallback            补 mobile + reduced-motion + no-JS 降级
9.  demo                在三种 Style Pack 下都能渲染
10. test                契约测试（API 稳定性、降级存在性、无视觉字面量）
11. experimental        登记为 experimental，可在实验性 Prototype 中使用
12. approved            登记为 approved，可进入正式 Prototype
```

### 禁止

- ❌ **外部组件直接复制进业务项目**
- ❌ 未在 `registry/assets.json` 登记的资产被引用
- ❌ 产品代码直接依赖第三方组件 API
- ❌ 在组件或产品代码里出现视觉字面量（颜色 / 尺寸 / 缓动）
- ❌ 缺少 mobile 或 reduced-motion 降级就登记为 approved

### 目录约定

```
incoming/components/<name>/
├── SOURCE.md      仓库 / commit / 作者 / 首次发现日期
├── LICENSE        许可证原文或指向
├── AUDIT.md       依赖审计、体积、兼容性、已知问题、结论
└── raw/           原始文件（**禁止被任何产品直接引用**）
```

---

## 8. 快速开始

```bash
git clone <repo> && cd prototype-kits
pnpm install
pnpm dev          # Playground → http://localhost:3200
```

### 质量门（提交前必须全绿）

```bash
pnpm lint         # ESLint（含 packages 与 playground）
pnpm typecheck    # playground tsc + kits tsc --noEmit
pnpm test         # vitest：契约审计（164 个断言）
pnpm build        # Playground 生产构建
pnpm check        # 以上四件
pnpm qa           # Browser QA：双视口截图 + 溢出/报错/降级检查
```

> `pnpm qa` 需要先起服务：`pnpm build && pnpm --filter @kits/playground start`。
> 截图落在 `.qa/out/`（已 gitignore）。

---

## 9. Playground

一个**极轻量**的 Next.js 验收台，不是业务产品，不引入 Storybook。

| 路由 | 内容 |
|---|---|
| `/` | 三套 Style Pack **并排**：同一份组件调用 × 三种 pack，逐组对比 |
| `/components` | 五个组件的 API / 降级矩阵 / 三种 pack 下的同一份调用 |
| `/audit` | 十维对照表、motion 契约对照、Asset Registry、Incoming Workflow |

外壳刻意**不使用任何 pack 变量**，`data-kits-pack` 只出现在每一列的舞台元素上 ——
这样三套风格才能在同一页里共存而不互相污染。

---

## 10. 相关文档

| 文档 | 内容 |
|---|---|
| [`docs/integration.md`](docs/integration.md) | 怎么在 Prototype 里用 Kits（含品牌色覆盖、渐进接入） |
| [`docs/architecture.md`](docs/architecture.md) | 契约分层、目录归属、与 Factory Core 的边界 |
| [`docs/faq.md`](docs/faq.md) | 常见问题（为什么不用 Tailwind / 为什么源码分发 / 为什么不做 Storybook） |
| [`docs/visual-inventory.md`](docs/visual-inventory.md) | prototype-starter 现状盘点与剥离计划（回答题面 C 问题） |
| [`registry/README.md`](registry/README.md) | 资产状态语义与准入门槛 |
| [`references/README.md`](references/README.md) | Reference Board 纪律（只提取语言，不复制布局） |

---

## 11. 版本与边界

- 本仓库是 **v0.1**：只做三套 Style Pack、五个组件、三个 effect、两个 skill。
- **不做**：Style Migration（不改任何现有项目的视觉）、Factory Core 改动、
  第三个业务 Prototype。
- **不改动**：`prototype-starter`、`prototype-hub`、`prototype-ai-finance`、AI CRM。

### 未来适合进 Factory Core 的（只登记约定，不搬代码）

pack 契约（`_contract/contract.ts` + `tokens.css` 变量词汇表）、
manifest schema、Incoming Workflow、`Visual Manifest` 的字段约定。

### 必须永远留在 Kits 的

三套具体风格、五个具体组件、effect、reference board ——
它们**变化快**，进 Core 就等于让 Core 变成设计系统。
