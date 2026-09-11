# Changelog

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
