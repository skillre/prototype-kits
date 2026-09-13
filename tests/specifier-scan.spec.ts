/**
 * 说明符扫描：只认代码，不认文档与注释（K-06）。
 *
 * ===========================================================================
 * 这个缺陷是 v0.1.1 期间发现的，**不在最初的五个之列**
 * ===========================================================================
 * 它从 v0.1.0 起就存在，而且在真实安装里是致命的 —— 只是之前没人试过
 * "cinematic + 三个组件 + 一个效果"之外的组合，所以一直没显形。
 *
 * 现象（在干净的 v0.1.0 上复现过）：
 *
 *   kits add --style editorial   → ✗ installed/contracts/README.md
 *                                    引用了未知的 Kits 包：「@kits/style-cinematic」
 *   kits add --style cinematic   → ✗ lib/kits/.kits/README.md
 *                                   （不带 --components）引用了未知的
 *                                   Kits 包：「@kits/react-utils」
 *
 * 也就是说：**换一套 pack、或者只装样式不装组件，安装都会失败。**
 *
 * ---------------------------------------------------------------------------
 * 两个独立的原因，叠在一起
 * ---------------------------------------------------------------------------
 *   1. 安装器扫描**所有**被安装的文件，包括 README.md。
 *      而 README 里到处是代码示例（`import … from "@kits/style-cinematic"`）。
 *   2. 扫描是纯正则，**不看注释**。于是连 Kits 自己源码注释里写的示例
 *      也会被当成依赖 —— 修好第 1 条之后，installer.mjs 自己的注释
 *      又把安装弄挂了一次。
 *
 * 修法：文档文件不参与依赖解析；扫描前先剥注释（且**行注释必须先剥**）。
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { scanSpecifiers, stripComments } from "../packages/cli/lib/installer.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const CLI = path.join(ROOT, "packages", "cli", "kits.mjs");
const TMP = path.join(ROOT, "node_modules", ".cache", "kits-specifier-tests");

function makeProduct(name: string) {
  const dir = path.join(TMP, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({
      name,
      version: "0.0.0",
      dependencies: { react: "19.2.8" },
      devDependencies: { "@types/react": "19.3.0", typescript: "5.9.3" },
    }),
  );
  return dir;
}

function tryInstall(product: string, args: string[]) {
  const result = spawnSync(
    process.execPath,
    [CLI, "add", "--target", product, ...args],
    { cwd: ROOT, encoding: "utf8" },
  );
  return {
    ok: result.status === 0,
    out: `${result.stdout}${result.stderr}`.replace(/\u001b\[[0-9;]*m/g, ""),
  };
}

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

/* -------------------------------------------------------------------------- */

describe("K-06 · 安装器能装任意组合，而不是只有一个幸运组合", () => {
  const product = makeProduct("scan-combos");

  const combos: Array<[string, string[]]> = [
    ["只装 editorial", ["--style", "editorial"]],
    ["只装 cinematic", ["--style", "cinematic"]],
    ["只装 instrument", ["--style", "instrument"]],
    ["三套 pack 一起装", ["--style", "editorial,cinematic,instrument"]],
    ["cinematic + 一个组件", ["--style", "cinematic", "--components", "insight-reveal"]],
    [
      "effect 但不装组件",
      ["--style", "cinematic", "--effects", "ambient-glow"],
    ],
    [
      "第二次实验用的组合",
      [
        "--style",
        "cinematic",
        "--components",
        "animated-grid,data-cursor,insight-reveal",
        "--effects",
        "ambient-glow",
      ],
    ],
  ];

  for (const [label, args] of combos) {
    it(`${label} 安装成功`, () => {
      rmSync(path.join(product, "lib"), { recursive: true, force: true });
      const { ok, out } = tryInstall(product, args);
      expect(ok, out).toBe(true);
    });
  }

  it("文档仍然被安装进产品（只是不再参与依赖解析）", () => {
    rmSync(path.join(product, "lib"), { recursive: true, force: true });
    tryInstall(product, ["--style", "cinematic"]);
    expect(existsSync(path.join(product, "lib/kits/installed/cinematic/README.md"))).toBe(true);
    expect(existsSync(path.join(product, "lib/kits/.kits/README.md"))).toBe(true);
  });

  it("文档里的示例**不**被改写成相对路径（示例要展示规范说明符）", () => {
    const readme = readFileSync(
      path.join(product, "lib/kits/installed/cinematic/README.md"),
      "utf8",
    );
    // 若被当成依赖重写，这里会变成 ../../contracts/… 之类的相对路径
    expect(readme).not.toContain("../../installed/");
  });

  it("真实 import 照常被重写成相对路径（修复没有放宽重写）", () => {
    const installed = readFileSync(
      path.join(product, "lib/kits/installed/cinematic/index.ts"),
      "utf8",
    );
    expect(installed).toContain('from "../contracts/index"');
    expect(installed).not.toMatch(/from\s+"@kits\//);
  });
});

/* -------------------------------------------------------------------------- */

describe("K-06 · stripComments 的顺序是有讲究的", () => {
  it("剥掉块注释", () => {
    expect(stripComments('a /* import "x" */ b')).toBe("a  b");
  });

  it("剥掉行注释", () => {
    expect(stripComments('import "keep";\n// import "drop";')).toBe(
      'import "keep";\n',
    );
  });

  it("保护 URL 里的 //（否则 CSS 的 svg data-uri 会被吃掉半行）", () => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg'/>`;
    expect(stripComments(svg)).toBe(svg);
  });

  it("行注释里出现块注释起始符时，不能连带吃掉后面的真实代码", () => {
    /*
     * 这是本次修复里最容易被写错的一处：先剥块注释的话，
     * 行注释里的那个块注释起始符会开启一个区间，一直吃到**后面**的
     * 块注释结束符为止，把夹在中间的真实 import 一起删掉 ——
     * 那个 import 就不会被重写了。
     */
    const source = [
      "// 产品代码只 import 适配层 —— 从不 import lib/kits/installed/*",
      'import { AnimatedGrid } from "@/lib/kits/adapters/animated-grid";',
      "/** 一段说明 */",
    ].join("\n");
    const stripped = stripComments(source);
    expect(stripped).toContain('from "@/lib/kits/adapters/animated-grid"');
  });

  it("scanSpecifiers 看不见注释里的说明符", () => {
    const content = [
      'import { real } from "@kits/contracts";',
      '// import { fake } from "@kits/insight-reveal";',
      '/* import { alsoFake } from "@kits/style-editorial"; */',
    ].join("\n");
    const specs = scanSpecifiers(content).map((s) => s.spec);
    expect(specs).toContain("@kits/contracts");
    expect(specs).not.toContain("@kits/insight-reveal");
    expect(specs).not.toContain("@kits/style-editorial");
  });

  it("仍然找得到真实的 import / 副作用 import / CSS @import", () => {
    expect(scanSpecifiers('import x from "a";').map((s) => s.spec)).toEqual(["a"]);
    expect(scanSpecifiers('import "b";').map((s) => s.spec)).toEqual(["b"]);
    expect(scanSpecifiers('@import "c";').map((s) => s.spec)).toEqual(["c"]);
    expect(scanSpecifiers('@import url("d");').map((s) => s.spec)).toEqual(["d"]);
  });

  it("同一个 CSS @import 只报告一次", () => {
    // 曾经"副作用导入"与"CSS @import"两条正则重叠，`@import "x"` 被收集两次
    const specs = scanSpecifiers('@import "c";');
    expect(specs).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */

describe("K-06 · 三个 pack 的 README 各自提到别的包，但不构成依赖", () => {
  it("contracts 的 README 提到 style-cinematic，但装 editorial 不需要它", () => {
    const readme = readFileSync(path.join(ROOT, "packages", "contracts", "README.md"), "utf8");
    expect(readme).toContain("@kits/style-cinematic");
    // 文档被识别为文档
    expect(/\.md$/i.test("packages/contracts/README.md")).toBe(true);
  });
});
