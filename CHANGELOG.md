# Changelog

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
