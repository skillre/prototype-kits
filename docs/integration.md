# 接入指南 · 在 Prototype 里使用 Kits

> 本文回答一件事：**一个新 Prototype 怎么接上 Kits。**
>
> **先读这一句：有两条路，不要混淆。**
>
> | | 用在哪 | 机制 | 产品依赖 Kits 仓库吗 |
> |---|---|---|---|
> | **[Delivery Mode](#delivery-mode源码安装推荐)** | **产品交付** | `kits add` 把资产复制进产品 | **不依赖** |
> | **[Development Mode](#development-mode-local-link仅用于开发)** | Kits 开发 / 实验 / Style Migration 调查 | `link:../prototype-kits/<pkg>` | 强依赖 |
>
> 第一次真实产品集成（`prototype-ai-finance` · cinematic Style Migration）
> 暴露的五个缺口，**全部**来自把 Development Mode 当成交付方案。
> 它的定位见 [Development Mode](#development-mode-local-link仅用于开发) 一节。

---

## Delivery Mode：源码安装（推荐）

### 一句话

把 Kits 的 **approved 资产**安装成**产品自己拥有的一份源码**，
并把资产之间的裸包说明符重写成相对路径。装完之后 Kits 仓库可以不存在。

### 用法

```bash
# 在 Kits 仓库里
node packages/cli/kits.mjs add \
  --target ../my-prototype \
  --style cinematic \
  --components animated-grid,data-cursor,insight-reveal \
  --effects ambient-glow
```

先看一眼计划再动手：

```bash
… --dry-run     # 只打印解析结果与将写入的文件，不碰磁盘
```

### 装完之后产品长什么样

```
my-prototype/
├── package.json          ← 没有新增任何 @kits/* 依赖
├── next.config.ts        ← 没有新增任何 Kits 相关配置
└── lib/kits/
    ├── installed/        Kits 托管区（只读；重新安装会覆盖）
    │   ├── cinematic/         ← style pack + 它的 contracts 依赖
    │   ├── contracts/
    │   ├── react-utils/
    │   ├── animated-grid/
    │   ├── data-cursor/
    │   ├── insight-reveal/
    │   └── ambient-glow/
    ├── adapters/         产品托管区（Kits 永不覆盖）
    │   ├── style-cinematic.css
    │   ├── animated-grid.tsx
    │   ├── data-cursor.tsx
    │   ├── insight-reveal.tsx
    │   ├── effect-ambient-glow.css
    │   └── README.md
    ├── .kits/            Installer 自身（Kits 缺席时仍能跑 doctor）
    └── kits.lock.json    安装清单
```

**两个目录，两种所有权** —— 这条边界是契约里那句
「产品只被允许依赖内部稳定 API」的落地：

- 产品代码只 import `adapters/`
- 升级 Kits 覆盖 `installed/` 时，适配层与调用方一行不改
- `kits add` 只在适配层文件**不存在**时生成它

### 产品侧要做的三件事

**1. 引入 pack（在全局样式里）**

```css
/* app/globals.css */
@import "@/lib/kits/adapters/style-cinematic.css";
```

**2. 声明 pack 作用域**

```tsx
// app/layout.tsx
<html data-kits-pack="cinematic">
```

> 这一条**必须由产品自己写**。它表达的是产品语义（这一屏用哪套风格），
> 不是机械替换 —— 因此安装器刻意不代劳。

**3. 用组件（只 import 适配层）**

```tsx
import { AnimatedGrid } from "@/lib/kits/adapters/animated-grid";
import { DataCursor } from "@/lib/kits/adapters/data-cursor";

<DataCursor mode="ring">
  <table>…</table>
</DataCursor>
```

**4. 要不要 effect：显式决定（v0.2 · K8）**

Effect Pack 不是 pack 的附属品，也不会自动生效。装的时候就要说清楚，
用的时候要显式 import 适配层并挂 class（[`docs/material-handoff.md`](material-handoff.md)）：

```bash
kits add --style cinematic --effects ambient-glow     # 不要就整个 --effects 省略
```

```tsx
import "@/lib/kits/adapters/effect-ambient-glow.css";

<section data-kits-pack="cinematic">
  <div className="kits-effect-ambient-glow">…</div>
</section>
```

`effects: []` 是完全合法的一等用法（第三 Prototype 就是 `instrument + effects: []`）——
装 Kits **不会**替任何页面打开环境光、光晕或发光。之后去掉 `--effects` 重装即可移除，
托管区与 lock 会同步，产品自己的文件不动（`doctor` 会提示清理上一次生成的适配层文件）。

### 装完之后

```bash
node lib/kits/.kits/kits.mjs doctor    # 体检（不需要 Kits 仓库）
node lib/kits/.kits/kits.mjs diff --kits ../prototype-kits   # 与上游比差异
```

### 这个模式下**不需要**的东西

因为说明符已被重写成相对路径，产品**不需要**：

- ❌ `transpilePackages`
- ❌ `experimental.externalDir`
- ❌ `turbopack.root`
- ❌ `allowImportingTsExtensions`（安装器会把 `.ts`/`.tsx` 扩展名剥掉）
- ❌ 任何 `@kits/*` 依赖

**判据**：`node scripts/verify-standalone.mjs` 会把 Kits 仓库**改名移走**，
然后要求 fixture 仍然 typecheck + build。这条测试不过，就不算能交付。

---

## Development Mode：Local Link（仅用于开发）

### 用在哪

- 改 Kits 资产本身，希望产品立刻反映改动
- 做 Style Migration 调查 / 视觉实验
- Playground 开发

### 怎么配（Next.js 16 + Turbopack）

```jsonc
// my-prototype/package.json
"dependencies": {
  "@kits/style-cinematic": "link:../prototype-kits/styles/cinematic",
  "@kits/contracts":       "link:../prototype-kits/packages/contracts",
  "@kits/react-utils":     "link:../prototype-kits/packages/react-utils",
  "@kits/animated-grid":   "link:../prototype-kits/components/animated-grid"
}
```

```ts
// my-prototype/next.config.ts
import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ① Kits 是源码分发（.ts/.tsx/.css，无构建产物），必须转译
  transpilePackages: [
    "@kits/style-cinematic",
    "@kits/contracts",
    "@kits/react-utils",
    "@kits/animated-grid",
  ],
  // ② 允许转译项目目录之外的文件
  experimental: { externalDir: true },
  // ③ **必须**：Turbopack 只解析项目根之内的文件。
  //    Next 文档原话："To resolve files from linked dependencies outside
  //    the project root … you must configure the turbopack.root to the
  //    parent directory of both the project and the linked dependencies."
  turbopack: { root: path.resolve(__dirname, "..") },
};

export default nextConfig;
```

```jsonc
// my-prototype/tsconfig.json
{
  "compilerOptions": {
    // ④ Kits 源码内部 import 带 .ts/.tsx 扩展名
    "allowImportingTsExtensions": true
  }
}
```

**⑤ React 类型版本必须对齐**（这一条最容易漏）：

```jsonc
"devDependencies": {
  "@types/react": "19.3.0",     // 与 prototype-kits/node_modules 里的一致
  "@types/react-dom": "19.3.0"
}
```

漂移的后果见下一节。

### 为什么不能把它当交付方案

| 记录在案的失败 | 现象 | 根因 |
|---|---|---|
| `file:` 安装失败 | 构建报 `Module not found` / 找不到 `_shared` | 包 import 了包目录外的 `../_shared/*`、`../_contract/*`；`file:` 只复制包目录本身 |
| Turbopack 解析失败 | `Can't resolve '@kits/style-cinematic'` | 缺 `turbopack.root` |
| **产品的 tsc 报 Kits 的错** | `insight-reveal.tsx(92,7): TS2322` / `Two different types with this name exist` | 产品 `@types/react` 19.2.18 vs Kits 19.3.0；TS 跟随符号链接用**Kits 自己那份**类型检查 Kits 的文件 |
| 两套目录树耦合 | 换机器 / CI / Vercel 都要先有 Kits 检出 | 这是 `link:` 的定义 |

前三个缺口已在 Kits 侧修掉（包边界、`turbopack.root` 文档、
`kits doctor` 的版本一致性检查），但**第四个是 `link:` 固有的** ——
它永远需要两棵目录树同时在场。所以它只能是 Development Mode。

---

## 迁移路径：从 Local Link 到源码安装

```bash
# 1. 记住当前产品导入面（后面要改成 adapters/）
grep -rn '@kits/' src app components --include=*.ts --include=*.tsx

# 2. 安装
node ../prototype-kits/packages/cli/kits.mjs add \
  --target . --style cinematic --components …

# 3. 把 import 从 @kits/* 换成 @/lib/kits/adapters/*
#    （或者保留自己的适配层，把内部实现指过去）

# 4. 从 package.json 移除全部 @kits/* 依赖

# 5. 从 next.config.ts 移除 transpilePackages / externalDir / turbopack.root

# 6. 从 tsconfig.json 移除 allowImportingTsExtensions（如果只为了 Kits 才加的）

# 7. 复现与门禁
pnpm install && pnpm lint && pnpm typecheck && pnpm build && pnpm test

# 8. 证明它真的自足了
node ../prototype-kits/scripts/verify-standalone.mjs
```

第 8 步不是可选项 —— 前面七步都可能"看起来搬完了"，
只有把 Kits 仓库移走再 build，才能证明这一点。

---

## 一张页面里两种性格

允许，但必须分区，且每区独立声明：

```tsx
<main>
  {/* 深色叙事首屏 */}
  <section data-kits-pack="cinematic">…</section>

  {/* 浅色数据附表 */}
  <section data-kits-pack="instrument">…</section>
</main>
```

两条约束：

1. **不要嵌套** `data-kits-pack`（内层会继承并覆盖外层变量，容易出意外）。
2. 同页多 pack 是支持的（颜色都在作用域内），但需要安装两个 style pack。

---

## 品牌色覆盖

pack 提供**完整的一套取值**（含颜色），写在 `[data-kits-pack]` 作用域内。
产品要换品牌色，在自己的适配层里重新声明同名变量：

```css
/* lib/kits/adapters/style-cinematic.css */
@import "../installed/cinematic/tokens.css";

[data-kits-pack="cinematic"] {
  --kits-color-accent: oklch(0.44 0.085 196);   /* 品牌主色 */
  --kits-color-accent-ink: oklch(0.99 0 0);
  --kits-color-glow: oklch(0.44 0.085 196 / 0.5);
}
```

**允许覆盖**：颜色（accent / accent-2 / surface / ink 系列）。
**不建议覆盖**：排版、间距、密度、圆角、边界、动效 —— 那是 pack 的身份，
改掉之后就不再是这套风格了；需要不同性格请**换 pack**。

> 这条边界是刻意的：如果产品可以覆盖排版，那 pack 就退化成了"一组默认值"，
> 可替换性也就不存在了。

---

## 浅色模式

Kits 的 style pack **只提供一套原生取值**（cinematic 原生是深色）。
产品要浅色，做法是**覆盖颜色**（唯一允许的覆盖维度），
保留 pack 的排版 / 间距 / 圆角 / 边界 / 动效：

```css
/* 只覆盖颜色，不改语言 */
[data-kits-pack="cinematic"]:not(.dark) {
  --kits-color-canvas: oklch(0.949 0.006 96);
  --kits-color-surface: oklch(1 0 0);
  --kits-color-ink: oklch(0.205 0.015 250);
  --kits-color-accent: oklch(0.4 0.093 200);
  /* … */
}
```

**特异性提醒**：pack 自己的取值写在 `[data-kits-pack="…"]`（0-1-0）。
产品覆盖请用 `[data-kits-pack="…"]:not(.dark)`（0-2-0）这样的形式，
让胜负由特异性决定，而不是由"谁后被引入"决定。

---

## 渐进接入

```
第 1 步  只装一个 style pack，在一个新页面上验证链路
第 2 步  把该页里最像"视觉决策"的部分交给 pack（间距、边界、表面）
第 3 步  接入 1–2 个 Signature Component
第 4 步  在真实数据与真实边界条件下验证（空态、错误态、超长文本、390px）
第 5 步  才考虑把更多页面纳入
```

组件数量约束（来自 `skills/visual-direction/SKILL.md`）：
**首屏 ≤ 2，整页 ≤ 3。** 用了 ≥ 4 个说明在堆效果，不在做设计。

---

## 接入检查清单

- [ ] 用 `kits add` 安装，不是手工复制
- [ ] 产品 `package.json` 里**没有** `@kits/*` 依赖
- [ ] `next.config.ts` 里**没有** Kits 相关配置
- [ ] 产品代码只 import `lib/kits/adapters/`，不 import `lib/kits/installed/`
- [ ] 页面至少有一处 `data-kits-pack`
- [ ] 产品代码里没有 `#hex` / `px` 视觉字面量 / `cubic-bezier`
- [ ] 390px 视口无横向溢出
- [ ] `prefers-reduced-motion: reduce` 下信息完整
- [ ] 触屏下没有 hover-only 的信息
- [ ] `kits doctor` 全部通过
- [ ] `node scripts/verify-standalone.mjs` 通过

---

## 常见错误

| 错误 | 症状 | 修法 |
|---|---|---|
| 手工复制资产 | 说明符解析不了 / 没有 lock | 用 `kits add` |
| 产品直接 import `installed/` | 升级 Kits 时产品代码被覆盖 | 改成 import `adapters/` |
| 改了 `installed/` 里的文件 | `kits doctor` 报"被手工改过"；下次安装丢失 | 把改动移到 `adapters/` |
| 在组件里写死颜色 | 换 pack 时不变 | 改成 `var(--kits-*)` |
| 一个页面嵌套两个 pack | 内层样式诡异 | 改成并列分区 |
| 覆盖了 pack 的排版 | "换 pack 没效果" | 只覆盖颜色，或换 pack |
| 用 Local Link 交付 | 换机器就崩 | 迁移到源码安装（见上文路径） |
