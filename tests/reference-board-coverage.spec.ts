/**
 * 参考板覆盖 —— 静态门禁。
 *
 * ===========================================================================
 * 这组测试的存在理由
 * ===========================================================================
 * 第四套 pack `console` 交付时，pack 本身齐了（tokens / manifest / motion /
 * SKILL / README），**参考板没有**：`references/` 下只有 editorial / cinematic /
 * instrument 三份，`references/README.md` 的目录表也还写着三行。
 *
 * 五门全绿 —— 因为**没有任何一条门禁的名单里包含参考板**。这和 Playground 那次
 * 三列写死是同一个形状：缺口不在"没人检查"，而在"检查的名单和权威的名单不是同一份"。
 *
 * 参考板不是资产（它不进 `registry/assets.json`），但它是**方向的可追溯性**：
 * 读参考 → 写 Manifest → 才允许写代码，这条顺序写在 `references/README.md` 里。
 * 一套 pack 没有参考板，"这个方向从哪来"就只活在某个人当时脑子里。
 *
 * 所以这里把「registry 里已批准的 style pack ↔ 参考板」这条链路钉住：
 *   ① 每一套 approved pack 都有 `references/<id>/README.md`；
 *   ② `references/README.md` 的目录表里有它的行（否则索引会继续骗人）；
 *   ③ 板子不是空壳（有实质内容，不是为了让测试变绿而建的文件）；
 *   ④ 名单来自 registry，不来自本文件里抄的第二份清单。
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");

const readText = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

type RegistryAsset = { id: string; type: string; status: string };

const registry = JSON.parse(readText("registry/assets.json")) as {
  assets: RegistryAsset[];
};

/** 权威名单：registry 里已批准的 style 资产，保持登记顺序。 */
const APPROVED_PACKS = registry.assets.filter(
  (asset) => asset.type === "style" && asset.status === "approved",
);

const INDEX = "references/README.md";

/** 参考板的最小体量：低于这个数基本就是"为了过测试而建的空壳"。 */
const MIN_BOARD_BYTES = 800;

/** 板子路径（`references/<id>/README.md`）。 */
const boardPathOf = (id: string) => `references/${id}/README.md`;

/**
 * 找出没有参考板的 pack。
 *
 * 抽成函数是为了让它**可以被反证**：下面有一条测试拿一个不存在的 id 调它，
 * 要求它真的把那个 id 报成缺失 —— 否则"检查通过"可能只是因为它什么都没查。
 */
function packsWithoutBoard(ids: readonly string[], indexText: string): string[] {
  return ids.filter((id) => {
    const board = boardPathOf(id);
    if (!existsSync(path.join(ROOT, board))) return true;
    if (statSync(path.join(ROOT, board)).size < MIN_BOARD_BYTES) return true;
    // 目录表里的行：`| \`<id>/\` | … |`（允许反引号，也允许不带）
    return !new RegExp(`\\|\\s*\`?${id}/?\`?\\s*\\|`).test(indexText);
  });
}

describe("参考板覆盖 registry 里的每一套已批准 style pack", () => {
  it("前置：registry 的名单是真的读到了（空名单会让下面每一条空跑成绿）", () => {
    expect(APPROVED_PACKS.length).toBeGreaterThan(1);
    for (const pack of APPROVED_PACKS) expect(pack.id).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it("检查器本身有牙：一个不存在的 pack 会被报成缺失", () => {
    const indexText = readText(INDEX);
    expect(packsWithoutBoard(["definitely-not-a-pack"], indexText)).toEqual([
      "definitely-not-a-pack",
    ]);
    // 反向对照：真实存在的 pack 不会被误报。
    expect(packsWithoutBoard(APPROVED_PACKS.map((pack) => pack.id), indexText)).toEqual([]);
  });

  it("每一套 approved pack 都有参考板，且索引里有它那一行", () => {
    const indexText = readText(INDEX);
    const missing = packsWithoutBoard(
      APPROVED_PACKS.map((pack) => pack.id),
      indexText,
    );
    expect(
      missing,
      `这些 pack 缺参考板或缺索引行：${missing.join(", ")}\n` +
        "新增一套 pack = 同时交付 references/<id>/README.md，并把它加进 references/README.md 的目录表。",
    ).toEqual([]);
  });

  it("索引表里的每一行都指向一个真实存在的板子（索引不能说谎）", () => {
    const indexText = readText(INDEX);
    const listed = [...indexText.matchAll(/\|\s*`?([a-z][a-z0-9-]*)\/`?\s*\|/g)]
      .map((match) => match[1])
      // 目录表之外的同形表格不参与判定：只认 references/<id>/ 真实存在的那些 + 被登记的 pack
      .filter((id) => APPROVED_PACKS.some((pack) => pack.id === id));
    expect(listed.sort()).toEqual(APPROVED_PACKS.map((pack) => pack.id).sort());
  });

  it("参考板不是资产：它不出现在 registry 里（登记表只登记能被产品引用的东西）", () => {
    const boardIdInRegistry = registry.assets.filter((asset) =>
      asset.id.startsWith("references"),
    );
    expect(boardIdInRegistry).toEqual([]);
    expect(readText(INDEX)).toContain("不是资产");
  });
});
