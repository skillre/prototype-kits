# Distribution · 资产怎么从 Kits 到产品

> 本文回答：**Kits 以什么形式交付给一个真实 Prototype，为什么是这种形式，
> 以及升级/审计怎么做。**
>
> 接入的具体步骤在 [integration.md](./integration.md)；
> 本文讲的是**机制与承诺**。

---

## 结论先行

**Prototype Kits 是一个 source-distributed design toolkit（源码分发的设计工具箱），
不是一个 runtime component package。**

这个结论不是设计偏好，是第一次真实产品集成测出来的 ——
推理过程见文末「为什么不是 runtime package」。

---

## 两种模式

| | **Delivery Mode** | **Development Mode** |
|---|---|---|
| 名字 | Source Installation | Local Link |
| 面向 | 产品交付 | Kits 开发 / 实验 / Style Migration 调查 |
| 机制 | `kits add` 把资产复制进产品 | `link:../prototype-kits/<pkg>` |
| 产品有 `@kits/*` 依赖 | **没有** | 有 |
| 需要 Next 配置 | **不需要** | `transpilePackages` + `externalDir` + `turbopack.root` |
| 需要 `allowImportingTsExtensions` | 不需要（安装器剥掉扩展名） | 需要 |
| React 类型版本 | 各自独立 | **必须同 major** |
| 改 Kits 立刻生效 | 否（要重新 `add`） | 是 |
| **删掉 Kits 仓库还能 build** | **能** | 不能 |

两条都必须存在，但**只有 Delivery Mode 能叫交付**。

---

## Delivery Mode 的机制

### 1. 复制 + 重写

安装器做两件不可分割的事：

```diff
# ① 裸包说明符 → 相对路径
- import { useReveal } from "@kits/react-utils";
+ import { useReveal } from "../react-utils/index";

# ② 相对路径剥掉源码扩展名
- import { cx } from "./contract.ts";
+ import { cx } from "./contract";
```

第 ① 步让产品**不依赖任何包解析**；
第 ② 步让产品**不需要改 tsconfig**。

第 ② 步是实测踩出来的：Kits 源码内部用具名扩展名（workspace 的源码分发
一直开着 `allowImportingTsExtensions`），但装进产品后产品会被迫打开同一个
flag，否则每个相对 import 报 `TS5097`。「安装后不要求产品改任何配置」
是 Source Installation 的核心承诺，因此扩展名在写盘时被剥掉。

### 2. 三个目录，两种所有权

```
lib/kits/
├── installed/         Kits 托管区 —— 只读，重新安装会整体替换
├── adapters/          产品托管区 —— Kits 永不覆盖
├── .kits/             Installer 自身 —— 让产品在 Kits 缺席时仍能 doctor
└── kits.lock.json     安装清单 —— Kits 托管
```

这条边界不是目录洁癖，它是 Kits 契约里那句
「产品只被允许依赖内部稳定 API」的**唯一可执行形式**：

- 产品代码 import `adapters/`
- 升级 = 覆盖 `installed/`，产品的适配层与调用方一行不改
- `kits add` 只在适配层文件**不存在**时生成它

**触发条件是硬性的**：产品源码里出现指向 `installed/`（或 `.kits/`）的
import，`kits doctor` 的 `boundary` 检查就报 **fail**。
规则是「产品代码 SHOULD NOT import `lib/kits/installed/*`」，
例外只有 installer / doctor / 内部工具 —— 因此 `installed/`、`.kits/`
与 `adapters/` 自身都不在扫描范围内。

#### 三类资产，三条缝

| 资产 | CSS 缝 | TS 缝 |
|---|---|---|
| Style Pack | `style-<id>.css` | `style-<id>.ts` + `style-pack.ts`（稳定别名） |
| Signature Component | （组件自己 import） | `<id>.tsx` |
| Effect | `effect-<id>.css` | `effect-<id>.ts` |

v0.1.0 只有 CSS 缝，于是产品要拿 `cinematicMotion` 去编译 CSS 变量时
**无路可走**，只能 `import … from "../installed/cinematic/index"` ——
第二次真实 Source Installation 里它就是这么写的。契约没被违反，
是工具链没给合规的路；v0.1.1 把缝补上。

`style-pack.ts` 是**稳定名字**（`export * from "./style-<id>"`）：
产品关心的是"当前用哪套风格"，不是"cinematic 这个资产"。换 pack 时
改一行 re-export 即可，产品代码的引用面不动。

### 3. `kits.lock.json`

```jsonc
{
  "schemaVersion": 1,
  "registryVersion": "0.1.1",
  "generatedAt": "2026-09-13T05:52:08.208Z",
  "source": {
    "kind": "source-installation",
    "repo": "prototype-kits",
    "commit": "c1bd177b…",     // 可追溯到具体提交
    "dirty": false              // 安装时 Kits 工作区是否干净
  },
  "layout": { "installedRoot": "lib/kits/installed", "adapterRoot": "lib/kits/adapters", … },
  // 安装时**声明**的兼容区间 —— 独立安装下 doctor 唯一能依靠的元数据
  "compat": { "declaredReactRange": "^18.0.0 || ^19.0.0", "kitsTypesVersion": "19.3.0" },
  // 适配层的结果。模板版本让 standalone 的 doctor 能发现"缝是旧模板生成的"
  "adapters": { "templateVersion": "0.1.1", "written": ["…"], "kept": ["…"] },
  "assets": [
    { "id": "cinematic", "type": "style", "version": "0.1.0",
      "status": "approved", "apiVersion": "1.0.0",
      "files": [{ "path": "lib/kits/installed/cinematic/tokens.css", "checksum": "…" }] }
  ],
  "dependencies": [ { "from": "animated-grid", "to": "react-utils", "requirement": "*" } ],
  "files": [ { "path": "…", "checksum": "…", "assetId": "…" } ]
}
```

**checksum 记到每个文件**，而不是整包 ——
「托管区被手工改过」必须以文件为单位定位，否则 `doctor` 只能说"有东西变了"。

`schemaVersion` 用于演进：Installer 遇到不认识的版本会明确报错，
而不是猜着往下跑。

### 4. Installer Rules

九条，每一条都有可执行的对手（见 `tests/installer.spec.ts`，26 个断言）：

| # | 规则 | 怎么被验证 |
|---|---|---|
| 1 | 只安装 `approved` | 门禁在**读取层**；`experimental`/`deprecated`/`skill` 都被拒 |
| 2 | 自动解析依赖 | 拓扑序断言 + 环检测报错 |
| 3 | 校验 React 兼容性 | **在动磁盘之前**失败，且不留文件 |
| 4 | 校验 checksum | 篡改一个字节 → `doctor` 失败并指出文件与修法 |
| 5 | 不覆盖人工修改 | 改过的适配层原样保留；删掉的会被补齐 |
| 6 | 支持 dry-run | `--dry-run` 后产品目录里没有 `lib/` |
| 7 | 输出 diff | 与 lock 比对，分「新增 / 升级 / 不变 / 移除」 |
| 8 | 重复运行 idempotent | 连续两次安装 → **逐字节相同**的托管区 |
| 9 | 失败不留半安装状态 | 写盘前快照，出错按快照回滚并清掉托管区 |

**禁止的是「`cp -R` 然后不记录状态」** —— 上面第 4、5、8 条正是为它准备的。

### 5. 命令

```
kits add     安装（唯一的写操作）
kits list    查看 registry 里可安装的资产
kits doctor  体检：lock / 完整性 / 依赖闭合 / 上游可见性 / React 兼容 / 适配层 / 引用边界
kits diff    已安装 vs 当前 Kits
```

`doctor` 与 `diff` 不需要 Kits 仓库 —— 因为 Installer 自身被装在
产品的 `lib/kits/.kits/`。（`diff` 的语义是"与上游比"，因此它需要一个
`--kits` 指向；这是唯一的例外。）

#### doctor 的 `state` 列：结论是靠什么得到的

「读不到上游」和「与上游一致」是两件事。v0.1.0 把它们打印成了同一句话
（K-03）。从 v0.1.1 起每个检查都带一个 `state`：

| state | 含义 |
|---|---|
| `verified` | 直接读到了实际解析出的版本并据此判定 |
| `compatible` | 未读到上游；依据**声明的支持区间**判定 |
| `upstream-unavailable` | 两者都没有 → 无法判定（warn，不静默） |
| `not-applicable` | 本次安装不涉及该检查 |

```
✓ upstream-kits             [verified] Kits 仓库 /path/to/prototype-kits · @types/react 19.3.0
✓ react-types-major-parity  [verified] @types/react 19.3.0，与上游 Kits 解析到的 19.3.0 同 major（19）

! upstream-kits             [upstream-unavailable] 未找到 Kits 仓库（独立安装模式）
✓ react-types-major-parity  [compatible] @types/react 19.3.0（major 19）落在 Kits 声明的
                            ^18.0.0 || ^19.0.0 内 —— 未读到上游，未做上游比对
```

独立安装不是在"降级"：Source Installation 之后模块图里只有产品这一份
`@types/react`，Development Mode 那种"两份类型身份打架"在结构上不可能发生。
所以独立下的判据是"产品 major ∈ 安装时声明的区间"，而不是上游比对。

#### `boundary` 的三态：0 个文件扫描到的 0 个违规不等于通过（v0.2 · K5）

v0.1.1 的 `boundary` 有一个正式质量门上的静默失败路径：

```
扫过 0 个产品源文件，没有绕过适配层的引用     → ✓ boundary (pass)
```

「0 个文件里发现 0 个违规」和「检查通过」不是同一句话 —— 前者是**检查没有发生**。
v0.2 起判定分三态（与 `probe guard` 的 `0/0 = NaN`、Factory v1.2 seam 扫描的
`scanned 0` 是同一条原则）：

| 情形 | 判定 |
|---|---|
| 扫过 > 0 个产品源文件，0 个违规 | **pass**，并打印 `扫过 N 个 · 跳过 M 个` |
| 有违规 | **fail** |
| 有安装，但范围根全缺失 / 扫到 0 个文件 | **fail**（`[vacuous-scan]` 检查没有发生） |
| 没有安装（没有 lock） | **`not-applicable`**（`[not-installed]`）——**不是通过** |

`not-applicable` 是**第四种 status**（此前只有 pass / warn / fail）：它既不是通过
也不是失败。摘要行里它会单独计数（`· N 项不适用`），而且**只要还有不适用项，
摘要就不会说"全部通过"**。doctor 的输出恒包含 `scanned` / `excluded` / `violations`
三个数字 —— 说不清范围就不算检查过。

### 6. 升级路径

```bash
kits diff --kits ../prototype-kits   # 看哪些资产有新版本
kits add  --kits ../prototype-kits --style … --components …   # 重新安装
kits doctor
```

`installed/` 被整体替换，`adapters/` 与产品代码不受影响。
**`kits upgrade` 尚未实现** —— 本版只提供 `diff` 报告 + 重新 `add`，
v0.2 再考虑带迁移脚本的 upgrade。

---

## 为什么不是 runtime package

「把 Kits 发成 npm 包，产品 `pnpm add @kits/...`」看起来更标准。
第一次真实集成证明它在**当前形态**下不成立：

| 阻碍 | 实测证据 |
|---|---|
| **包边界是漏的** | 组件 import 包目录外的 `../_shared/*`；`file:` 只复制包目录本身 → 构建失败。已在本次修复（抽成 `@kits/contracts` / `@kits/react-utils`） |
| **源码分发 + 符号链接 = 类型版本耦合** | 产品 `@types/react` 19.2.18 vs Kits 19.3.0 → **产品的** `tsc` 在 **Kits 自己的文件**上报 `TS2322`，报错指向 Kits，根因在版本。已改为 peer + doctor 检查，但这在 runtime package 模式下会变成每个消费者都要处理的事 |
| **需要私有 npm 认证** | 本阶段目标明确排除掉它 |
| **契约的编译函数不可达** | `motionToCssVars` 不在任何 exports 里，产品只能手抄 13 行变量表。已修，但它暴露的是"包的公开面与实现面长期不同步" |

而源码分发换来的是这次实验真正需要的东西：

- **可审计**：`lock` 里每个文件的 checksum；契约只有一份；没有"发布的 d.ts 与实现不一致"
- **可追踪版本**：`lock.source.commit` 指到具体提交
- **不依赖认证**：不需要私有 registry
- **可升级**：`diff` + 重新 `add`，且适配层受保护
- **零配置**：产品不需要改 `next.config.ts` / `tsconfig.json` / `package.json`

**判据**：`node scripts/verify-standalone.mjs` 会把 Kits 仓库改名移走，
然后要求 fixture 仍然 typecheck + build。runtime package 模式永远做不到这一条
（包必须先在 registry 上）。

### 那什么时候该变成 runtime package？

当同时满足这三条时值得重新评估：

1. Kits 需要被**多个团队**消费，且无法共享同一棵源码树；
2. 资产规模大到"复制"成为负担（当前 39 个文件 / 约 6 千行，复制成本 ≈0）；
3. 团队已经有私有 registry 与发布流程。

即使到那时，**契约层也应该先独立出去** —— 它是最稳定的部分，
也最像"真的包"。`@kits/contracts` 现在已经是一个干净的候选：
纯 TypeScript、零依赖、零 React。

---

## 版本策略

当前 `registryVersion` 是 `0.2.0`；**资产的版本号各自独立**，而且只有**分发内容真的变了**
的资产才会升版本 —— 这样 `kits diff` 说出的才是实话，它只报真有差异的资产：

| 版本 | 资产 | 为什么 |
|---|---|---|
| `0.2.0` | `editorial` / `cinematic` / `instrument` | manifest 增加了 `darkDirection`、`materialDirection`、适配标签与散文 |
| `0.2.0` | 五个 Signature Component | manifest 增加了适配标签与 `recommendedFor` / `avoidFor` 语义 |
| `0.2.0` | `paper-grain` / `ambient-glow` / `scanline-sweep` | `effects/manifest.json` 增加了 `material.kind` |
| `0.2.0` | `cli` | 接缝骨架、doctor 三态、registry 审计门与全部新判定 |
| `0.1.1` | `contracts` | v0.2 未改动 |
| `0.1.0` | `react-utils` | v0.2 未改动 |

历史：v0.1.1 只让真正变了的 5 个资产升到了 0.1.1（`contracts` / `cli` /
`insight-reveal` / `animated-grid` / `ambient-glow`），其余仍是 0.1.0。

三条约定：

1. **`apiVersion` 与 `version` 分开**：`apiVersion` 是组件/契约的接口版本
   （破坏性变更升 major），`version` 是资产自身的迭代版本。
   产品只依赖 `apiVersion` 的 major。
2. **`lock.schemaVersion`** 独立演进。Installer 遇到不认识的版本会明确报错。
   新增字段（v0.1.1 的 `compat` / `adapters`）不算破坏性变更。
3. **状态而不是版本表达成熟度**：`incoming → experimental → approved → deprecated`。
   安装器只接受 `approved`。状态流转的判据见
   [registry/README.md](../registry/README.md)。

### 升级 = 重新 `kits add`

```bash
kits diff --kits ../prototype-kits    # 哪些资产有新版本
kits add  --kits ../prototype-kits --style cinematic --components … --effects …
kits doctor
```

**不要手工改 `lib/kits/installed/` 下的文件。** 那是 Kits 托管区：
手工改动会被 `doctor` 的 `integrity` 检查按 checksum 抓出来（并判为失败），
而且下次安装会整体覆盖。要改行为就改 `adapters/` —— 那是产品的地盘，
Kits 永不覆盖。

---

## 自检：这个 Distribution 是否成立

一条命令：

```bash
node scripts/verify-standalone.mjs
```

它会把 `prototype-kits` 仓库**改名移走**，然后要求 fixture：

- 产品 `package.json` 里没有任何 `@kits/*`
- 产品源码里没有指向 Kits 仓库的路径
- `tsc --noEmit` 通过（含 v0.1.1 新增的 TS 缝）
- `next build` 通过
- 产品自己的 `lib/kits/.kits/kits.mjs doctor` 通过 —— 包括
  `boundary`（产品源码没有绕过适配层）与 `adapters-template`

**这条不过，就不算能交付。**
