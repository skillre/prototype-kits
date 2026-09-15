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
├── packages/                   基础设施包（都可以被独立安装）
│   ├── contracts/              契约层：变量词汇表 + 类型 + motionToCssVars + 校验
│   ├── react-utils/            组件共享运行时：能力探测 + 指针 hook + 揭示观察器
│   └── cli/                    Installer：add / list / doctor / diff
├── styles/                     Style Packs（每套一个包）
│   ├── editorial/              纸与字
│   ├── cinematic/              光与深度
│   └── instrument/             刻度与读数
├── components/                 Signature Components（每个一个包）
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
│   ├── assets.schema.json      登记表结构契约 + 全部枚举词汇表的唯一来源
│   ├── manifest.schema.json    pack / component manifest 的结构契约
│   └── README.md               状态语义 · 适配维度 · 移动端语义 · 暗色方向
├── playground/                 轻量 Next.js 验收台（不是业务产品）
├── fixtures/                   standalone-product：Distribution 的验收装置
├── scripts/                    registry-audit（门）· verify-standalone
│   └── lib/                    manifest-contract（判定唯一实现）· fit-semantics（纯语义）
├── docs/                       集成 / 分发 / 架构 / 材质归属 / FAQ
├── tests/                      契约与安装器审计（474 个用例：473 通过 / 1 skip）
└── .qa/                        Browser QA（截图 + 溢出 + 报错 + 降级）
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

## 8. 怎么交付给产品（Distribution）

> **Prototype Kits 是源码分发的设计工具箱（source-distributed design toolkit），
> 不是 runtime component package。** 完整论证见 [docs/distribution.md](docs/distribution.md)。

两条路，不要混淆：

| | **Delivery Mode**（产品交付） | **Development Mode**（Kits 开发） |
|---|---|---|
| 机制 | `kits add` 把资产复制进产品 | `link:../prototype-kits/<pkg>` |
| 产品有 `@kits/*` 依赖 | **没有** | 有 |
| 需要改 Next / tsconfig | **不需要** | 三处 + 一个 flag |
| 删掉 Kits 仓库还能 build | **能** | 不能 |

### 安装

```bash
# ① 先看计划（不写磁盘）
node packages/cli/kits.mjs add --target ../my-prototype \
  --style cinematic --components animated-grid,data-cursor,insight-reveal \
  --effects ambient-glow --dry-run

# ② 执行
node packages/cli/kits.mjs add --target ../my-prototype \
  --style cinematic --components animated-grid,data-cursor,insight-reveal \
  --effects ambient-glow

# ③ 体检（在产品里，不需要 Kits 仓库）
node ../my-prototype/lib/kits/.kits/kits.mjs doctor
```

装完之后产品长这样 —— **`package.json` 与 `next.config.ts` 一行都不用改**：

```
lib/kits/
├── installed/       Kits 托管区（只读，重新安装会整体替换）
├── adapters/        产品托管区（Kits 永不覆盖）
│   └── seam/        中性接缝（v0.2：绑定声明 + 模板 + 判定）
├── .kits/           Installer 自身
└── kits.lock.json   安装清单（逐文件 checksum + 来源 commit）
```

### 产品代码只 import adapters/

**产品代码 SHOULD NOT import `lib/kits/installed/*`。** 只有 installer / doctor /
内部工具可以。`kits doctor` 的 `boundary` 检查会扫产品源码，越界直接 **fail**——
因为那破坏的是"升级 Kits 不动产品代码"这个承诺本身。

`kits add` 为三类资产各生成一条缝（v0.1.1 起补全）：

| 资产 | CSS 缝 | TS 缝 |
|---|---|---|
| Style Pack | `style-<id>.css` | `style-<id>.ts` + `style-pack.ts`（稳定别名） |
| Signature Component | （组件自己 import） | `<id>.tsx` |
| Effect | `effect-<id>.css` | `effect-<id>.ts` |

```ts
// 兼容写法（v0.1.x 起一直合法）：直接 import 资产名适配层
import { AnimatedGrid } from "@/lib/kits/adapters/animated-grid";
import { stylePackMotionVars } from "@/lib/kits/adapters/style-pack";
import { effectClass, effectVars } from "@/lib/kits/adapters/effect-ambient-glow";

<html data-kits-pack="cinematic" style={stylePackMotionVars}>
```

> **v0.2（K4）起推荐更好的写法**：产品只 import 自己命名的角色文件
> （`adapters/pointer.tsx` → 内部指向 `adapters/data-cursor.tsx`），
> 于是"换资产不动产品代码"才真的成立。两种写法都合法；
> 区别是 Factory v1.2 的 Tier 3 会把**直连资产名**判红（那是产品代码里出现了资产身份）。

`style-pack.ts` 是**稳定名字**：它 re-export 当前 pack 的 `<id>` 版本，
所以换 pack 时产品代码的引用面不动。`motionToCssVars` 由 TS 缝从正式安装的
契约层调用 —— 产品永远不需要手抄变量映射表。

缝属于**产品**：`kits add` 只在文件不存在时生成，永不覆盖你改过的版本。
代价是模板升级不会自动流过来 —— `kits doctor` 的 `adapters-template` 检查
会告诉你模板已过期，并给出"删掉该文件再跑 `kits add`"的做法，而不是替你做主。

### 中性接缝：产品代码不出现资产 id（v0.2 · K4）

上面那批文件的名字**就是资产 id**。产品直接 import 它们，等于把「这个产品用了
哪一个 Kits 资产」写进了产品源码 —— 换资产要改所有调用点，而不是改一行。

v0.2 生成一套**骨架**，让产品可以面向稳定语义入口：

```
产品代码  →  角色文件（你写，稳定的名字）  →  资产适配文件（Kits 生成）  →  installed/
            lib/kits/adapters/pointer.tsx     lib/kits/adapters/data-cursor.tsx
```

三步（`kits add` 会在 `adapters/seam/` 下生成 README + 模板 + 状态文件）：

```jsonc
// 1. lib/kits/adapters/seam/seam.json —— 声明角色 → 资产
{ "seamVersion": "0.2.0", "bindings": { "pointer": "data-cursor" } }
```

```tsx
// 2. lib/kits/adapters/pointer.tsx —— 从 seam/_template.ts 复制，填一行
export { DataCursor as Pointer, type DataCursorProps as PointerProps } from "./data-cursor"
```

```tsx
// 3. 产品代码只 import 角色文件
import { Pointer } from "@/lib/kits/adapters/pointer"
```

换资产 = 改这两处，**产品代码不动**。

**Kits 不替你选角色。** registry / manifest 里没有 `role` / `capability` 字段
（`manifest.adapter` 是一段政策说明，不是角色名），所以 Kits 不从文件名猜
"`data-cursor` 就是 pointer"——那是产品决策。Kits 保证的是**机制可检查**：
`kits doctor` 会分别报出

| 缺口 | 判定 |
|---|---|
| 绑定指向**不在本次安装里**的资产 | **fail**（安装已无法兑现这条声明） |
| 声明了角色，但**没有角色文件** | warn（模板就是那个 TODO） |
| 有角色文件，但 **seam.json 里没有声明** | warn（下一个读者看不出它绑给谁） |
| 角色名和资产 id 同名（会和生成文件撞名） | **fail** |
| `seam.json` 语法坏了 | **fail** |

### 验收判据

```bash
node scripts/verify-standalone.mjs
```

它会把 `prototype-kits` **改名移走**，然后要求 fixture 仍然
`tsc --noEmit` + `next build` 通过。**这条不过，就不算能交付。**

---

## 9. 快速开始

```bash
git clone <repo> && cd prototype-kits
pnpm install
pnpm dev          # Playground → http://localhost:3300
```

> **端口是 3300，唯一来源是 `.qa/qa.config.mjs`。** Kits 作为 Playground 已按根控制面
> catalog 的建议从与其它原型共用的槽位让到独立槽位 3300（迁移记录见 `CHANGELOG.md`）。
> 改动端口时改 `.qa/qa.config.mjs`，并同步 `factory-policy.json` 的 `concurrency.qaPort`
> —— `pnpm factory:agents` 会核这次不一致，也会核旧端口没有残留在声明面上。

### 质量门（提交前必须全绿）

```bash
pnpm factory:agents  # 治理门禁：编排边界 / 管理块 / 锁 / registry 角色 / 端口事实 / CI 契约
pnpm lint         # ESLint（含 packages 与 playground）
pnpm typecheck    # playground tsc + kits tsc --noEmit
pnpm test         # vitest：契约 + 包边界 + 安装器 + 无障碍 + 边界（474 个用例：473 通过 / 1 skip）
pnpm build        # Playground 生产构建
pnpm check        # factory:agents + lint + typecheck + test + build
pnpm registry     # Asset Registry 门：引用 / 标签 / 移动端 / 暗色方向一致性 + 覆盖度
                  # （有 error 退出码非 0，并逐项说明这次检查了什么）
pnpm qa           # Browser QA：端口守卫 + 自管 Playground server（3300，验身份）
                  # + 双视口截图 + 溢出 / 报错 / 降级 / 无障碍探针
pnpm verify:standalone   # Distribution 验收（把 Kits 仓库移走后仍能 build）
```

> `pnpm qa` **不复用未知 server**：它自己起 Playground、先验身份（页面必须带着 Kits 自己的
> 标记）再断言，结束只杀自己启动的进程组。端口被占用时 `scripts/check-qa-port.mjs` 会
> fail loudly 并给出定位命令，不会 adopt、不会替你杀进程。

> `pnpm qa` 需要先起服务：`pnpm build && pnpm --filter @kits/playground start`。
> 截图与报告落在 `.qa/out/`（已 gitignore）。

`pnpm qa` 除了截图，还跑四组探针 —— 它们量的是**单元测试看不见**的东西：

| 探针 | 量什么 |
|---|---|
| 移动端溢出（三条判据） | `innerWidth === 设备宽度`、`scrollWidth <= 设备宽度`、`scrollTo(9999,0)` 后 `scrollX ≈ 0` |
| InsightReveal 无障碍 | **无障碍树与 DOM 逐项相等**（v0.1.0 的 `aria-hidden` 剪枝只在这里现形） |
| coarse pointer | 有效单元格真的放大 1.5 倍（cinematic 64 → 96px），且触屏下动效关闭 |
| effect 公开变量 | 在**祖先作用域**覆盖 `--kits-effect-ambient-*` 后绘制结果真的改变 |

> K-02 的第一次修复就是在这里被否掉的：CSS 改对了、单元测试全绿，
> 而 coarse pointer 探针量出来仍是 64px —— 因为组件自己在行内样式里
> 把同一个变量又算了一遍。**能算的都要算过。**

---

## 10. Playground

一个**极轻量**的 Next.js 验收台，不是业务产品，不引入 Storybook。

| 路由 | 内容 |
|---|---|
| `/` | 三套 Style Pack **并排**：同一份组件调用 × 三种 pack，逐组对比 |
| `/components` | 五个组件的 API / 降级矩阵 / 三种 pack 下的同一份调用 |
| `/effects` | Effect Contract：公开变量表 + 同一份调用的三种覆盖（默认 / 浅色 / 品牌） |
| `/audit` | 十维对照表、motion 契约对照、Asset Registry、Incoming Workflow |

外壳刻意**不使用任何 pack 变量**，`data-kits-pack` 只出现在每一列的舞台元素上 ——
这样三套风格才能在同一页里共存而不互相污染。

---

## 11. 相关文档

| 文档 | 内容 |
|---|---|
| [`docs/integration.md`](docs/integration.md) | 怎么在 Prototype 里用 Kits（Delivery vs Development 两种模式） |
| [`docs/distribution.md`](docs/distribution.md) | 分发机制、Installer Rules、kits.lock.json、为什么不是 runtime package |
| [`docs/architecture.md`](docs/architecture.md) | 契约分层、目录归属、与 Factory Core 的边界 |
| [`docs/faq.md`](docs/faq.md) | 常见问题（为什么不用 Tailwind / 为什么源码分发 / 为什么不做 Storybook） |
| [`docs/visual-inventory.md`](docs/visual-inventory.md) | prototype-starter 现状盘点与剥离计划（回答题面 C 问题） |
| [`docs/material-handoff.md`](docs/material-handoff.md) | 材质归属：Core / Style Pack / Effect Pack / Product 各管什么，Reference Sample 的 personality 谁吸收了、谁留给自己（K8） |
| [`registry/README.md`](registry/README.md) | 资产状态语义与准入门槛 |
| [`references/README.md`](references/README.md) | Reference Board 纪律（只提取语言，不复制布局） |

---

## 12. 版本与边界

- 本仓库是 **v0.1**：三套 Style Pack、五个组件、三个 effect、两个 skill，
  加上三个基础设施包（contracts / react-utils / cli）。
- **不做**：Style Migration（不改任何现有项目的视觉）、Factory Core 改动、
  第三个业务 Prototype。
- **不改动**：`prototype-starter`、`prototype-hub`、`prototype-ai-finance`、AI CRM。

### 未来适合进 Factory Core 的（只登记约定，不搬代码）

pack 契约（`packages/contracts/` —— 纯 TS、零依赖，迁移成本最低）、
manifest schema、Incoming Workflow、`Visual Manifest` 的字段约定。

### 必须永远留在 Kits 的

三套具体风格、五个具体组件、effect、reference board ——
它们**变化快**，进 Core 就等于让 Core 变成设计系统。
