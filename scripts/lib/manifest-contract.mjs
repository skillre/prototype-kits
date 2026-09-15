/**
 * Manifest / Registry 一致性契约 —— Kits v0.2 · Phase B（K1 / K2 / K6 / K7）。
 *
 * ===========================================================================
 * 它解决的问题
 * ===========================================================================
 * v0.1.1 里这些字段**看起来是契约，实际上只是字符串**：
 *
 *   mobileCompatible: true           —— 没人定义 true 是什么意思
 *   avoidFor: ["移动端为主的产品"]     —— 自由散文，typo 与真值一样通过
 *   effects: ["technical-grid"]      —— registry 里根本没有这个资产
 *   effects: ["animated-grid"]       —— 它的 registry type 是 component，不是 effect
 *   （darkDirection 完全不存在）
 *
 * 它们能一路活到 CI 绿，是因为 **manifest 的引用从不与 registry 比对**，
 * 而 `registry/assets.schema.json` 从来没有被真正求值过（仓库里没有 validator）。
 *
 * ===========================================================================
 * 单一事实来源（Phase B 的核心要求）
 * ===========================================================================
 *   registry/assets.schema.json        ← **词汇表**（枚举、类型、description）
 *   scripts/lib/manifest-contract.mjs  ← **执行**（读上面的枚举做判定）
 *   scripts/registry-audit.mjs         ← 报告（调同一个模块，不再自己写一套）
 *   tests/manifest-contract.spec.ts    ← 门禁（同一模块；并钉住 schema↔执行一致）
 *
 * 本模块**不重复写枚举字面量**：它从 schema 读 `$defs`。所以「schema 说合法、
 * 执行说非法」这种两套真相在结构上不可能出现 —— 有一条测试专门钉这一点。
 *
 * ===========================================================================
 * 「manifest」不是一个东西：四种资产，四种形状
 * ===========================================================================
 *   style / component  → 自己的 manifest.json（就是这个资产）
 *   effect             → 三个效果**共用** effects/manifest.json，
 *                        per-asset 数据是它 effects[] 里的那一项
 *   package            → package.json（name / version 必须与 registry 一致）
 *   skill              → manifest: null，没有清单可核对
 * 所以 `resolveAsset()` 先回答「这个资产的清单节点在哪」，再谈字段 ——
 * 拿 aggregate 当成 per-asset 清单去查字段，正是 K6 里那类假阳性/假阴性的来源。
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  ASSET_TYPES,
  deriveMobileState,
  isExtensionTag,
  PACK_ROLE_FIELDS,
  parsePackRole,
  REFERENCE_FIELDS,
} from "./fit-semantics.mjs";

// 纯语义从这里转出：调用方（CLI / 测试）只需要记一个 import 站点。
export {
  ASSET_TYPES,
  deriveMobileState,
  isExtensionTag,
  PACK_ROLE_FIELDS,
  parsePackRole,
  REFERENCE_FIELDS,
};

const SCHEMA_PATH = "registry/assets.schema.json";
const REGISTRY_PATH = "registry/assets.json";

const readJson = (abs) => JSON.parse(readFileSync(abs, "utf8"));

/** 读 registry 本体。audit 与测试都从这里入口，避免各自 JSON.parse 一份。 */
export function loadRegistry(root) {
  return readJson(path.join(root, REGISTRY_PATH));
}

/** 从 JSON Schema 的 $defs 里取枚举 —— 词汇表只有这一处。 */
export function loadVocabularies(root) {
  const schema = readJson(path.join(root, SCHEMA_PATH));
  const defs = schema.$defs ?? {};
  const enumOf = (name) => {
    const node = defs[name];
    if (!node) throw new Error(`${SCHEMA_PATH} 里没有 $defs.${name} —— 词汇表缺失`);
    const values = node.oneOf ?? [node];
    const found = values.find((v) => Array.isArray(v.enum));
    if (!found) throw new Error(`${SCHEMA_PATH}: $defs.${name} 没有 enum`);
    return found.enum;
  };
  return {
    schema,
    fitTags: enumOf("fitTag").filter((v) => typeof v === "string"),
    fitTagExtensionPattern: "^x-[a-z0-9]+(-[a-z0-9]+)*$",
    mobileValues: defs.mobileCompatibility.enum,
    darkStrategies: defs.darkStrategy.enum,
    darkApproaches: defs.darkApproach.enum,
    contrastTarget: defs.contrastTarget,
    packRoles: enumOf("packRole"),
  };
}



/* -------------------------------------------------------------------------- */
/* 清单定位                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * 找出该资产的清单节点。四种形状见文件头：
 *
 * @returns {{ kind: "pack"|"component"|"effect"|"package"|"none", abs: string|null,
 *             manifest: any|null, node: any|null, reason?: string }}
 */
export function resolveAsset(root, asset) {
  if (typeof asset.manifest !== "string" || !asset.manifest) {
    return { kind: "none", abs: null, manifest: null, node: null };
  }
  const abs = path.join(root, asset.manifest);
  if (!existsSync(abs)) {
    return { kind: "none", abs, manifest: null, node: null, reason: "manifest-not-found" };
  }
  const manifest = readJson(abs);

  if (asset.type === "style" || asset.type === "component") {
    return { kind: asset.type === "style" ? "pack" : "component", abs, manifest, node: manifest };
  }
  if (asset.type === "effect") {
    const list = Array.isArray(manifest.effects) ? manifest.effects : [];
    const node = list.find((item) => item?.id === asset.id) ?? null;
    return { kind: "effect", abs, manifest, node, reason: node ? undefined : "not-in-aggregate" };
  }
  if (asset.type === "package") {
    return { kind: "package", abs, manifest, node: manifest };
  }
  return { kind: "none", abs, manifest, node: null };
}

/** pack 的 tokens.css 里真实声明的 CSS 自定义属性名（K1 核对 slots 用）。 */
export function declaredSlots(root, asset, manifest) {
  const rel = manifest?.tokens?.cssVariables ?? "tokens.css";
  const abs = path.join(root, path.dirname(asset.manifest), rel);
  if (!existsSync(abs)) return null;
  const names = new Set();
  for (const match of readFileSync(abs, "utf8").matchAll(/(^|\s)(--kits-[a-z0-9-]+)\s*:/g)) {
    names.add(match[2]);
  }
  return names;
}

/* -------------------------------------------------------------------------- */
/* 判定                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 对整个 registry（含它指向的清单）做一致性判定。
 *
 * 每条 finding：`{ level: "error"|"warn"|"info", code, where, message }`。
 * error = 必须失败；warn = 说出来但不阻塞；info = 现状报告（例如「未声明暗色方向」）。
 *
 * @param {{ root: string, registry?: any }} args
 */
export function checkRegistry({ root, registry = loadRegistry(root) }) {
  const vocab = loadVocabularies(root);
  const findings = [];
  const push = (level, code, where, message) => findings.push({ level, code, where, message });

  /**
   * 计数器在最后统一从同一批输入里数出来（`summarize`）：审计必须能说出
   * 「我到底检查了什么」——「0 处发现」在「什么都没查」和「全部通过」时长得一样。
   */
  const byId = new Map(registry.assets.map((asset) => [asset.id, asset]));
  const idOfType = (type) => new Set(registry.assets.filter((a) => a.type === type).map((a) => a.id));
  const resolved = new Map();

  for (const asset of registry.assets) {
    const place = resolveAsset(root, asset);
    resolved.set(asset.id, place);

    if (place.reason === "manifest-not-found") {
      push("error", "manifest/missing-file", `${asset.id}.manifest`, `清单文件不存在：${asset.manifest}`);
    }
    if (place.reason === "not-in-aggregate") {
      push(
        "error",
        "effect/not-in-aggregate",
        `${asset.id}`,
        `${asset.manifest} 的 effects[] 里没有 id = ${asset.id} 的条目 —— registry 登记了一个聚合清单里不存在的效果`,
      );
    }

    /* ---- K7 · taxonomy：typo 与冲突 ---------------------------------- */
    checkFitTags({ subject: asset, where: asset.id, vocab, push });
    /* ---- K2 · mobileCompatible -------------------------------------- */
    if (!vocab.mobileValues.includes(asset.mobileCompatible)) {
      push(
        "error",
        "mobile/unknown-value",
        `${asset.id}.mobileCompatible`,
        `\`${JSON.stringify(asset.mobileCompatible)}\` 不是合法取值（schema 允许 ${vocab.mobileValues
          .map((v) => JSON.stringify(v))
          .join(" / ")}）`,
      );
    }

    if (asset.mobileCompatible === "fallback-only") {
      const fallback = place.node?.mobileFallback;
      if (!fallback || typeof fallback !== "object") {
        push(
          "error",
          "mobile/fallback-missing",
          `${asset.id}`,
          "声明 fallback-only，但清单里没有 mobileFallback —— 那就没有可依赖的降级行为",
        );
      } else if (fallback.noContentLoss !== true) {
        push(
          "error",
          "mobile/fallback-lossy",
          `${asset.id}`,
          "fallback-only 要求 mobileFallback.noContentLoss === true（否则移动端是内容损失，不是降级）",
        );
      }
      if (Array.isArray(asset.recommendedFor) && asset.recommendedFor.includes("mobile")) {
        push(
          "error",
          "mobile/tag-conflict",
          `${asset.id}`,
          "mobileCompatible = fallback-only（只能在「能力关闭」的降级下用）却把 mobile 写进 recommendedFor —— 两处语义互斥",
        );
      }
    }

    /* ---- K7 · 标签出现在 registry 与 manifest 两处，必须逐字一致 ------- */
    if (place.node && (place.kind === "pack" || place.kind === "component")) {
      checkFitMirror({ asset, manifest: place.manifest, vocab, push });
      checkMobileMirror({ asset, manifest: place.manifest, push });
    }

    checkKind({ root, asset, place, byId, vocab, registry, push });
  }

  /* ---- 聚合清单的 reserved[]：占位 id 不得已经在册 -------------------- */
  const effectsPlace = resolveAsset(root, { type: "effect", manifest: "effects/manifest.json" });
  const reserved = effectsPlace.manifest?.reserved ?? [];
  for (const item of reserved) {
    if (byId.has(item.id)) {
      push(
        "error",
        "effect/reserved-registered",
        "effects/manifest.json#reserved",
        `\`${item.id}\` 已登记进 registry，却仍留在 reserved[]（占位）里 —— 实现落地时两处必须同时改`,
      );
    }
  }

  return { findings, vocab, byId, idOfType, resolved, reserved, stats: summarize(registry, resolved, reserved) };
}

/**
 * 「你到底检查了什么」—— 从同一批输入里数出来。
 *
 * 这些数字不是装饰：`registry-audit` 会把它们打出来，所以「0 处发现」与
 * 「其实什么都没查」在输出上不再长得一样。（判定路径与这里的计数都只由同一批
 * 字段的存在性驱动，因此不会出现「数了但没查」。）
 */
export function summarize(registry, resolved, reserved = []) {
  const places = [...resolved.values()];
  const manifests = places.map((place) => place.manifest).filter(Boolean);
  const nodes = places.map((place) => place.node).filter(Boolean);
  const list = (value) => (Array.isArray(value) ? value : []);

  let referenceLists = 0;
  let referenceIds = 0;
  let roleAssignments = 0;
  for (const place of places) {
    if (place.kind === "pack" || place.kind === "component") {
      for (const field of Object.keys(REFERENCE_FIELDS)) {
        const values = place.manifest?.[field];
        if (values === undefined) continue;
        referenceLists += 1;
        referenceIds += list(values).length;
      }
      roleAssignments += Object.keys(place.manifest?.usedByStylePacks ?? {}).length;
    }
  }

  const countTags = (subject) => list(subject.recommendedFor).length + list(subject.avoidFor).length;
  const byKind = { pack: 0, component: 0, effect: 0, package: 0, none: 0 };
  for (const place of places) byKind[place.kind] += 1;

  const packs = places.filter((place) => place.kind === "pack");
  // 三个 effect 共用同一份聚合清单 —— 按文件去重，否则会把 3 个数成 9。
  const aggregates = new Map();
  for (const place of places) {
    if (place.kind === "effect" && place.manifest) aggregates.set(place.abs, place.manifest);
  }
  const mobile = {};
  for (const asset of registry.assets) {
    const state = deriveMobileState(asset);
    mobile[state] = (mobile[state] ?? 0) + 1;
  }

  return {
    assets: registry.assets.length,
    kinds: byKind,
    manifestsResolved: nodes.length,
    referenceLists,
    referenceIds,
    roleAssignments,
    registryTagValues: registry.assets.reduce((sum, asset) => sum + countTags(asset), 0),
    manifestTagValues: manifests.reduce((sum, manifest) => sum + countTags(manifest), 0),
    notes: manifests.reduce(
      (sum, manifest) => sum + list(manifest.recommendedForNotes).length + list(manifest.avoidForNotes).length,
      0,
    ),
    mobileMirrors: nodes.filter((node) => node.mobileCompatible !== undefined).length,
    packagesChecked: places.filter((place) => place.kind === "package").length,
    effectsInAggregate: [...aggregates.values()].reduce((sum, manifest) => sum + list(manifest.effects).length, 0),
    reservedIds: reserved.length,
    darkDeclared: packs.filter((place) => place.manifest?.darkDirection).length,
    darkUndeclared: packs.filter((place) => !place.manifest?.darkDirection).length,
    darkSlots: packs.reduce((sum, place) => sum + list(place.manifest?.darkDirection?.slots).length, 0),
  };
}

/** 覆盖度下限：这是**产品策略**，不是结构一致性 —— 所以单独一个函数、单独调用。 */
export const COVERAGE_FLOOR = { style: 3, component: 5 };

/**
 * 覆盖度（沿用 v0.1.1 的期望值）。
 *
 * 刻意与 `checkRegistry` 分开：结构一致性对**任意** registry 都成立，而「至少三套 pack /
 * 五个组件」是对这一个仓库的承诺。混在一起会让每个 fixture 都因为「只有 1 套 pack」变红，
 * 于是真正的缺陷被噪声盖住。
 *
 * @param {any} registry
 * @returns {Array<{level: string, code: string, where: string, message: string}>}
 */
export function checkCoverage(registry) {
  const findings = [];
  for (const [type, floor] of Object.entries(COVERAGE_FLOOR)) {
    const count = registry.assets.filter((asset) => asset.type === type && asset.status === "approved").length;
    if (count < floor) {
      findings.push({
        level: "error",
        code: `coverage/${type === "style" ? "styles" : "components"}`,
        where: "registry",
        message: `approved ${type === "style" ? "Style Pack" : "Signature Component"} 只有 ${count} 个（期望 ≥ ${floor}）`,
      });
    }
  }
  return findings;
}

/**
 * K7 · 一组适配标签的合法性 + 自相矛盾。registry 与 manifest 两处都用同一个函数 ——
 * 「同一份规则执行两遍」不是重复，而是刻意：两处数据必须各自合法，且彼此一致。
 */
function checkFitTags({ subject, where, vocab, push }) {
  for (const field of ["recommendedFor", "avoidFor"]) {
    const values = subject[field];
    if (values === undefined) continue;
    if (!Array.isArray(values)) {
      push("error", "fit/not-array", `${where}.${field}`, `${field} 必须是数组`);
      continue;
    }
    for (const value of values) {
      if (vocab.fitTags.includes(value) || isExtensionTag(value)) continue;
      push(
        "error",
        "fit/unknown-tag",
        `${where}.${field}`,
        `\`${value}\` 不在适配维度枚举里（见 registry/README.md 的「适配维度」表）。` +
          "要扩展请用 x- 前缀，不要写自由文本。",
      );
    }
  }
  const recommended = Array.isArray(subject.recommendedFor) ? subject.recommendedFor : [];
  const avoid = Array.isArray(subject.avoidFor) ? subject.avoidFor : [];
  const conflict = recommended.filter((tag) => avoid.includes(tag));
  if (conflict.length) {
    push(
      "error",
      "fit/conflict",
      where,
      `同一个适配维度同时出现在 recommendedFor 与 avoidFor：${conflict.join(", ")} —— ` +
        "推荐与回避同一件事没有可操作意义（mobileCompatible 是另一维度，不在此列）",
    );
  }
}

/**
 * K7 · registry 的标签是**投影**：必须与 manifest 里的标签逐字一致。
 * 人读的散文只住在 manifest（`*Notes`），registry 不放散文 —— 索引与叙述各归其位。
 */
function checkFitMirror({ asset, manifest, vocab, push }) {
  checkFitTags({ subject: manifest, where: asset.manifest, vocab, push });
  for (const [field, notesField] of [
    ["recommendedFor", "recommendedForNotes"],
    ["avoidFor", "avoidForNotes"],
  ]) {
    const registryTags = Array.isArray(asset[field]) ? asset[field] : [];
    const manifestTags = Array.isArray(manifest[field]) ? manifest[field] : [];
    if (registryTags.join(",") !== manifestTags.join(",")) {
      push(
        "error",
        "fit/registry-manifest-drift",
        `${asset.id}.${field}`,
        `registry=[${registryTags.join(", ")}] manifest=[${manifestTags.join(", ")}] —— ` +
          "同一组标签两处不一致，产品按哪一处决策都是错的",
      );
    }
    const notes = manifest[notesField];
    if (manifestTags.length > 0 && (!Array.isArray(notes) || notes.length === 0)) {
      push(
        "warn",
        "fit/notes-missing",
        `${asset.manifest}#${notesField}`,
        `只有标签没有说明文字：人读的选择依据丢了。把 v0.1.1 里的散文原样放进 ${notesField}`,
      );
    }
  }
}

/** K2 · registry 与 manifest 的 mobileCompatible 必须一致（今天无人核对）。 */
function checkMobileMirror({ asset, manifest, push }) {
  if (manifest.mobileCompatible === undefined) return;
  if (manifest.mobileCompatible === asset.mobileCompatible) return;
  push(
    "error",
    "mobile/registry-manifest-drift",
    `${asset.id}.mobileCompatible`,
    `registry = \`${JSON.stringify(asset.mobileCompatible)}\`，${asset.manifest} = ` +
      `\`${JSON.stringify(manifest.mobileCompatible)}\` —— 兼容性声明两处不一致`,
  );
}

/** 按清单形状分派的检查。 */
function checkKind({ root, asset, place, byId, vocab, registry, push }) {
  if (place.kind === "pack" || place.kind === "component") {
    checkReferences({ asset, manifest: place.manifest, byId, push });
    checkUsedByStylePacks({ root, asset, manifest: place.manifest, byId, registry, vocab, push });
  }
  if (place.kind === "pack") {
    checkRegistryManifestList({ asset, manifest: place.node, push });
    checkDarkDirection({ root, asset, manifest: place.manifest, dark: place.manifest.darkDirection, vocab, push });
  }
  if (place.kind === "effect" && place.node) {
    checkEffectNode({ asset, node: place.node, byId, push });
    const required = place.manifest?.contract?.requiredFields ?? [];
    for (const field of required) {
      if (place.node[field] === undefined) {
        push(
          "error",
          "effect/required-field",
          `${asset.manifest}#${asset.id}`,
          `${field} 缺失 —— 它是 effects/manifest.json 的 contract.requiredFields 里自己声明的必填项`,
        );
      }
    }
  }
  if (place.kind === "package" && place.node) {
    if (place.node.name !== asset.name) {
      push(
        "error",
        "package/name-drift",
        `${asset.manifest}#name`,
        `package.json 的 name = \`${place.node.name}\`，registry 的 name = \`${asset.name}\` —— 同一份包名两处不一致`,
      );
    }
    if (place.node.version !== asset.version) {
      push(
        "error",
        "package/version-drift",
        `${asset.manifest}#version`,
        `package.json 的 version = \`${place.node.version}\`，registry 的 version = \`${asset.version}\` —— 版本漂移会让安装方拿到错的包`,
      );
    }
  }
}

/** K6 · 引用字段：必须存在，且类型正确。 */
function checkReferences({ asset, manifest, byId, push }) {
  for (const [field, expectedType] of Object.entries(REFERENCE_FIELDS)) {
    const values = manifest[field];
    if (values === undefined) continue;
    const where = `${asset.manifest}#${field}`;
    if (!Array.isArray(values)) {
      push("error", "ref/not-array", where, `${field} 必须是数组`);
      continue;
    }
    for (const id of values) {
      const target = byId.get(id);
      if (!target) {
        push("error", "ref/missing", where, `\`${id}\` 不在 registry 里（未登记即引用是 policy 明令禁止的）`);
        continue;
      }
      if (target.type !== expectedType) {
        push(
          "error",
          "ref/wrong-type",
          where,
          `\`${id}\` 的 registry type 是 \`${target.type}\`，而 \`${field}\` 只允许 \`${expectedType}\` ` +
            "—— 字段名写 effect 不等于它真是 effect",
        );
      }
    }
    const dupes = values.filter((id, index) => values.indexOf(id) !== index);
    if (dupes.length) {
      push("error", "ref/duplicate", where, `重复引用：${[...new Set(dupes)].join(", ")}`);
    }
  }
}

/** K6b · registry 的 signatureComponents 与 pack manifest 必须逐字一致。 */
function checkRegistryManifestList({ asset, manifest, push }) {
  if (!Array.isArray(asset.signatureComponents)) return;
  const registryList = [...asset.signatureComponents].sort();
  const manifestList = [...(manifest.signatureComponents ?? [])].sort();
  if (registryList.join(",") !== manifestList.join(",")) {
    push(
      "error",
      "ref/registry-manifest-drift",
      `${asset.id}.signatureComponents`,
      `registry 与 ${asset.manifest} 不一致：registry=[${registryList.join(", ")}] manifest=[${manifestList.join(", ")}]`,
    );
  }
}

/**
 * K6c · 组件 `usedByStylePacks` ↔ pack 的三个列表，双向一致。
 *
 * 这是一处**两套真相**：组件说「我在 cinematic 是 signature」，cinematic 说
 * 「spotlight-surface 是我的 signature」—— 谁都没核对过对方。判定标准只有一条：
 * 角色词必须与 pack 列表的归属完全对应（在 A 列表就不能同时出现在 B 列表）。
 */
function checkUsedByStylePacks({ root, asset, manifest, byId, registry, vocab, push }) {
  const map = manifest.usedByStylePacks;
  if (map === undefined) return;
  const where = `${asset.manifest}#usedByStylePacks`;
  if (typeof map !== "object" || map === null || Array.isArray(map)) {
    push("error", "usedby/not-object", where, "usedByStylePacks 必须是 `{ packId: role }` 对象");
    return;
  }

  for (const [packId, raw] of Object.entries(map)) {
    const pack = byId.get(packId);
    if (!pack) {
      push("error", "usedby/unknown-pack", where, `\`${packId}\` 不是 registry 里的风格包`);
      continue;
    }
    const { role } = parsePackRole(raw);
    if (!vocab.packRoles.includes(role)) {
      push(
        "error",
        "usedby/unknown-role",
        `${where}.${packId}`,
        `\`${String(raw).slice(0, 40)}\` 的角色词不是 ${vocab.packRoles.join(" / ")} 之一（` +
          "这些程序拼出的字符串不是契约，只有角色词是)",
      );
      continue;
    }
    const place = resolveAsset(root, pack);
    const fields = Object.entries(PACK_ROLE_FIELDS);
    for (const [candidateRole, field] of fields) {
      const list = place?.node?.[field] ?? [];
      const listed = Array.isArray(list) && list.includes(asset.id);
      if (candidateRole === role && !listed) {
        push(
          "error",
          "usedby/pack-does-not-list",
          `${where}.${packId}`,
          `说自己在 ${packId} 是 ${role}，但 styles/${packId}/manifest.json 的 ${field} 里没有它`,
        );
      }
      if (candidateRole !== role && listed) {
        push(
          "error",
          "usedby/role-mismatch",
          `${where}.${packId}`,
          `说自己在 ${packId} 是 ${role}，但 styles/${packId}/manifest.json 把它列在 ${field} —— ` +
            "同一件事两处写法不同，产品按哪一处决策都是错的",
        );
      }
    }
  }

  // 反向：pack 列了它，它却没说 —— 会静默漏掉某个 pack 的角色信息。
  for (const pack of registry.assets.filter((a) => a.type === "style")) {
    const place = resolveAsset(root, pack);
    for (const field of Object.values(PACK_ROLE_FIELDS)) {
      const list = place.node?.[field];
      if (!Array.isArray(list) || !list.includes(asset.id)) continue;
      if (map[pack.id] === undefined) {
        push(
          "error",
          "usedby/missing-pack",
          where,
          `${pack.id} 的 ${field} 里列了本组件，但这里没有 ${pack.id} 的角色词 —— 反向缺一条`,
        );
      }
    }
  }
}

/**
 * K1 · darkDirection 判定。
 *
 * `darkDirection` 是**可选**的：不声明 = 合法的旧状态（报 info，不算错）。
 * 但一旦声明，它就必须是可执行的 —— strategy 合法、product-authored 必须给出
 * approach / contrastTarget / slots，且 slots 必须是该 pack tokens.css 里真实存在的变量。
 */
function checkDarkDirection({ root, asset, manifest, dark, vocab, push }) {
  const where = `${asset.manifest}#darkDirection`;
  if (dark === undefined) {
    push(
      "info",
      "dark/undeclared",
      where,
      "未声明暗色方向 —— 合法（旧状态），但产品拿不到可执行指引：" +
        "它只知道「颜色可以覆盖」，不知道往哪个方向覆盖、底线在哪里",
    );
    return;
  }
  if (typeof dark !== "object" || dark === null || Array.isArray(dark)) {
    push("error", "dark/not-object", where, "darkDirection 必须是对象");
    return;
  }
  if (!vocab.darkStrategies.includes(dark.strategy)) {
    push(
      "error",
      "dark/unknown-strategy",
      `${where}.strategy`,
      `\`${dark.strategy}\` 不是合法 strategy（schema 允许 ${vocab.darkStrategies.join(" / ")}）`,
    );
  }
  if (dark.approach !== undefined && !vocab.darkApproaches.includes(dark.approach)) {
    push(
      "error",
      "dark/unknown-approach",
      `${where}.approach`,
      `\`${dark.approach}\` 不是合法 approach（schema 允许 ${vocab.darkApproaches.join(" / ")}）`,
    );
  }
  if (dark.strategy === "product-authored") {
    if (dark.approach === undefined) push("error", "dark/approach-required", where, "product-authored 必须给出 approach");
    if (dark.contrastTarget === undefined) {
      push("error", "dark/target-required", where, "product-authored 必须给出 contrastTarget");
    }
    if (!Array.isArray(dark.slots) || dark.slots.length === 0) {
      push("error", "dark/slots-required", where, "product-authored 必须给出 slots（产品到底允许覆盖哪些槽位）");
    }
  }
  if (dark.contrastTarget !== undefined) {
    const target = dark.contrastTarget;
    for (const [field, floor] of Object.entries({ normalText: 4.5, largeText: 3 })) {
      const value = target?.[field];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        push("error", "dark/target-invalid", `${where}.contrastTarget.${field}`, `对比度目标必须是数字，得到 ${JSON.stringify(value)}`);
      } else if (value < floor) {
        push(
          "error",
          "dark/target-too-low",
          `${where}.contrastTarget.${field}`,
          `${value} 低于 WCAG-AA 下限 ${floor}（可执行的对比度目标不允许低于无障碍底线）`,
        );
      }
    }
    const standards = vocab.contrastTarget?.properties?.standard?.enum ?? [];
    if (target?.standard !== undefined && !standards.includes(target.standard)) {
      push("error", "dark/target-invalid", `${where}.contrastTarget.standard`, `\`${target.standard}\` 不是 ${standards.join(" / ")}`);
    }
  }
  if (dark.slots !== undefined) {
    const declared = declaredSlots(root, asset, manifest);
    if (declared === null) {
      push("warn", "dark/slots-unverifiable", where, "读不到 tokens.css，无法核对 slots 是否真实存在（不当作通过）");
    } else {
      for (const slot of dark.slots) {
        if (!declared.has(slot)) {
          push("error", "dark/unknown-slot", `${where}.slots`, `\`${slot}\` 在该 pack 的 tokens.css 里没有声明 —— typo 不允许静默通过`);
        }
      }
    }
  }
}

/** effect 的 per-asset 节点：pack 引用、id 自洽。 */
function checkEffectNode({ asset, node, byId, push }) {
  const where = `${asset.manifest}#effects[${asset.id}]`;
  if (node.id !== asset.id) {
    push("error", "effect/id-mismatch", where, `聚合清单里这一项的 id = \`${node.id}\`，与 registry 的 \`${asset.id}\` 不一致`);
  }
  if (node.pack !== undefined) {
    const pack = byId.get(node.pack);
    if (!pack) {
      push("error", "effect/unknown-pack", where, `所属 pack \`${node.pack}\` 不在 registry 里`);
    } else if (pack.type !== "style") {
      push("error", "effect/pack-wrong-type", where, `所属 pack \`${node.pack}\` 的 type 是 \`${pack.type}\`，不是 style`);
    }
  }
}

/** 人类可读的报告片段（audit 用）。 */
export function formatFinding(finding) {
  const mark = finding.level === "error" ? "✗" : finding.level === "warn" ? "!" : "i";
  return `  ${mark} [${finding.code}] ${finding.where} — ${finding.message}`;
}
