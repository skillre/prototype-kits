/**
 * kits.lock.json 的读写。
 *
 * 它回答四个问题：
 *   1. 我装了什么？（assets + version）
 *   2. 从哪装的？（source.kitsCommit）
 *   3. 装完之后**长什么样**？（files[].checksum —— 用来发现被手工改过的托管文件）
 *   4. 装到哪、怎么装？（layout；产品可能把托管区放在别处）
 *
 * 为什么 checksum 要记到**每个文件**而不是整包：
 * 「托管区被手工改过」这件事必须以文件为单位定位，否则 doctor 只能说
 * "有东西变了"，使用者无从判断是 Kits 升级带来的还是自己昨天改的。
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { CODES, fail } from "./errors.mjs";

export const SCHEMA_VERSION = 1;

/** 相对产品根的默认布局。与 installer.mjs 的常量保持一致。 */
export const DEFAULT_LAYOUT = {
  installedRoot: "lib/kits/installed",
  adapterRoot: "lib/kits/adapters",
  agentRoot: "lib/kits/.kits",
  lockFile: "lib/kits/kits.lock.json",
};

/**
 * @param {string} productRoot
 * @param {typeof DEFAULT_LAYOUT} layout
 */
export function readLock(productRoot, layout = DEFAULT_LAYOUT) {
  const file = path.join(productRoot, layout.lockFile);
  if (!existsSync(file)) return null;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    fail(
      CODES.LOCK_INVALID,
      `${layout.lockFile} 不是合法 JSON：${error.message}`,
      "如果它被截断，删掉它并重新 `kits add`。",
    );
  }
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    fail(
      CODES.LOCK_INVALID,
      `kits.lock.json 的 schemaVersion 是 ${parsed.schemaVersion}，本版 Installer 只认识 ${SCHEMA_VERSION}`,
      "见 docs/distribution.md 的版本策略。",
    );
  }
  return parsed;
}

export function writeLock(productRoot, layout, lock) {
  const file = path.join(productRoot, layout.lockFile);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  return file;
}

/**
 * 由安装计划组装一份 lock。
 *
 * @param {object} args
 * @param {import('./installer.mjs').Plan} plan
 * @param {any} registry
 * @param {{ commit: string|null, dirty: boolean }} source
 * @param {typeof DEFAULT_LAYOUT} layout
 * @param {string} installedAt ISO 时间戳
 * @param {Array<{src:string,dest:string,checksum:string}>} written
 */
export function buildLock({ plan, registry, source, layout, installedAt, written }) {
  const byAsset = new Map();
  for (const asset of plan.assets) {
    byAsset.set(asset.id, {
      id: asset.id,
      type: asset.type,
      version: asset.version,
      status: asset.status,
      apiVersion: asset.apiVersion ?? null,
      /** 该资产（含其依赖）带来的文件，按安装后相对路径排序。 */
      files: written
        .filter((f) => f.assetId === asset.id)
        .map((f) => ({ path: f.dest, checksum: f.checksum })),
    });
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    registryVersion: registry.registryVersion ?? "unknown",
    generatedAt: installedAt,
    source: {
      kind: "source-installation",
      repo: "prototype-kits",
      commit: source.commit,
      dirty: source.dirty,
    },
    layout,
    assets: [...byAsset.values()].sort((a, b) => a.id.localeCompare(b.id)),
    dependencies: plan.edges,
    /** 托管区内**全部**文件（含被依赖的 contracts / react-utils 包）。 */
    files: written
      .map((f) => ({ path: f.dest, checksum: f.checksum, assetId: f.assetId }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  };
}
