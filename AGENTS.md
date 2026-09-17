# AGENTS.md · Prototype Kits（platform / registry 仓）

本文件是 `prototype-kits` 的**仓库级治理文件**。它约束 Agent 在这个仓里「怎么工作」，
以及这个仓「是什么、不是什么」。

> 机器可读的治理策略在 `factory-policy.json`，关键值钉在 `lib/factory-policy.schema.json`，
> 治理锁在 `factory.lock.json`。本文件与它们冲突时，**以机器可读文件为准**，并把本文件改回来。
> 校验器：`pnpm factory:agents`。

---

## 0 · 这个仓是什么（以及不是什么）

**Kits 是一个 platform / registry 仓。** 它提供 Prototype 可以长什么样、可以具备什么能力：
Style Packs、Signature Components、Effects、Skills 与 References，以及描述它们的 registry。

**它不是从 Factory 基线派生出来的产品。**

| | 产品仓（`prototype-*`） | **本仓（Kits）** |
|---|---|---|
| 身份 | 从 starter 基线派生的产品 | registry 的**来源** |
| 初始化边界 | 有 `init-contract.json`、`stage: product` | **没有，也不该有** |
| 消费者角色 | 通过 `kits add` **安装** Kits 到 `lib/kits/installed/` | **被安装的一方**；本仓不安装自己 |
| 治理锁 kind | `factory-baseline` / product 形态 | **`kits-registry`** |
| 交付方式 | 部署成可访问的原型 | source install 进产品仓 + registry 分发 |

> **不要把这个仓当成 product。** 治理锁里 `kind` 写的是 `kits-registry`，这是机器可读的事实，
> 不是措辞偏好。根控制面的 `contracts/factory-lock.schema.json` 已在控制仓提交 `83916bf`
> 增加对应 role branch，并用根校验器对本锁实测通过。
> **不要**为了复用 product 字段而把 `kind` 改成 `product` —— 那会让「这个仓是什么」变成一句假话，
> 而假的元数据比缺的元数据更贵。

---

<!-- BEGIN:factory-core-policy v1.3.0 -->
> 本块由 `pnpm factory:agents --print-block` 从 `factory-policy.json` 渲染，`pnpm factory:agents` 逐字校验。
> **不要手工编辑块内文字**：改 `factory-policy.json`（其关键值由 `lib/factory-policy.schema.json` 钉住），再同步本块。块外仍是人类写的文档。

## Factory Core Policy v1.3.0（Agent 编排与并发 · Kits registry 仓）

- **Agent 编排边界（是边界，不是禁令）**：**允许并要求**在 **DSH 宿主**内用多 **Subagent** 拆分与并行任务；
  **禁止**在**交付面代码**里引入编排框架或编排运行时。
  - 允许：在 DSH 宿主内拆分/并行只读或彼此独立的任务（含本仓的 registry 审计、打包面核对、跨 pack 一致性检查）；宿主的 Subagent 调用不属于被交付的资产代码。
  - 禁止：本仓的对外交付面与运行时依赖（packages/、components/、effects/、playground/、styles/、scripts/、registry/ 产物）里出现 agent framework / orchestrator runtime / 多 agent 调度依赖。Kits 会被产品以 source install 方式装进对方仓库，一旦这些目录依赖编排运行时，污染会顺着安装边界扩散到产品。
  - 判据：`packages` `components` `effects` `styles` `playground` 不得 import 编排 SDK；`package.json` 的运行时依赖不得出现编排框架。宿主侧的 Subagent 调用不是被交付的代码，不受此限。
- **模型路由**：provider `commandcode` / model `deepseek/deepseek-v4.1-flash` / reasoning effort `max`（2026-09-17 与 DSH 模型目录核对）。每次 Subagent 调用都必须把三个字段显式写全，不许依赖宿主默认值——默认值会漂移，而漂移不留痕迹。改路由先改 `factory-policy.json`。
- **单 worktree 单写者**（`single-writer`）：同一棵工作副本同一时间只有一个写者；要并行写就各自独立 worktree。两个写者共享一棵树，冲突不是概率问题，是时间问题。
- **共享路径单 owner**（`single-owner`）：`AGENTS.md`、`package.json`、`factory-policy.json`、`factory.lock.json`、`registry/assets.json`、契约 schema 与门禁脚本这类共享面，同一时间只有一个 owner，其余 agent 只读。
- **test / qa 串行**（`serial`）：`pnpm test` 与 `pnpm qa` **永不并发**（Next 16 的 dev server 按项目加锁，并行只会在错误的 server 上出结果）。CI 里同样不得拆成两个并行 job。
- **QA 端口 3300（独占资源）**：`.qa/qa.config.mjs` 是端口的唯一来源，playground 的 dev/start 与所有 QA 脚本都从它取值。原 3200 与 starter / sth 三仓共用，已按根控制面 catalog 的建议让到 3300。**QA 绝不复用未知 server**：server 必须由当前 run 自己启动，端口被占用时 fail loudly，不 adopt、不猜、不 pkill。
- **registry 唯一权威**（`single-source`）：资产的存在性、状态与适用范围一律以 `registry/assets.json` 为准；README、文档、Playground 只是它的视图，视图可以过期，权威不能有第二份。
- **source install 是一等交付**（`supported`）：产品在**自己的仓库**里安装 Kits，并且必须在 prototype-kits 仓库不存在时仍可 build——`pnpm verify:standalone` 是这条的唯一证据，没跑就不能说它成立。
- **本仓是 registry 来源，不是消费者**：`lib/kits/installed` 属于产品，不属于本仓；本仓出现它就是角色错位，Gate 直接失败。
- **HVA（人工视觉验收）**：`required-before-release` —— 没有 HVA 就没有发布；Agent 不能替人验收，未完成时状态只能是 `READY FOR HUMAN VISUAL ACCEPTANCE`。
- **部署授权**：`explicit-user-authorization` —— 源码发布 ≠ Production 部署。CI 只做质量门，不调用 Vercel CLI、不持有 token、不部署；没有用户明确授权，不创建/提升 Production 部署、不改 Deployment Protection、不 push Production Branch。

机器可读副本：`factory-policy.json` · 关键值：`lib/factory-policy.schema.json` · 治理锁：`factory.lock.json` · 校验器：`scripts/guard-agent-policy.mjs`（`pnpm factory:agents`）。
<!-- END:factory-core-policy -->

> **块外注记（本仓人类文档，不属于上面的管理块）· 模型路由为什么在 2026-09-17 换**
>
> 旧路由 `opencode-go-dsv41 / deepseek-flash` 当天**额度耗尽**——三个 subagent 连续中途死亡、
> 不留收尾消息（其中两份工作其实已经做完，只是没人收尾）。随后会话侧把
> `deepseek/deepseek-v4.1-flash` 放进子代理允许名单、并**实测派发成功**，路由遂改为
> `commandcode / deepseek/deepseek-v4.1-flash / max`，`verifiedOn` 记 **2026-09-17**。
>
> 依据：2026-09-17 用 `list_subagent_models` 核到 provider `commandcode` 的子代理可用模型为
> `deepseek/deepseek-v4.1-flash` 与 `Qwen/Qwen3.8-Flash`，且该 model 广告 reasoning efforts
> low/medium/high/max。本仓此前那条记录是 `opencode-go-dsv41 / deepseek-flash / 2026-09-15`，
> 已经过期——本仓 schema 里 `verifiedOn` 的说明原文就是「路由变了要重新核，而不是让这里慢慢过期」。
>
> 这次只改路由四格；`concurrency.qaPort`（3300）与 `kitsRegistry` 各字段都没有动。

---

## 1 · Registry 唯一权威与资产准入

**`registry/assets.json` 是资产准入的唯一权威。** 一个 pack / component / effect / skill 是否存在、
处于什么状态（`approved` / `experimental` / `incoming` / `deprecated`）、适用范围是什么，
以它为准。README、`docs/`、Playground 页面都只是它的**视图**。

视图可以过期，**权威不能有第二份**。历史上出过的问题正是「schema 说 legal、脚本说 suspicious」
两套真相长期共存 —— 之所以能共存，是因为没有人核对它们。所以：

- registry 的判定逻辑只有一份：`scripts/lib/manifest-contract.mjs`。测试（`tests/registry.spec.ts`、
  `tests/manifest-contract.spec.ts`）、审计脚本（`pnpm registry`）与 Playground 都 import 它，
  **不许出现平行实现**。
- `pnpm registry` 是给人看的审计（现状 + 「检查了什么」），error 会真的退出非 0；
  `pnpm test` 是不许出错的 CI 门禁。两者分工不同，规则同源。
- 新增资产 = 改 registry 并让它通过审计。**不要在文档里先宣布一个还不存在于 registry 的资产。**

## 2 · Source install 与独立交付

Kits 的交付方式是 **source install**：产品在**自己的仓库**里安装 Kits 的资产，并且必须在
`prototype-kits` 仓库**不存在**的情况下仍然能 install / typecheck / build。

这条判据的证据只有一个：`pnpm verify:standalone`。它把 fixture 复制到临时位置、跑 `kits add`、
**把本仓改名移走**、再在那个状态下跑 typecheck 与 build，最后复原。没有跑过它，
「可以独立交付」就只是一句话。

安装后的所有权边界（在**产品**仓里）：

| 路径 | 归属 |
|---|---|
| `lib/kits/installed/` | **Kits-managed** —— 重装整体覆盖，禁止手工改 |
| `lib/kits/.kits/` | **Kits-managed** tooling |
| `lib/kits/kits.lock.json` | **Kits-managed** state（安装状态的唯一凭据） |
| `lib/kits/adapters/` | **Product-owned** —— Kits 永不覆盖 |

**本仓是来源，不是消费者。** `lib/kits/installed/` 出现在本仓就是角色错位，`pnpm factory:agents`
会直接失败。升级资产 = 在本仓改 registry 与 pack，**不是**在产品里手工 patch。

## 3 · 目录与共享面

```
registry/    资产准入的权威清单（assets.json + schema）—— 共享面，单 owner
packages/    可发布的 workspace 包（@kits/* 各 pack 与工具）
components/  Signature Components
effects/     Effect Packs
styles/      Style Pack 的 token 层
playground/  Playground（@kits/playground）—— 不是业务产品，是验收面
.qa/         QA 与探针（含端口唯一来源 qa.config.mjs）
scripts/     门禁、审计与验证装置
docs/        架构、分发、集成、FAQ 等
```

**共享路径（同一时间只有一个 owner，其余只读）：** `AGENTS.md` · `package.json` ·
`factory-policy.json` · `factory.lock.json` · `registry/assets.json` · `lib/*.schema.json` ·
`scripts/guard-agent-policy.mjs` · `scripts/lib/agent-policy.mjs` · `.qa/qa.config.mjs`。

**单 worktree 单写者。** 并行改同一个仓的不同区域时，共享 working tree 会让 `git status`
无法归属变更，也会让一个 agent 的失败污染另一个的验收。要并行写就各自开 worktree。

## 4 · 端口与 QA（独占资源）

**Playground 与 QA 的端口是 `3300`，唯一来源是 `.qa/qa.config.mjs`。**

- Playground 的 `dev` / `start`、`.qa/` 下所有脚本、README 里的地址都从那里取值。
- `scripts/check-qa-port.mjs` 是预检守卫：端口被占用时 **fail loudly** 并给出定位命令，
  不替你猜、不替你杀进程。
- QA 的 server **必须由当前 run 自己启动**（`.qa/qa-server.mjs`）：child 以独立**进程组**启动，
  结束只杀自己那个进程组。设了 `KITS_BASE` 时会走 **EXTERNAL** 模式，不起也不停任何 server，
  但**身份检查照跑**。
- **身份检查不是就绪检查。** 「有东西以 2xx 应答」不等于「那是 Kits Playground」。
  任何就绪探针都必须同时确认页面带着 Kits 自己的标记（`IDENTITY_PROBE`）。

**禁止（会破坏别人的工作）：**

```bash
pkill -f "next dev"        # ✗ 会杀掉同机其它原型，甚至你自己的开发服务器
pkill -f "next-server"     # ✗ 同上
```

端口被占用时用 `lsof -nP -iTCP:<port> -sTCP:LISTEN` 定位，**确认属于当前任务**再单独停止它。

> Next 16 的 dev server 是**按项目**加锁的（`playground/.next/dev/lock`），不是按端口。
> 同一个项目不能再起第二个 `next dev`；`pnpm test` 与 `pnpm qa` 不能同时跑。

## 5 · 质量门

```bash
pnpm factory:agents     # 治理门禁：编排边界、管理块、锁、registry 角色、端口事实、CI 契约
pnpm registry           # registry 审计（error 退出非 0）
pnpm verify:standalone  # source install 独立交付的唯一证据
pnpm lint
pnpm typecheck
pnpm test               # vitest
pnpm build
pnpm qa                 # 端口守卫 + Playground 浏览器扫描（自管 server）
```

`pnpm check` 把 `pnpm factory:agents` 放在**第一项**，随后是 lint / typecheck / test / build。

任何一项失败：**禁止声称完成**。必须修复后重新执行，直至全部通过。

**「没检查」永远不能被说成「通过」。** 无法执行、无法读取、缺少对照物时，记为 `UNKNOWN` / `SKIP`
并写出原因。传不上去的结论不会因为措辞温和而变得可用。

## 6 · CI 与部署授权

**CI 只做质量门**（`.github/workflows/ci.yml`）：`factory:agents` → `registry` →
`verify:standalone` → lint / typecheck / test / build，然后**串行**的 browser QA job。

- **不调用任何部署 CLI、不持有任何部署 token、不创建 Preview / Production。**
  判断依据不是「作者没说」，而是 workflow 文本里根本没有这类调用 —— `pnpm factory:agents`
  会逐行扫这个文件并对此断言。
- CI 里 test 与 qa **不得拆成两个并行 job**：workflow 用 `needs:` 把串行关系表达成机器事实。
- **部署仍由 Vercel Git Integration 负责。** 源码发布 ≠ Production 部署。

**没有用户明确授权时，不得：**

- 创建 Vercel Project · link project · 修改 Production Branch · 修改 Deployment Protection
- 创建 Production deployment · 把 Preview 提升为 Production · 创建 automation bypass secret
- **push 到项目的 Production Branch**（它可能自动创建 Production deployment）

另外：**部署身份必须核验 `target` / `git ref` / `git SHA` / `readyState`，不得靠 URL 推断**；
受 SSO 保护的 URL 不得称为 public（只有匿名请求 2xx 才支持这个说法）。
本仓在 Vercel 侧关联了**多个** project（见控制面 catalog 的记录），因此「这个 repo 部署到哪里」
**本身就是一个有歧义的问题** —— 在核清楚之前不要对任何部署做断言。

**不要读、不要写、不要打印任何 token 值。**

## 7 · Git 授权

**分支策略：** `main` 是稳定基线，开发一律在 `feature/<kebab-case>`。
**`main` 的分支保护当前不可用**（控制面对全部已存在的 repo 探测均返回 403）——
**不得声称 `main` 已受保护。**

| 动作 | 是否默认允许 |
|---|---|
| 在 feature branch 上写文件 | 允许 |
| `git commit` | **需要明确授权** |
| `git push` | **需要明确授权** |
| merge / 删除分支 | **需要明确授权** |

**红线命令（默认禁止，除非用户明确要求；force 类还要再次确认风险）：**

```bash
git reset --hard          git clean -fd
git push --force          git push --force-with-lease
git branch -D             git checkout .
git restore .             rm -rf
```

commit 之前：`git status` → `git diff --stat` → `git diff`，检查意图之外的改动、密钥、
`.env`、`node_modules`、`.next`、`test-results`、`.qa/out` 与临时文件；尽量
`git add <explicit-files>`，不要盲目 `git add -A`。

## 8 · 交接必须包含「没验证的部分」

缺这一项的交接视为不合格：

1. 改动文件清单
2. 执行的验证命令（原文）
3. 命令结果（原文，成功或失败）
4. 未完成项
5. **没有验证的部分** ← 最容易漏、也最贵的一项

## 9 · 常见陷阱

1. **把本仓当成 product。** 锁里 `kind` 是 `kits-registry`。为了让 schema 通过而把它改成
   `product`，是拿一句假话换一个绿勾。
2. **在文档里先宣布资产。** 资产的存在性由 `registry/assets.json` 决定，不由 README 决定。
3. **以为「测试全绿」等于「页面正确」。** 就绪探针不做身份校验；全套断言可能打在别的 server 上。
4. **在共享面并行写。** 两个写者共享一棵树，冲突不是概率问题，是时间问题。
5. **手工改产品的 `lib/kits/installed/`。** 那是 Kits-managed，重装整体覆盖；升级 = 改本仓
   的 registry 与 pack。
6. **把 `3200` 当成还能用的端口。** 它已经让给独立槽位了；端口事实只有 `3300` 一个答案。
7. **没跑 `pnpm verify:standalone` 就说「可以独立交付」。** 没检查不能被说成通过。
