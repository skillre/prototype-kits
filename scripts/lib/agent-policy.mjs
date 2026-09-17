/**
 * Prototype Kits · Factory governance policy — the enforcement side of policy 1.3.0.
 *
 * WHERE THIS COMES FROM, AND WHERE IT DIFFERS
 * -------------------------------------------
 * This module is adapted from the Factory baseline (`prototype-starter/scripts/lib/
 * agent-policy.mjs`, policy v1.3.0). The four general constraints are kept intact
 * because they are about *how work is done*, not about what a repository is:
 *
 *   - the agent-orchestration boundary (host-side subagents allowed and required;
 *     orchestration runtimes forbidden inside delivered code),
 *   - the fixed model route,
 *   - single-writer / single-owner / serial test-and-qa,
 *   - the two human gates (HVA, deployment authorization).
 *
 * What is **not** kept is the baseline's identity model. The baseline lock records
 * `starter: { packageName, version, commit }` and cross-checks it against
 * `init-contract.json` with `stage: "baseline"`. Kits has no init-contract and is
 * not a derived product: it is the provider / registry source. Claiming otherwise
 * would put a false statement about *what this repository is* into its own lock —
 * exactly the kind of thing this gate exists to prevent.
 *
 * So Kits' lock records `registry: { packageName, version, commit }` and the gate
 * checks it against this repository's `package.json` — a real check with a real
 * counterpart, not a renamed field with nothing behind it.
 *
 * Additionally the gate enforces three Kits-specific facts (`kitsRegistry`):
 * registry authority is single-source, source install is a first-class delivery
 * path, and the consumer install path does not belong in this repository.
 *
 * THE SOURCES, AND WHO OWNS WHICH
 * -------------------------------
 *   factory-policy.json              values         (human edits, schema-validated)
 *   lib/factory-policy.schema.json   key values     (the `const`s: source of truth)
 *   AGENTS.md managed block          prose          (rendered, verified verbatim)
 *   factory.lock.json                what is locked (registry identity + surfaces)
 *
 * The guard keeps no second copy of the policy values: it reads them out of the
 * schema and cross-checks the JSON, the block and the prose against them.
 *
 * WHAT IT DELIBERATELY DOES NOT CLAIM
 * -----------------------------------
 * The block is verified against its renderer, not against the world, and the port
 * surfaces are checked against a **declared** list rather than a whole-repo grep.
 * Both limits are stated where they apply so a narrower check is never read as a
 * broader guarantee.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

export const POLICY_FILENAME = "factory-policy.json"
export const LOCK_FILENAME = "factory.lock.json"
export const POLICY_SCHEMA_PATH = "lib/factory-policy.schema.json"
export const LOCK_SCHEMA_PATH = "lib/factory-lock.schema.json"
export const AGENTS_FILENAME = "AGENTS.md"
export const README_FILENAME = "README.md"
export const CI_WORKFLOW_PATH = ".github/workflows/ci.yml"
export const QA_CONFIG_PATH = ".qa/qa.config.mjs"
export const PORT_GUARD_PATH = "scripts/check-qa-port.mjs"
export const STANDALONE_VERIFIER_PATH = "scripts/verify-standalone.mjs"
export const REGISTRY_AUDIT_PATH = "scripts/registry-audit.mjs"
export const REGISTRY_SCHEMA_PATH = "registry/assets.schema.json"

/** The upstream reusable workflow this repo could call after a verified immutable v1 ref exists. */
export const UPSTREAM_CONTROL_REPO = "skillre/prototype-factory-control"
export const UPSTREAM_REUSABLE_WORKFLOW = `${UPSTREAM_CONTROL_REPO}/.github/workflows/reusable-prototype-ci.yml@v1`
/** Lock entry that must exist while the upstream workflow is NOT actually called. */
export const UPSTREAM_LOCK_ID = "upstream/control-repo"

/**
 * The port Kits used to share with starter and sth. Retired by the 3200 → 3300
 * migration (root catalog advised 3300 for Kits). Declared port surfaces must no
 * longer contain it.
 */
export const RETIRED_QA_PORT = 3200

/**
 * Raised when a scan had nothing to look at. An empty scan is not a clean scan,
 * it is a check that did not run, and it must never be reported as a pass.
 */
export class PolicyScopeError extends Error {
  constructor(message) {
    super(message)
    this.name = "PolicyScopeError"
  }
}

/* -------------------------------------------------------------------------- */
/* a small JSON Schema subset validator                                        */
/* -------------------------------------------------------------------------- */

/**
 * Evaluating the *schema* instead of hand-copying its constants is the point:
 * if someone relaxes a `const` in `lib/factory-policy.schema.json`, the policy
 * JSON stops being validated against it — and the named key-value checks
 * immediately have nothing to compare against, so they fail loudly rather than
 * silently agreeing with a weakened schema.
 *
 * Supported keywords: $ref (local), type, const, enum, pattern, minLength,
 * maxLength, minItems, maxItems, uniqueItems, required, properties,
 * additionalProperties, items. Unknown keywords are counted as
 * `ignoredKeywords`, so an unsupported keyword can never masquerade as satisfied.
 */
const SUPPORTED_KEYWORDS = new Set([
  "$schema",
  "$id",
  "$ref",
  "$defs",
  "title",
  "description",
  "default",
  "examples",
  "type",
  "const",
  "enum",
  "pattern",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "uniqueItems",
  "required",
  "properties",
  "additionalProperties",
  "items",
  "allOf",
  "anyOf",
  "oneOf",
])

function jsonTypeOf(value) {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  return typeof value
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function deepEqual(a, b) {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a).sort()
    const bKeys = Object.keys(b).sort()
    return (
      aKeys.length === bKeys.length &&
      aKeys.every((key, index) => key === bKeys[index] && deepEqual(a[key], b[key]))
    )
  }
  return false
}

function matchesType(value, expected) {
  if (expected === "integer") return Number.isInteger(value)
  if (expected === "number") return typeof value === "number" && Number.isFinite(value)
  return jsonTypeOf(value) === expected
}

function resolveRef(ref, rootSchema) {
  if (typeof ref !== "string" || !ref.startsWith("#/")) return undefined
  let node = rootSchema
  for (const rawKey of ref.slice(2).split("/")) {
    const key = rawKey.replace(/~1/g, "/").replace(/~0/g, "~")
    if (!isPlainObject(node) || !(key in node)) return undefined
    node = node[key]
  }
  return node
}

/**
 * Validate `value` against `schema`.
 *
 * @returns {{ ok: boolean, issues: Array<{code: string, path: string, message: string}>,
 *             checks: number, keyValueChecks: number, ignoredKeywords: string[] }}
 */
export function validateAgainstSchema(value, schema) {
  const issues = []
  const ignored = new Set()
  const ctx = { root: schema, issues, ignored, checks: 0, keyValueChecks: 0 }

  const fail = (path, message) => {
    issues.push({ code: "policy/schema", path: path || "(root)", message })
  }

  const walk = (node, nodeSchema, path) => {
    if (nodeSchema === undefined || nodeSchema === true) return
    if (nodeSchema === false) {
      ctx.checks += 1
      fail(path, "schema 为 false：这里不接受任何值")
      return
    }
    if (!isPlainObject(nodeSchema)) return

    if (typeof nodeSchema.$ref === "string") {
      const resolved = resolveRef(nodeSchema.$ref, ctx.root)
      ctx.checks += 1
      if (resolved === undefined) fail(path, `无法解析 $ref ${nodeSchema.$ref}`)
      else walk(node, resolved, path)
    }

    for (const keyword of Object.keys(nodeSchema)) {
      if (!SUPPORTED_KEYWORDS.has(keyword)) ignored.add(keyword)
    }

    if ("type" in nodeSchema) {
      ctx.checks += 1
      const expected = nodeSchema.type
      const ok = Array.isArray(expected)
        ? expected.some((candidate) => matchesType(node, candidate))
        : matchesType(node, expected)
      if (!ok) {
        fail(path, `类型必须是 ${Array.isArray(expected) ? expected.join(" | ") : expected}，实际是 ${jsonTypeOf(node)}`)
        return
      }
    }

    if ("const" in nodeSchema) {
      ctx.checks += 1
      ctx.keyValueChecks += 1
      if (!deepEqual(node, nodeSchema.const)) {
        fail(path, `必须是 ${JSON.stringify(nodeSchema.const)}，实际是 ${JSON.stringify(node)}`)
      }
    }

    if (Array.isArray(nodeSchema.enum)) {
      ctx.checks += 1
      ctx.keyValueChecks += 1
      if (!nodeSchema.enum.some((candidate) => deepEqual(node, candidate))) {
        fail(path, `必须是 ${nodeSchema.enum.map((v) => JSON.stringify(v)).join(" | ")} 之一，实际是 ${JSON.stringify(node)}`)
      }
    }

    if ("pattern" in nodeSchema) {
      ctx.checks += 1
      if (typeof node !== "string" || !new RegExp(nodeSchema.pattern).test(node)) {
        fail(path, `必须匹配 /${nodeSchema.pattern}/，实际是 ${JSON.stringify(node)}`)
      }
    }

    if ("minLength" in nodeSchema) {
      ctx.checks += 1
      if (typeof node !== "string" || node.length < nodeSchema.minLength) {
        fail(path, `长度不得小于 ${nodeSchema.minLength}`)
      }
    }

    if ("maxLength" in nodeSchema) {
      ctx.checks += 1
      if (typeof node === "string" && node.length > nodeSchema.maxLength) {
        fail(path, `长度不得超过 ${nodeSchema.maxLength}`)
      }
    }

    if ("minItems" in nodeSchema) {
      ctx.checks += 1
      if (!Array.isArray(node) || node.length < nodeSchema.minItems) {
        fail(path, `条目数不得少于 ${nodeSchema.minItems}`)
      }
    }

    if ("maxItems" in nodeSchema) {
      ctx.checks += 1
      if (Array.isArray(node) && node.length > nodeSchema.maxItems) {
        fail(path, `条目数不得超过 ${nodeSchema.maxItems}`)
      }
    }

    if ("uniqueItems" in nodeSchema && nodeSchema.uniqueItems) {
      ctx.checks += 1
      if (Array.isArray(node)) {
        const seen = new Set()
        for (const item of node) {
          const key = JSON.stringify(item)
          if (seen.has(key)) fail(path, `条目必须唯一，重复：${key}`)
          seen.add(key)
        }
      }
    }

    if ("items" in nodeSchema && Array.isArray(node)) {
      node.forEach((item, index) => walk(item, nodeSchema.items, `${path}[${index}]`))
    }

    if ("required" in nodeSchema && isPlainObject(node)) {
      for (const key of nodeSchema.required) {
        ctx.checks += 1
        if (!(key in node)) fail(path, `缺少必填字段 ${key}`)
      }
    }

    const properties = isPlainObject(nodeSchema.properties) ? nodeSchema.properties : undefined
    if (properties && isPlainObject(node)) {
      for (const [key, childSchema] of Object.entries(properties)) {
        if (key in node) walk(node[key], childSchema, path ? `${path}.${key}` : key)
      }
    }

    if (nodeSchema.additionalProperties === false && isPlainObject(node)) {
      const known = new Set(Object.keys(properties ?? {}))
      for (const key of Object.keys(node)) {
        ctx.checks += 1
        if (!known.has(key)) fail(path, `出现未声明的字段 ${key}（schema 声明 additionalProperties: false）`)
      }
    }

    // Combinators are not implemented. Refusing loudly is the only honest option:
    // silently skipping a `oneOf` would turn a real constraint into a satisfied
    // one, which is the failure mode this whole module exists to stop.
    for (const keyword of ["allOf", "anyOf", "oneOf"]) {
      const branches = nodeSchema[keyword]
      if (!Array.isArray(branches) || branches.length === 0) continue
      ctx.checks += 1
      fail(path, `schema 用了 ${keyword}，而本校验器不实现它——拒绝静默跳过，请改写 schema`)
    }
  }

  walk(value, schema, "")

  return {
    ok: issues.length === 0,
    issues,
    checks: ctx.checks,
    keyValueChecks: ctx.keyValueChecks,
    ignoredKeywords: [...ignored].sort(),
  }
}

/* -------------------------------------------------------------------------- */
/* the managed block                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Every rule the managed block must state. The guard always renders the block
 * and checks it against this list *before* comparing it to AGENTS.md, so a
 * template edit that quietly drops a rule fails here — the block cannot shrink
 * into something that merely happens to match a truncated file.
 */
export function blockAnchors(policy) {
  const routing = policy?.modelRouting ?? {}
  const port = policy?.concurrency?.qaPort
  return [
    { id: "orchestration/allowed", pattern: /允许并要求/, hint: "必须写明 DSH 宿主内多 Subagent 是允许且被要求的" },
    { id: "orchestration/host", pattern: /DSH\s*宿主/, hint: "必须点名宿主" },
    { id: "orchestration/subagents", pattern: /Subagent/, hint: "必须点明 Subagent" },
    { id: "orchestration/delivered-code", pattern: /禁止[\s\S]{0,120}交付面/, hint: "必须把禁令限定在交付面代码" },
    { id: "orchestration/frameworks", pattern: /编排框架|编排运行时/, hint: "必须点名被禁的东西是编排框架/运行时" },
    { id: "routing/provider", pattern: new RegExp(escapeRegExp(String(routing.provider ?? "\u0000"))), hint: "必须写明 provider" },
    { id: "routing/model", pattern: new RegExp(escapeRegExp(String(routing.model ?? "\u0000"))), hint: "必须写明 model" },
    { id: "routing/effort", pattern: new RegExp(escapeRegExp(String(routing.reasoningEffort ?? "\u0000"))), hint: "必须写明 reasoning effort" },
    { id: "concurrency/worktree", pattern: /单\s*worktree\s*单写者/, hint: "必须写明单 worktree 单写者" },
    { id: "concurrency/shared-paths", pattern: /共享路径单\s*owner/, hint: "必须写明共享路径单 owner" },
    { id: "concurrency/test-and-qa", pattern: /test\s*\/\s*qa[\s\S]{0,40}串行/i, hint: "必须写明 test/qa 串行" },
    { id: "concurrency/qa-port", pattern: new RegExp(escapeRegExp(String(port ?? "\u0000"))), hint: "必须写明 Kits 的 QA 端口" },
    { id: "registry/authority", pattern: /唯一权威/, hint: "必须写明 registry 是唯一权威" },
    { id: "registry/source-install", pattern: /source install|源码安装/, hint: "必须写明 source install 是一等交付方式" },
    { id: "gate/hva", pattern: /HVA/, hint: "必须写明人工视觉验收" },
    { id: "gate/deployment", pattern: /部署授权/, hint: "必须写明部署授权" },
  ]
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Render the canonical managed block from the policy.
 *
 * The block is generated, not written by hand: `--print-block` prints exactly
 * this text, and the guard verifies AGENTS.md contains it verbatim. One writer,
 * one reader, no drift.
 */
export function renderManagedBlock(policy) {
  // `end` is not read here: the closing marker is rebuilt from `marker`, so the
  // block's END cannot disagree with its BEGIN about which marker it is.
  const { begin, marker } = policy.managedBlock
  const routing = policy.modelRouting
  const concurrency = policy.concurrency
  const orchestration = policy.agentOrchestration
  const authorization = policy.authorization
  const kits = policy.kitsRegistry

  return [
    begin,
    `> 本块由 \`pnpm factory:agents --print-block\` 从 \`${POLICY_FILENAME}\` 渲染，\`pnpm factory:agents\` 逐字校验。`,
    `> **不要手工编辑块内文字**：改 \`${POLICY_FILENAME}\`（其关键值由 \`${POLICY_SCHEMA_PATH}\` 钉住），再同步本块。块外仍是人类写的文档。`,
    "",
    `## Factory Core Policy v${policy.policyVersion}（Agent 编排与并发 · Kits registry 仓）`,
    "",
    `- **Agent 编排边界（是边界，不是禁令）**：**允许并要求**在 **DSH 宿主**内用多 **Subagent** 拆分与并行任务；`,
    `  **禁止**在**交付面代码**里引入编排框架或编排运行时。`,
    `  - 允许：${orchestration.allowedScope}`,
    `  - 禁止：${orchestration.forbiddenScope}`,
    `  - 判据：\`packages\` \`components\` \`effects\` \`styles\` \`playground\` 不得 import 编排 SDK；\`package.json\` 的运行时依赖不得出现编排框架。宿主侧的 Subagent 调用不是被交付的代码，不受此限。`,
    `- **模型路由**：provider \`${routing.provider}\` / model \`${routing.model}\` / reasoning effort \`${routing.reasoningEffort}\`（${routing.verifiedOn} 与 DSH 模型目录核对）。每次 Subagent 调用都必须把三个字段显式写全，不许依赖宿主默认值——默认值会漂移，而漂移不留痕迹。改路由先改 \`${POLICY_FILENAME}\`。`,
    `- **单 worktree 单写者**（\`${concurrency.worktree}\`）：同一棵工作副本同一时间只有一个写者；要并行写就各自独立 worktree。两个写者共享一棵树，冲突不是概率问题，是时间问题。`,
    `- **共享路径单 owner**（\`${concurrency.sharedPaths}\`）：\`${AGENTS_FILENAME}\`、\`package.json\`、\`${POLICY_FILENAME}\`、\`${LOCK_FILENAME}\`、\`${kits.assetRegistryPath}\`、契约 schema 与门禁脚本这类共享面，同一时间只有一个 owner，其余 agent 只读。`,
    `- **test / qa 串行**（\`${concurrency.testAndQa}\`）：\`pnpm test\` 与 \`pnpm qa\` **永不并发**（Next 16 的 dev server 按项目加锁，并行只会在错误的 server 上出结果）。CI 里同样不得拆成两个并行 job。`,
    `- **QA 端口 ${concurrency.qaPort}（独占资源）**：\`${QA_CONFIG_PATH}\` 是端口的唯一来源，playground 的 dev/start 与所有 QA 脚本都从它取值。原 3200 与 starter / sth 三仓共用，已按根控制面 catalog 的建议让到 ${concurrency.qaPort}。**QA 绝不复用未知 server**：server 必须由当前 run 自己启动，端口被占用时 fail loudly，不 adopt、不猜、不 pkill。`,
    `- **registry 唯一权威**（\`${kits.authority}\`）：资产的存在性、状态与适用范围一律以 \`${kits.assetRegistryPath}\` 为准；README、文档、Playground 只是它的视图，视图可以过期，权威不能有第二份。`,
    `- **source install 是一等交付**（\`${kits.sourceInstall}\`）：产品在**自己的仓库**里安装 Kits，并且必须在 prototype-kits 仓库不存在时仍可 build——\`pnpm verify:standalone\` 是这条的唯一证据，没跑就不能说它成立。`,
    `- **本仓是 registry 来源，不是消费者**：\`${kits.consumerInstallPath}\` 属于产品，不属于本仓；本仓出现它就是角色错位，Gate 直接失败。`,
    `- **HVA（人工视觉验收）**：\`${authorization.humanVisualAcceptance}\` —— 没有 HVA 就没有发布；Agent 不能替人验收，未完成时状态只能是 \`READY FOR HUMAN VISUAL ACCEPTANCE\`。`,
    `- **部署授权**：\`${authorization.deployment}\` —— 源码发布 ≠ Production 部署。CI 只做质量门，不调用 Vercel CLI、不持有 token、不部署；没有用户明确授权，不创建/提升 Production 部署、不改 Deployment Protection、不 push Production Branch。`,
    "",
    `机器可读副本：\`${POLICY_FILENAME}\` · 关键值：\`${POLICY_SCHEMA_PATH}\` · 治理锁：\`${LOCK_FILENAME}\` · 校验器：\`scripts/guard-agent-policy.mjs\`（\`pnpm factory:agents\`）。`,
    `<!-- END:${marker} -->`,
  ].join("\n")
}

/** The `<marker>` in `<!-- BEGIN:<marker> vX -->` — read back out of the policy. */
export function extractBlock(agentsText, policy) {
  const begin = policy.managedBlock.begin
  const end = policy.managedBlock.end
  const beginIndex = agentsText.indexOf(begin)
  const endIndex = agentsText.indexOf(end)
  const extraBegin = agentsText.indexOf(begin, beginIndex + 1)
  const extraEnd = agentsText.indexOf(end, endIndex + 1)
  return {
    beginIndex,
    endIndex,
    beginCount: extraBegin === -1 && beginIndex !== -1 ? 1 : countOccurrences(agentsText, begin),
    endCount: extraEnd === -1 && endIndex !== -1 ? 1 : countOccurrences(agentsText, end),
  }
}

function countOccurrences(text, needle) {
  let count = 0
  let index = text.indexOf(needle)
  while (index !== -1) {
    count += 1
    index = text.indexOf(needle, index + needle.length)
  }
  return count
}

/**
 * Normalise for comparison: trailing whitespace per line and the trailing
 * newline are not policy. Everything else — wording, order, punctuation — is.
 */
function normaliseBlock(text) {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n+$/, "")
}

/** Compare the block found in AGENTS.md with the canonical render. */
export function compareManagedBlock(agentsText, policy) {
  const placement = extractBlock(agentsText, policy)
  if (placement.beginCount !== 1 || placement.endCount !== 1) {
    return {
      ok: false,
      reason: "markers",
      found: placement,
      message: `管理块标记必须各出现且仅出现一次：找到 BEGIN × ${placement.beginCount}、END × ${placement.endCount}`,
    }
  }
  if (placement.beginIndex > placement.endIndex) {
    return { ok: false, reason: "order", found: placement, message: "END 标记出现在 BEGIN 之前" }
  }

  const endMarkerIndex = placement.endIndex + policy.managedBlock.end.length
  const actual = agentsText.slice(placement.beginIndex, endMarkerIndex)
  const expected = renderManagedBlock(policy)
  if (normaliseBlock(actual) === normaliseBlock(expected)) {
    return { ok: true, reason: "match", found: placement, expected, actual }
  }

  const actualLines = normaliseBlock(actual).split("\n")
  const expectedLines = normaliseBlock(expected).split("\n")
  const firstDiff = expectedLines.findIndex((line, index) => line !== actualLines[index])
  return {
    ok: false,
    reason: "drift",
    found: placement,
    expected,
    actual,
    message:
      `管理块与 \`${POLICY_FILENAME}\` 渲染结果不一致（第一处差异在第 ${firstDiff + 1} 行）\n` +
      `  - 期望：${expectedLines[firstDiff] ?? "(缺失)"}\n` +
      `  - 实际：${actualLines[firstDiff] ?? "(缺失)"}`,
  }
}

/* -------------------------------------------------------------------------- */
/* prohibition conflicts                                                       */
/* -------------------------------------------------------------------------- */

const MULTI_AGENT_TERM = /(multi-?agent|多\s*agent|多\s*sub-?agent|sub-?agent)/i
const PROHIBITION = /(禁止|不得|不允许|严禁|forbid|forbidden|must not|❌)/
const SCOPE_QUALIFIER =
  /(交付面代码|交付面|产品应用代码|产品代码|产品运行时|应用代码|运行时依赖|产品依赖|packages|playground|product (application )?code)/i

/**
 * A prohibition that mentions subagents must say *what it is prohibiting*.
 *
 * "禁止 Multi-agent orchestration" fails this scan: it bans the term, so it also
 * bans the host-side workflow the policy requires. "禁止在交付面代码里引入编排
 * 框架" passes: the scope is named. This is the check that would have caught v1.2
 * on the day it was written.
 */
export function scanProhibitionConflicts(files) {
  const conflicts = []
  let linesScanned = 0

  for (const { path, text } of files) {
    text.split("\n").forEach((line, index) => {
      linesScanned += 1
      if (!MULTI_AGENT_TERM.test(line)) return
      if (!PROHIBITION.test(line)) return
      const qualifier = line.match(SCOPE_QUALIFIER)
      if (qualifier) return
      conflicts.push({
        code: "policy/unscoped-prohibition",
        path,
        line: index + 1,
        message:
          "禁令提到了 Subagent/Multi-agent，却没有说出禁止的对象——这会连宿主侧合法的多 Subagent 一起ban掉。",
        text: line.trim(),
      })
    })
  }

  return { conflicts, linesScanned, filesScanned: files.length }
}

/* -------------------------------------------------------------------------- */
/* CI workflow                                                                 */
/* -------------------------------------------------------------------------- */

/** An *active* call, not a comment mentioning one: YAML comments start with `#`. */
export function detectUpstreamReuse(ciText) {
  const active = []
  ciText.split("\n").forEach((line, index) => {
    if (/^\s*uses:\s*skillre\/prototype-factory-control\//.test(line)) {
      active.push({ line: index + 1, text: line.trim() })
    }
  })
  return active
}

/**
 * Split the `jobs:` mapping into job blocks.
 *
 * Deliberately small: it only needs to answer "which job runs `pnpm qa`, and
 * does it depend on the job that runs `pnpm test`". If `jobs:` is missing the
 * caller must fail — not fall through with zero jobs.
 */
export function parseJobs(ciText) {
  const lines = ciText.split("\n")
  const jobsIndex = lines.findIndex((line) => /^jobs:\s*$/.test(line))
  if (jobsIndex === -1) return { found: false, jobs: [] }

  const jobs = []
  let current = null
  for (let index = jobsIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (/^\S/.test(line) && line.trim() !== "") break
    const match = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/)
    if (match) {
      current = { name: match[1], line: index + 1, body: [] }
      jobs.push(current)
      continue
    }
    if (current) current.body.push(line)
  }
  return { found: true, jobs }
}

/**
 * The CI contract, as a pure function of the workflow text.
 *
 * @returns {{ problems: Array<{code: string, message: string}>, upstreamReuse: Array<{line: number, text: string}>, jobs: number }}
 */
export function inspectCiWorkflow(ciText) {
  const problems = []
  const lines = ciText.split("\n")

  if (!ciText.includes("pnpm factory:agents")) {
    problems.push({ code: "ci/no-policy-gate", message: "CI 没有跑 `pnpm factory:agents`：策略门禁在 CI 里缺席" })
  }

  const vercelCli = lines.findIndex((line) =>
    /\b(vercel|npx vercel)\s+(deploy|pull|link|promote|env|curl|build)\b|npx\s+vercel\b|uses:\s*vercel\//i.test(line),
  )
  if (vercelCli !== -1) {
    problems.push({
      code: "ci/vercel-cli",
      message: `第 ${vercelCli + 1} 行出现 Vercel CLI/action 调用——CI 只做质量门，不用 Vercel CLI/token`,
    })
  }

  const vercelToken = lines.findIndex((line) =>
    /VERCEL_TOKEN|VERCEL_AUTOMATION_BYPASS|vercel-protection-bypass|--token\b/i.test(line),
  )
  if (vercelToken !== -1) {
    problems.push({
      code: "ci/deployment-credential",
      message: `第 ${vercelToken + 1} 行出现部署凭据——CI 不得持久化也不得使用部署 token`,
    })
  }

  const parsed = parseJobs(ciText)
  if (!parsed.found || parsed.jobs.length === 0) {
    problems.push({
      code: "ci/jobs-unparsed",
      message: "解析不到 `jobs:` 段（或没有 job）——无法证明 test/qa 串行，不作为通过",
    })
  } else {
    const runs = (job, command) => job.body.some((line) => new RegExp(`pnpm ${command}(\\s|$)`).test(line))
    const testJobs = parsed.jobs.filter((job) => runs(job, "test"))
    const qaJobs = parsed.jobs.filter((job) => runs(job, "qa"))

    if (testJobs.length === 0) problems.push({ code: "ci/no-test-job", message: "CI 里没有 job 跑 `pnpm test`" })
    if (qaJobs.length === 0) problems.push({ code: "ci/no-qa-job", message: "CI 里没有 job 跑 `pnpm qa`" })

    const overlapping = qaJobs.filter((qa) => testJobs.some((test) => test.name === qa.name))
    if (overlapping.length > 0) {
      problems.push({
        code: "ci/test-qa-same-job",
        message: `job \`${overlapping[0].name}\` 同时跑 test 与 qa——两者永不并发，必须拆成串行 job`,
      })
    }

    for (const qa of qaJobs) {
      const needs = qa.body.find((line) => /^\s*needs:/.test(line))
      const dependsOnTest = needs && testJobs.some((test) => needs.includes(test.name))
      if (!dependsOnTest) {
        problems.push({
          code: "ci/test-qa-not-serial",
          message: `job \`${qa.name}\` 跑 qa 却没有 \`needs:\` 依赖跑 test 的 job——串行没有被机器表达`,
        })
      }
    }
  }

  return { problems, upstreamReuse: detectUpstreamReuse(ciText), jobs: parsed.jobs.length }
}

/**
 * `package.json` wiring: the gate must exist and must be the first item of
 * `check`. A policy gate that is not wired into the aggregate script is a gate
 * that runs when someone remembers to run it.
 *
 * Kits additionally requires `registry` and `verify:standalone` — the two scripts
 * that make "registry is the single authority" and "source install is a
 * first-class delivery path" checkable rather than aspirational.
 */
export function inspectPackageWiring(pkg) {
  const problems = []
  const scripts = pkg?.scripts ?? {}

  if (!scripts["factory:agents"]) {
    problems.push({ code: "package/missing-script", message: "package.json 没有 `factory:agents` 脚本——策略门禁没有被接上" })
  } else if (!String(scripts["factory:agents"]).includes("scripts/guard-agent-policy.mjs")) {
    problems.push({
      code: "package/script-target",
      message: `\`factory:agents\` 没有指向 scripts/guard-agent-policy.mjs：${scripts["factory:agents"]}`,
    })
  }

  if (!/^\s*pnpm factory:agents\s*&&/.test(String(scripts.check ?? ""))) {
    problems.push({
      code: "package/check-order",
      message: `\`check\` 必须以 \`pnpm factory:agents &&\` 开头（它是第一项门禁），实际是：${scripts.check}`,
    })
  }

  for (const required of ["registry", "verify:standalone", "test", "lint", "typecheck", "build"]) {
    if (!scripts[required]) {
      problems.push({ code: "package/missing-gate", message: `package.json 缺少 \`${required}\` 脚本——质量门不完整` })
    }
  }

  if (!/check-qa-port\.mjs/.test(String(scripts.qa ?? ""))) {
    problems.push({
      code: "package/qa-port-guard",
      message: `\`qa\` 没有先跑 ${PORT_GUARD_PATH}：端口守卫缺席时，QA 可能接到别的 server 上`,
    })
  }

  return { problems }
}

/* -------------------------------------------------------------------------- */
/* Kits registry + port facts                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The three Kits-specific facts, checked against the filesystem.
 *
 * Each one is a claim the policy makes about *what this repository is*; a claim
 * with no counterpart on disk is a sentence, not a rule.
 */
export function inspectKitsRegistry(policy, projectRoot) {
  const problems = []
  const kits = policy.kitsRegistry ?? {}
  let checks = 0

  const assetRegistry = kits.assetRegistryPath
  if (typeof assetRegistry === "string" && assetRegistry.length > 0) {
    checks += 1
    if (!existsSync(join(projectRoot, assetRegistry))) {
      problems.push({
        code: "registry/asset-registry-missing",
        message: `registry 唯一权威 \`${assetRegistry}\` 不存在——权威清单不在，资产就没有准入面`,
      })
    }
  } else {
    problems.push({ code: "registry/asset-registry-undeclared", message: "策略没有声明 assetRegistryPath" })
  }

  checks += 1
  if (!existsSync(join(projectRoot, REGISTRY_SCHEMA_PATH))) {
    problems.push({
      code: "registry/schema-missing",
      message: `${REGISTRY_SCHEMA_PATH} 不存在——assets.json 没有可核对的形状`,
    })
  }

  checks += 1
  if (!existsSync(join(projectRoot, STANDALONE_VERIFIER_PATH))) {
    problems.push({
      code: "registry/standalone-verifier-missing",
      message: `${STANDALONE_VERIFIER_PATH} 不存在——「source install 可独立交付」这句就没有证据`,
    })
  }

  checks += 1
  if (!existsSync(join(projectRoot, REGISTRY_AUDIT_PATH))) {
    problems.push({
      code: "registry/audit-missing",
      message: `${REGISTRY_AUDIT_PATH} 不存在——registry 审计缺席`,
    })
  }

  // Role confusion: the provider must not carry the consumer's install target.
  const consumerPath = kits.consumerInstallPath
  if (typeof consumerPath === "string" && consumerPath.length > 0) {
    checks += 1
    if (existsSync(join(projectRoot, consumerPath))) {
      problems.push({
        code: "registry/role-confusion",
        message:
          `本仓出现了消费端安装目录 \`${consumerPath}\`——Kits 是 registry 的**来源**，不是消费者。` +
          "它属于产品仓库，出现在这里说明角色错位（或有人把安装产物提交进来了）。",
      })
    }
  }

  return { problems, checks }
}

function escapeForRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Port facts, checked against the **declared** surface list.
 *
 * Two claims: the live port is written where it must be read from, and the
 * retired port is gone from the surfaces that carry the fact.
 *
 * The scope is deliberately the declared list, not a whole-repo grep. A
 * `CHANGELOG.md` entry recording "3200 → 3300" is a *historical* fact and must
 * stay readable; forbidding the digits everywhere would turn a migration record
 * into a violation and teach people to delete history instead of writing it
 * down. That limit is why `scope` is reported alongside the result.
 *
 * @returns {{ problems: Array<{code: string, message: string}>, checks: number,
 *             livePort: number, filesScanned: number, filesMentioningLivePort: number,
 *             filesMentioningRetiredPort: number, scope: string }}
 */
export function inspectPortFacts(policy, projectRoot, readText) {
  const problems = []
  const kits = policy.kitsRegistry ?? {}
  const livePort = policy?.concurrency?.qaPort
  const surfaces = Array.isArray(kits.portSurfaces) ? kits.portSurfaces : []
  const read = readText ?? ((rel) => readFileSync(join(projectRoot, rel), "utf8"))

  let checks = 0
  let filesMentioningLivePort = 0
  let filesMentioningRetiredPort = 0

  if (!Number.isInteger(livePort)) {
    problems.push({ code: "port/undeclared", message: "策略没有把 concurrency.qaPort 钉成一个整数——端口事实没有来源" })
    return { problems, checks, livePort: null, filesScanned: 0, filesMentioningLivePort: 0, filesMentioningRetiredPort: 0, scope: "(none)" }
  }

  if (surfaces.length === 0) {
    problems.push({ code: "port/scope-empty", message: "portSurfaces 是空的——0 个文件被核，不能算通过" })
    return { problems, checks, livePort, filesScanned: 0, filesMentioningLivePort: 0, filesMentioningRetiredPort: 0, scope: "(empty)" }
  }

  const livePattern = new RegExp(`(?<!\\d)${livePort}(?!\\d)`)
  const retiredPattern = new RegExp(`(?<!\\d)${RETIRED_QA_PORT}(?!\\d)`)

  for (const rel of surfaces) {
    checks += 1
    let text
    try {
      text = read(rel)
    } catch (error) {
      problems.push({
        code: "port/surface-unreadable",
        message: `声明的端口事实文件 ${rel} 读不到（${error.message}）——没读到就不能说它与策略一致`,
      })
      continue
    }
    if (livePattern.test(text)) filesMentioningLivePort += 1
    if (retiredPattern.test(text)) {
      filesMentioningRetiredPort += 1
      problems.push({
        code: "port/retired-fact",
        message:
          `${rel} 仍然写着旧端口 ${RETIRED_QA_PORT}。端口事实必须整体迁移：` +
          `playground 的 dev/start、QA 脚本默认值、端口守卫提示与文档要一起改，` +
          `否则「Kits 用哪个端口」会有两个答案。`,
      })
    }
  }

  // The config is the single source of truth: it must *declare* the port, not
  // merely mention it somewhere in a comment.
  checks += 1
  try {
    const configText = read(QA_CONFIG_PATH)
    if (!new RegExp(`QA_PORT\\s*=\\s*${escapeForRegExp(livePort)}\\b`).test(configText)) {
      problems.push({
        code: "port/config-not-declaring",
        message: `${QA_CONFIG_PATH} 没有把 QA_PORT 声明为 ${livePort}——端口的唯一来源与策略不一致`,
      })
    }
  } catch (error) {
    problems.push({
      code: "port/config-missing",
      message: `${QA_CONFIG_PATH} 读不到（${error.message}）——端口没有唯一来源，QA 只能靠约定`,
    })
  }

  if (filesMentioningLivePort === 0) {
    problems.push({
      code: "port/never-stated",
      message: `声明的端口事实文件里一个都没写出 ${livePort}——被声明的面与真实端口脱节`,
    })
  }

  return {
    problems,
    checks,
    livePort,
    filesScanned: surfaces.length,
    filesMentioningLivePort,
    filesMentioningRetiredPort,
    scope: surfaces.join(", "),
  }
}

/* -------------------------------------------------------------------------- */
/* reporting                                                                   */
/* -------------------------------------------------------------------------- */

/** Read the `const` declared at a dot path, e.g. `concurrency.qaPort`. */
export function schemaConstAt(schema, dotPath) {
  let node = schema
  for (const key of dotPath.split(".")) {
    const properties = isPlainObject(node?.properties) ? node.properties : undefined
    if (!properties || !(key in properties)) return { declared: false, value: undefined }
    node = properties[key]
  }
  if (isPlainObject(node) && "const" in node) return { declared: true, value: node.const }
  return { declared: false, value: undefined }
}

/**
 * The key values the policy is *about*. The expected value is not written here:
 * it is read out of the schema, so there is exactly one place to change.
 */
export const KEY_VALUE_PATHS = [
  "schemaVersion",
  "policyVersion",
  "managedBlock.document",
  "managedBlock.marker",
  "managedBlock.version",
  "managedBlock.begin",
  "managedBlock.end",
  "agentOrchestration.host",
  "agentOrchestration.dshSubagents",
  "agentOrchestration.productAppFrameworks",
  "modelRouting.provider",
  "modelRouting.model",
  "modelRouting.reasoningEffort",
  "concurrency.worktree",
  "concurrency.sharedPaths",
  "concurrency.testAndQa",
  "concurrency.qaPort",
  "authorization.humanVisualAcceptance",
  "authorization.deployment",
  "kitsRegistry.role",
  "kitsRegistry.assetRegistryPath",
  "kitsRegistry.authority",
  "kitsRegistry.sourceInstall",
  "kitsRegistry.consumerInstallPath",
]

export function readJsonFile(path) {
  const text = readFileSync(path, "utf8")
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (error) {
    return { ok: false, error }
  }
}

export function valueAtDotPath(value, dotPath) {
  let node = value
  for (const key of dotPath.split(".")) {
    if (node === null || typeof node !== "object" || !(key in node)) return undefined
    node = node[key]
  }
  return node
}

/** Docs that state agent-facing rules — scanned in full for prohibition conflicts. */
export function collectPolicyDocs(root) {
  const files = []
  for (const rel of [AGENTS_FILENAME, README_FILENAME]) {
    const path = join(root, rel)
    if (existsSync(path)) files.push({ path: rel, text: readFileSync(path, "utf8") })
  }

  const docsDir = join(root, "docs")
  if (existsSync(docsDir)) {
    const walk = (relDir) => {
      for (const entry of readdirSync(join(root, relDir), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
        if (entry.name.startsWith(".")) continue
        const rel = `${relDir}/${entry.name}`
        if (entry.isDirectory()) walk(rel)
        else if (entry.name.endsWith(".md")) files.push({ path: rel, text: readFileSync(join(root, rel), "utf8") })
      }
    }
    walk("docs")
  }
  return files
}

export function assertNonVacuousPolicyScan(scan) {
  if (scan.filesScanned === 0) {
    throw new PolicyScopeError("扫过 0 个文档：0-scan 不能判 PASS。")
  }
  if (scan.linesScanned === 0) {
    throw new PolicyScopeError("扫过 0 行文本：0-scan 不能判 PASS。")
  }
}

export function formatPolicyReport(report) {
  const lines = []
  lines.push(`  策略 v${report.policyVersion} · registry ${report.registryName} v${report.registryVersion} · 受管面 ${report.managedSurfaces} 个`)
  lines.push(`  schema 断言 ${report.schemaChecks} 条（关键值 ${report.keyValueChecks} 条）· 管理块锚点 ${report.anchorsChecked} 条`)
  lines.push(`  文档扫描 ${report.filesScanned} 个文件 / ${report.linesScanned} 行`)
  lines.push(`  管理块：${report.blockStatus}`)
  lines.push(`  模型路由：${report.route}`)
  lines.push(`  QA 端口：${report.portStatus}`)
  lines.push(`  Registry：${report.registryStatus}`)
  lines.push(`  CI：${report.ciStatus}`)
  for (const warning of report.warnings ?? []) lines.push(`  ⚠ [${warning.code}] ${warning.message}`)
  return lines.join("\n")
}
