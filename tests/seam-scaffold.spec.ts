/**
 * K4 · 中性适配接缝（neutral adapter seam）—— Kits v0.2。
 *
 * ===========================================================================
 * 这个文件在守什么
 * ===========================================================================
 * v0.1.1 的适配层只生成资产名文件，于是产品代码只能写成：
 *
 *     import { DataCursor } from "@/lib/kits/adapters/data-cursor"
 *
 * —— 资产身份被焊进产品源码，"换资产不动产品代码"这个承诺当场变假。
 * 唯一的例外是 `style-pack.ts`（主 Style Pack 的稳定别名），证明机制可行、
 * 只是只做了一格。
 *
 * v0.2 把这一格推广成**可检查的机制**，并且明确 Kits **不猜角色**：
 * 哪个资产承担哪个语义角色是产品决策，Kits 的 metadata 里没有这个字段。
 * 它生成的是骨架（README + seam.json + _template.ts）与判定，不是映射。
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");
const CLI = path.join(ROOT, "packages", "cli", "kits.mjs");
const TMP = path.join(ROOT, "node_modules", ".cache", "kits-seam-tests");
const STRIP_ANSI = /\u001b\[[0-9;]*m/g;

const SEAM = "lib/kits/adapters/seam";

function makeProduct(name: string, files: Record<string, string> = {}) {
  const dir = path.join(TMP, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name,
        version: "0.0.0",
        private: true,
        dependencies: { react: "19.2.8", "react-dom": "19.2.8" },
        devDependencies: { "@types/react": "19.3.0", typescript: "5.9.3" },
      },
      null,
      2,
    ),
  );
  /*
   * 每个 fixture 都是一个**真有源码的产品**：否则 boundary 会（正确地）
   * 判成 vacuous-scan，于是别的检查的结论会被那一条失败盖住 ——
   * 测试要验的是接缝，不是"空产品也算过"。
   */
  const all = { "app/page.tsx": "export default function P() { return null }\n", ...files };
  for (const [rel, content] of Object.entries(all)) {
    const abs = path.join(dir, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return dir;
}

function runCli(args: string[], cwd = ROOT, allowFail = false) {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`.replace(STRIP_ANSI, "");
  if (result.status !== 0 && !allowFail) {
    throw new Error(`kits ${args.join(" ")} 失败（${result.status}）\n${out}`);
  }
  return { status: result.status ?? -1, out };
}

const install = (product: string, components = "data-cursor") =>
  runCli(["add", "--target", product, "--style", "cinematic", "--components", components]);

const doctor = (product: string) => runCli(["doctor", "--target", product], ROOT, true);

const read = (product: string, rel: string) => readFileSync(path.join(product, rel), "utf8");
const write = (product: string, rel: string, content: string) => {
  const abs = path.join(product, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content);
};
const seamJson = (product: string) =>
  JSON.parse(read(product, `${SEAM}/seam.json`)) as {
    seamVersion: string;
    bindings: Record<string, string>;
  };
const writeBindings = (product: string, bindings: Record<string, string>) => {
  const current = seamJson(product);
  write(product, `${SEAM}/seam.json`, `${JSON.stringify({ ...current, bindings }, null, 2)}\n`);
};

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe("K4 · 安装即生成接缝骨架", () => {
  it("seam 三个产物都生成，且 seam.json 是可解析、空的绑定表", () => {
    const product = makeProduct("scaffold");
    install(product);

    for (const file of ["README.md", "seam.json", "_template.ts"]) {
      expect(existsSync(path.join(product, SEAM, file)), `${SEAM}/${file}`).toBe(true);
    }
    const state = seamJson(product);
    expect(state.seamVersion).toBe("0.2.0");
    expect(state.bindings).toEqual({});
    // 骨架必须说清"角色由你决定"，而不是替产品填一个默认映射。
    expect(read(product, `${SEAM}/README.md`)).toContain("Kits 为什么替你选不了角色");
    expect(read(product, `${SEAM}/README.md`)).toContain("_template.ts");
  });

  it("keep-if-exists：产品改过的接缝文件在重装后原样保留", () => {
    const product = makeProduct("keep");
    install(product);
    const mine = "# 我自己的 seam 说明\n";
    write(product, `${SEAM}/README.md`, mine);

    install(product);
    expect(read(product, `${SEAM}/README.md`)).toBe(mine);
  });
});

describe("K4 · 只 import 中性角色文件（不出现资产 id）", () => {
  it("角色文件 + 绑定 → 产品代码零资产 id、零 installed/ 引用，doctor 通过", async () => {
    const product = makeProduct("neutral", {
      "app/page.tsx": 'import { Pointer } from "@/lib/kits/adapters/pointer"\nexport default function P() { return Pointer }\n',
      "lib/kits/adapters/pointer.tsx": '"use client"\nexport { DataCursor as Pointer, type DataCursorProps as PointerProps } from "./data-cursor"\n',
    });
    install(product);
    writeBindings(product, { pointer: "data-cursor" });

    // 产品代码里没有资产 id。
    const page = read(product, "app/page.tsx");
    expect(page).not.toContain("data-cursor");
    expect(page).toContain("adapters/pointer");

    const mod = (await import("../packages/cli/lib/boundary.mjs")) as unknown as {
      findManagedImports: (o: { productRoot: string }) => { scanned: number; violations: unknown[] };
    };
    const scan = mod.findManagedImports({ productRoot: product });
    expect(scan.scanned).toBeGreaterThan(0);
    expect(scan.violations).toEqual([]);

    const { status, out } = doctor(product);
    expect(status).toBe(0);
    expect(out).toMatch(/✓ seam/);
    expect(out).toContain("绑定 1 个角色 · 角色文件 1 个");
  });

  it("对照：不走接缝直接 import 资产文件仍然合规，但 import installed/ 一定违规", async () => {
    const direct = makeProduct("direct", {
      "app/page.tsx": 'import { DataCursor } from "@/lib/kits/adapters/data-cursor"\nexport default function P() { return DataCursor }\n',
    });
    install(direct);
    // 资产名文件在 adapters/ 里，是产品托管的：这条路径没有越界。
    expect(doctor(direct).out).toMatch(/✓ boundary/);

    const offender = makeProduct("offender", {
      "app/page.tsx": 'import { DataCursor } from "@/lib/kits/installed/data-cursor"\nexport default function P() { return DataCursor }\n',
    });
    install(offender);
    const result = doctor(offender);
    expect(result.status).toBe(1);
    expect(result.out).toMatch(/✗ boundary/);
    expect(result.out).toContain("绕过适配层");
  });

  it("资产名适配文件仍然存在于接缝后面（接缝不是替代品）", () => {
    const product = makeProduct("behind-seam");
    install(product);
    expect(existsSync(path.join(product, "lib/kits/adapters/data-cursor.tsx"))).toBe(true);
    expect(read(product, "lib/kits/adapters/data-cursor.tsx")).toContain("../installed/data-cursor");
  });
});

describe("K4 · 换资产不动产品代码", () => {
  it("换掉资产后：产品 import 路径与产品源码字节不变，只改接缝里那一行", async () => {
    const product = makeProduct("swap", {
      "app/page.tsx": 'import { Pointer } from "@/lib/kits/adapters/pointer"\nexport default function P() { return Pointer }\n',
      "lib/kits/adapters/pointer.tsx": '"use client"\nexport { DataCursor as Pointer, type DataCursorProps as PointerProps } from "./data-cursor"\n',
    });
    install(product, "data-cursor");
    writeBindings(product, { pointer: "data-cursor" });
    const pageBefore = read(product, "app/page.tsx");

    // 换资产：装另一个组件，并把绑定改成它。
    install(product, "insight-reveal");
    writeBindings(product, { pointer: "insight-reveal" });
    write(
      product,
      "lib/kits/adapters/pointer.tsx",
      '"use client"\nexport { InsightReveal as Pointer, type InsightRevealProps as PointerProps } from "./insight-reveal"\n',
    );

    // 产品代码一行没改，路径也没变。
    expect(read(product, "app/page.tsx")).toBe(pageBefore);

    const mod = (await import("../packages/cli/lib/boundary.mjs")) as unknown as {
      findManagedImports: (o: { productRoot: string }) => { violations: unknown[] };
    };
    expect(mod.findManagedImports({ productRoot: product }).violations).toEqual([]);

    const { status, out } = doctor(product);
    expect(status).toBe(0);
    expect(out).toContain("绑定 1 个角色");
    // 换资产留下的旧生成文件不是 Kits 托管物，也不在声明里 —— 必须被说出来，
    // 而不是当作没发生（Kits 永不删除产品目录下的文件）。
    expect(out).toContain("上一次安装留下的生成文件");
  });
});

describe("K4 · 声明与实现双向核对（三个缺口都要说出来）", () => {
  it("绑定指向不在本次安装里的资产 → FAIL", () => {
    const product = makeProduct("dangling");
    // 装 insight-reveal，却把 pointer 绑到 data-cursor —— 典型的"资产换走了，
    // 声明忘了改"。doctor 必须说得出来，而不是让产品继续编译、运行时报错。
    install(product, "insight-reveal");
    writeBindings(product, { pointer: "data-cursor" });

    const { status, out } = doctor(product);
    expect(status).toBe(1);
    expect(out).toMatch(/✗ seam/);
    expect(out).toContain("不在本次安装里的资产");
    expect(out).toContain("pointer → data-cursor");
  });

  it("声明了绑定、却没有角色文件 → warn（模板就是那个 TODO）", () => {
    const product = makeProduct("declared-no-file");
    install(product);
    writeBindings(product, { pointer: "data-cursor" });

    const { status, out } = doctor(product);
    expect(status).toBe(0);
    expect(out).toMatch(/! seam/);
    expect(out).toContain("声明了绑定但还没有角色文件：pointer");
  });

  it("有角色文件、却没有声明 → warn（下一个读者看不出它绑给谁）", () => {
    const product = makeProduct("file-no-declaration", {
      "lib/kits/adapters/pointer.tsx": 'export { DataCursor as Pointer } from "./data-cursor"\n',
    });
    install(product);

    const { status, out } = doctor(product);
    expect(status).toBe(0);
    expect(out).toMatch(/! seam/);
    expect(out).toContain("有角色文件但 seam.json 里没有声明：pointer");
  });

  it("seam.json 语法坏了 → FAIL（而不是当作没有接缝）", () => {
    const product = makeProduct("broken-seam");
    install(product);
    write(product, `${SEAM}/seam.json`, "{ not json");

    const { status, out } = doctor(product);
    expect(status).toBe(1);
    expect(out).toMatch(/✗ seam/);
    expect(out).toContain("不是合法 JSON");
  });

  it("角色名撞上 Kits 生成的文件名 → FAIL（并且给出可执行的下一步）", () => {
    const product = makeProduct("collision");
    install(product);
    // 角色名 = 资产 id：角色文件会和 adapters/data-cursor.tsx 撞名，
    // 于是"声明 → 文件"这一对永远对不上。
    writeBindings(product, { "data-cursor": "data-cursor" });

    const { status, out } = doctor(product);
    expect(status).toBe(1);
    expect(out).toMatch(/✗ seam/);
    expect(out).toContain("角色名与资产 id 同名");
    expect(out).toContain("换一个角色名");
  });
});

describe("K4 · 归属与 diff", () => {
  it("doctor 数清三类归属：managed / generated / product-owned seam", () => {
    const product = makeProduct("ownership", {
      "lib/kits/adapters/pointer.tsx": 'export { DataCursor as Pointer } from "./data-cursor"\n',
    });
    install(product);
    writeBindings(product, { pointer: "data-cursor" });

    const { out } = doctor(product);
    expect(out).toMatch(/✓ adapters-ownership/);
    expect(out).toContain("managed lib/kits/installed/");
    expect(out).toContain("checksum 受保护");
    expect(out).toContain("generated lib/kits/adapters/");
    expect(out).toContain("product-owned 接缝 1 个角色文件");
  });

  it("kits diff 报出接缝状态（绑定数 / 角色文件数 / 可绑定资产数）", () => {
    const product = makeProduct("diff");
    install(product);
    writeBindings(product, { pointer: "data-cursor" });
    write(product, "lib/kits/adapters/pointer.tsx", 'export { DataCursor as Pointer } from "./data-cursor"\n');

    const { out } = runCli(["diff", "--target", product, "--kits", ROOT]);
    expect(out).toContain("中性接缝");
    expect(out).toContain("绑定 1 个角色 · 角色文件 1 个 · 可绑定资产");
  });
});

describe("K4 · 事务：回滚不留半个 skeleton", () => {
  it("apply 失败时，本次新建的接缝文件一起回滚", async () => {
    const product = makeProduct("rollback");
    const layout = {
      installedRoot: "lib/kits/installed",
      adapterRoot: "lib/kits/adapters",
      agentRoot: "lib/kits/.kits",
      lockFile: "lib/kits/kits.lock.json",
    };
    const mod = (await import("../packages/cli/lib/installer.mjs")) as unknown as {
      apply: (args: Record<string, unknown>) => unknown;
    };

    expect(() =>
      mod.apply({
        productRoot: product,
        layout,
        plan: {
          assets: [],
          edges: [],
          // src 不存在 → 写入过程中抛错 → 走回滚分支
          files: [
            {
              assetId: "x",
              src: path.join(product, "does-not-exist.ts"),
              dest: "lib/kits/installed/x.ts",
              resolved: {},
            },
          ],
        },
        extras: [
          {
            relPath: "lib/kits/adapters/seam/README.md",
            content: "half-generated\n",
          },
        ],
      }),
    ).toThrow();

    // 半生成的 skeleton 不允许留在盘上 —— 否则它永远不会再被补全。
    expect(existsSync(path.join(product, "lib/kits/adapters/seam/README.md"))).toBe(false);
  });
});

describe("K4 · 旧安装的迁移", () => {
  it("旧安装的迁移：v0.1.1 形状时 doctor 报警告，重跑 kits add 补上接缝且不动适配层", () => {
    const product = makeProduct("migrate");
    install(product);

    // 退化成 v0.1.1 形状。
    rmSync(path.join(product, SEAM), { recursive: true, force: true });
    const lockPath = path.join(product, "lib/kits/kits.lock.json");
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    delete lock.seam;
    lock.adapters.templateVersion = "0.1.1";
    writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
    // 产品改过的**生成文件**（v0.1.1 的产品只能改这些）必须原样保留。
    const customAdapter = '"use client"\nexport const mine = true\n';
    write(product, "lib/kits/adapters/data-cursor.tsx", customAdapter);

    const before = doctor(product);
    expect(before.status).toBe(0);
    expect(before.out).toContain("v0.1.1 风格的安装");
    expect(before.out).toContain("没有 lib/kits/adapters/seam/");

    install(product);

    // 接缝被补上，产品改过的适配层文件原样保留。
    expect(existsSync(path.join(product, SEAM, "seam.json"))).toBe(true);
    expect(read(product, "lib/kits/adapters/data-cursor.tsx")).toBe(customAdapter);

    const after = doctor(product);
    expect(after.status).toBe(0);
    expect(after.out).toMatch(/✓ seam/);
    expect(after.out).toContain("适配层模板版本 0.2.0");
  });
});
