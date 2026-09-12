# Prototype Kits · Asset Registry

本目录只有一件事：**登记**。

## 文件

| 文件 | 作用 |
|---|---|
| `assets.json` | 资产登记表 —— Kits 里每一个 style / component / effect / skill 都必须在这里有一条记录 |
| `assets.schema.json` | 登记表的结构契约（JSON Schema 2020-12），由 `tests/registry.spec.ts` 校验 |

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
pnpm test            # vitest：schema 校验 + 一致性 + 覆盖度
pnpm registry        # 审计脚本：把登记表打印成人类可读的清单
```

测试会强制以下规则：

- `assets.json` 必须能被解析，且通过 `assets.schema.json` 校验；
- 每个 `asset.path` 指向的目录/文件必须真实存在；
- `manifest` 指向的文件必须存在且能被解析；
- style 资产必须覆盖 `editorial` / `cinematic` / `instrument` 三个 id；
- component 资产必须覆盖五个 Signature Component 的 id；
- `status=approved` 的资产不得出现 `reducedMotion: "unsupported"`；
- 声明 `containsThirdPartyCode: false` 的资产目录里不得出现第三方源码痕迹
  （检查是否存在 `LICENSE-*` / `vendor/` / `raw/` 等目录）。


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
