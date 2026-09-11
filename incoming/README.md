# Incoming · 外部资产准入暂存区

> **这里是 Kits 的门厅。外部资产必须先在这里被检查，才有资格变成资产。**
>
> 谁都可以往这里放东西。**但没有任何东西可以从这里直接被产品引用。**

---

## 目录

```
incoming/
├── components/   外部 UI 组件 / React 组件 / Dashboard 模块
├── styles/       外部 Design System / 主题 / 排版系统
├── effects/      外部动效 / Shader / 粒子 / 背景
└── skills/       外部 Skill / Agent 指令 / 工作流
```

每个条目是一个目录：

```
incoming/<type>/<资产名>/
├── SOURCE.md      来源、作者、commit、首次发现日期、初步判断
├── LICENSE        许可证原文或指向（**不允许 unknown**）
├── AUDIT.md       审计记录（依赖 / 体积 / SSR / 触屏 / reduced-motion / 结论）
└── raw/           原始文件（**禁止被任何产品直接引用**）
```

模板见 [`.template/`](./.template/)。

---

## 完整流程

```
 1. incoming             落到这里，登记进 AUDIT.md
 2. inspect              读源码：它到底做了什么？依赖了什么？
 3. license/source check 许可证是什么？能不能用？来源可追溯吗？
 4. dependency audit     引入多少依赖？有没有原生模块 / 体积炸弹？
 5. compatibility audit  SSR？多浏览器？触屏？reduced-motion？
 6. normalize            剥掉品牌视觉、剥掉多余依赖与 API
 7. adapter              包成内部稳定 API（产品只见我们的 prop）
 8. fallback             mobile + reduced-motion + no-JS 降级
 9. demo                 在三种 Style Pack 下都能渲染
10. test                 契约测试通过
11. experimental         登记为 experimental
12. approved             登记为 approved
```

**只有第 11、12 步之后，产品才可能引用它。**

---

## 每一步的判据

| 步骤 | 通过条件 | 常见否决原因 |
|---|---|---|
| 2. inspect | 能用三句话说明"它做了什么、怎么做的、依赖什么" | 读不懂 / 依赖内部私有包 |
| 3. license | 许可证明确、允许使用、来源可追溯 | 无 LICENSE / 许可证与商用冲突 / 来源不明 |
| 4. dependency | 依赖树可接受，无原生模块（除非必要） | 40+ 传递依赖 / 引入 node-gyp |
| 5. compatibility | 有 SSR 路径、有触屏降级、有 reduced-motion 处理 | 直接访问 window 于渲染期 / 无降级 |
| 6. normalize | 品牌视觉已剥离，只留结构与行为 | 视觉写死在组件里无法剥离 |
| 7. adapter | 内部 API 只表达产品语义 | 需要暴露 `color` / `size` / `duration` |
| 8. fallback | 触屏与 reduced-motion 下信息完整 | 触屏上直接隐藏内容 |
| 9. demo | 三种 pack 下都能渲染 | 只在深色下成立 |
| 10. test | 契约测试全绿 | 组件里出现 hex 或 pack 名字 |

---

## 禁止

- ❌ **外部组件直接复制进业务 Prototype**（绕过全部审计）
- ❌ 未在 `registry/assets.json` 登记的资产被引用
- ❌ 产品代码直接依赖第三方组件 API
- ❌ `LICENSE` 写 `unknown` / `to-check` / 留空
- ❌ `raw/` 里的任何文件被产品路径引用
- ❌ 缺少 mobile 或 reduced-motion 降级就登记为 approved

> 这些不是建议。`tests/registry.spec.ts` 会检查登记表与目录的一致性，
> 包括"声称不含第三方源码的资产目录里不得出现第三方痕迹目录"。

---

## 一个真实例子（演练，未实际引入）

假设看到某个 `FancyGlowCard`：

```
incoming/components/fancy-glow/
├── SOURCE.md     → 仓库 URL @ commit abc123，作者 X，2026-09-11 发现
├── LICENSE       → MIT（原文）
├── AUDIT.md      → 依赖 2 个（clsx、tiny-invariant，均可接受）
│                   体积 4.2 KB gzip
│                   无 SSR 问题，但触屏下 hover 跟随未关闭（需在 adapter 里补）
│                   缺少 reduced-motion 处理
│                   结论：可进入 normalize，需补两处降级
└── raw/          → 原始源码（只读参考）
```

→ 之后在 `components/spotlight-surface/adapters/` 写映射：

```tsx
tone       → TONE_VAR[tone]（产品不传颜色）
intensity  → INTENSITY_SCALE[intensity] → blurRadius / opacity
pointer    → Style Pack 的 --kits-pointer-factor
触屏       → 复用 useFinePointer（补上第三方缺失的降级）
```

→ 产品调用 **一行不变**：`<SpotlightSurface tone="brand" intensity="medium" />`
