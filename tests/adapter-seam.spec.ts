/**
 * 适配层的 TS 缝（K-04）。
 *
 * ===========================================================================
 * K-04 修的是什么
 * ===========================================================================
 * v0.1.0 的安装器给 style pack 生成了 **CSS 缝**（`style-<id>.css`），
 * 但没有 **TS 缝**。而 style pack 有 TS 入口（`index.ts` / `motion.ts`），
 * 产品要拿 `cinematicMotion` 去做 `motionToCssVars()`，就只能：
 *
 *     import { cinematicMotion } from "../installed/cinematic/index";
 *
 * —— 越过适配层直接读托管区。契约说"产品不得依赖托管区"，但工具链
 * 没给合规的路。**第二次真实 Source Installation 里产品就是这么写的。**
 *
 * 修法不是"让检查放过它"，而是把缝补上：
 *
 *   style pack   style-<id>.css   +   style-<id>.ts  +  style-pack.ts（稳定别名）
 *   effect       effect-<id>.css  +   effect-<id>.ts
 *   component    <id>.tsx
 *
 * 目标是产品可以这样写，且**只在适配层里出现**托管区路径：
 *
 *     import { stylePackMotion, stylePackMotionVars } from "@/lib/kits/adapters/style-pack";
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { findManagedImports } from "../packages/cli/lib/boundary.mjs";
import {
  expectedAdapterFiles,
  styleExportNames,
  variableKeyMap,
  commonVariablePrefix,
} from "../packages/cli/lib/adapters.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const CLI = path.join(ROOT, "packages", "cli", "kits.mjs");
const TMP = path.join(ROOT, "node_modules", ".cache", "kits-adapter-seam-tests");

function makeProduct(name: string) {
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
        dependencies: { react: "19.2.8" },
        devDependencies: { "@types/react": "19.3.0", typescript: "5.9.3" },
      },
      null,
      2,
    ),
  );
  return dir;
}

function install(product: string, extra: string[]) {
  const result = spawnSync(
    process.execPath,
    [CLI, "add", "--target", product, ...extra],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`安装失败：\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

const readAdapter = (product: string, rel: string) =>
  readFileSync(path.join(product, "lib", "kits", "adapters", rel), "utf8");

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

/* -------------------------------------------------------------------------- */
/* 生成结果                                                                    */
/* -------------------------------------------------------------------------- */

describe("K-04 · 三类资产各自的缝都生成了", () => {
  const product = makeProduct("seam-full");
  install(product, [
    "--style",
    "cinematic",
    "--components",
    "animated-grid,data-cursor,insight-reveal",
    "--effects",
    "ambient-glow",
  ]);

  const expected = [
    "style-cinematic.css",
    "style-cinematic.ts",
    "style-pack.ts",
    "animated-grid.tsx",
    "data-cursor.tsx",
    "insight-reveal.tsx",
    "effect-ambient-glow.css",
    "effect-ambient-glow.ts",
    "README.md",
  ];

  it("九个适配层文件一个不少", () => {
    for (const rel of expected) {
      expect(existsSync(path.join(product, "lib", "kits", "adapters", rel)), rel).toBe(true);
    }
  });

  it("expectedAdapterFiles 与真实写盘结果一致（防止清单与生成器漂移）", () => {
    const assets = ["cinematic", "animated-grid", "data-cursor", "insight-reveal", "ambient-glow"].map(
      (id) => ({ id, type: "style" }),
    );
    // 只比对路径集合的构成规则：每个 style 出 2 个 + 主 pack 出 1 个别名
    expect(expectedAdapterFiles([{ id: "cinematic", type: "style" }])).toEqual(
      expect.arrayContaining(["style-cinematic.css", "style-cinematic.ts", "style-pack.ts"]),
    );
    expect(expectedAdapterFiles([{ id: "ambient-glow", type: "effect" }])).toEqual(
      expect.arrayContaining(["effect-ambient-glow.css", "effect-ambient-glow.ts"]),
    );
    expect(assets).toHaveLength(5);
  });

  it("style TS 缝导出产品需要的四个名字", () => {
    const seam = readAdapter(product, "style-cinematic.ts");
    for (const name of [
      "stylePackId",
      "stylePackMotion",
      "stylePackMotionVars",
      "stylePackProfile",
      "stylePackMeta",
      "stylePackSelector",
    ]) {
      expect(seam, name).toContain(`export const ${name}`);
    }
  });

  it("motionToCssVars 来自**正式安装的契约层**，不是手抄的映射表", () => {
    const seam = readAdapter(product, "style-cinematic.ts");
    expect(seam).toContain('import { motionToCssVars } from "../installed/contracts/index"');
    // 手抄 13 行变量映射的形态：直接写 --kits-dur-* 字面量
    expect(seam).not.toMatch(/--kits-dur-instant/);
    expect(seam).not.toMatch(/--kits-ease-out/);
  });

  it("style-pack.ts 是稳定别名，产品换 pack 时引用面不动", () => {
    const alias = readAdapter(product, "style-pack.ts");
    expect(alias).toContain('export * from "./style-cinematic"');
  });

  it("effect TS 缝导出类名与公开变量名，产品不必硬编码字符串", () => {
    const seam = readAdapter(product, "effect-ambient-glow.ts");
    expect(seam).toContain('export const effectId = "ambient-glow"');
    expect(seam).toContain('export const effectClass = "kits-effect-ambient-glow"');
    expect(seam).toContain('"breathing": "kits-effect-ambient-glow--breathing"');
    expect(seam).toContain('"strength": "--kits-effect-ambient-strength"');
    expect(seam).toContain('"primaryFalloff": "--kits-effect-ambient-primary-falloff"');
  });

  it("生成的 CSS 缝是**语法合法**的（注释闭合、正文不在注释外）", () => {
    /*
     * 这条来自一次真实事故：v0.1.1 重构 CSS banner 时，注释被提前闭合，
     * 后面的说明文字落到了注释**外面** —— 生成出一段以 `*` 开头的
     * 畸形片段（注释结束符后面跟着裸文本）。单元测试全绿，
     * 直到 standalone fixture 的 next build 才以 PostCSS
     * 「Unexpected end of input」炸出来。
     *
     * 判据：把注释剥掉之后，剩下的应当只有 @import 语句。
     */
    for (const rel of ["style-cinematic.css", "effect-ambient-glow.css"]) {
      const css = readAdapter(product, rel);
      const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
      const meaningful = body
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      for (const line of meaningful) {
        expect(line, `${rel} 的注释外出现了非法内容：${line}`).toMatch(
          /^@import\s+"[^"]+";$/,
        );
      }
      // 注释闭合符必须比开启符少一次（多了就是提前闭合）
      const opens = (css.match(/\/\*/g) ?? []).length;
      const closes = (css.match(/\*\//g) ?? []).length;
      expect(closes, `${rel} 的注释不配对`).toBe(opens);
    }
  });

  it("生成的缝里没有 @kits/* 裸说明符（否则产品又要改配置）", () => {
    for (const rel of expected) {
      if (!/\.tsx?$/.test(rel)) continue;
      expect(readAdapter(product, rel), rel).not.toMatch(/from\s+["']@kits\//);
    }
  });

  it("生成的缝不带 .ts / .tsx 扩展名（产品不需要 allowImportingTsExtensions）", () => {
    const seam = readAdapter(product, "style-cinematic.ts");
    expect(seam).not.toMatch(/from\s+["'][^"']+\.tsx?["']/);
  });
});

/* -------------------------------------------------------------------------- */
/* 产品侧不再需要 import installed                                             */
/* -------------------------------------------------------------------------- */

describe("K-04 · 用缝写产品代码就不越界", () => {
  const product = makeProduct("seam-boundary");
  install(product, [
    "--style",
    "cinematic",
    "--components",
    "animated-grid,data-cursor,insight-reveal",
    "--effects",
    "ambient-glow",
  ]);

  it("fixture 风格的页面（只用 adapters）零违规", () => {
    mkdirSync(path.join(product, "app"), { recursive: true });
    writeFileSync(
      path.join(product, "app", "page.tsx"),
      [
        'import { stylePackMotion, stylePackMotionVars } from "@/lib/kits/adapters/style-pack";',
        'import { AnimatedGrid } from "@/lib/kits/adapters/animated-grid";',
        'import { InsightReveal } from "@/lib/kits/adapters/insight-reveal";',
        'import { effectClass } from "@/lib/kits/adapters/effect-ambient-glow";',
        "export default function P() {",
        "  return (",
        "    <main className={effectClass} style={stylePackMotionVars}>",
        "      <AnimatedGrid cell={stylePackMotion ? \"wide\" : \"normal\"} />",
        "      <InsightReveal>ok</InsightReveal>",
        "    </main>",
        "  );",
        "}",
      ].join("\n"),
    );
    writeFileSync(
      path.join(product, "app", "globals.css"),
      '@import "../lib/kits/adapters/style-cinematic.css";\n@import "../lib/kits/adapters/effect-ambient-glow.css";\n',
    );
    const { violations } = findManagedImports({ productRoot: product });
    expect(violations).toEqual([]);
  });

  it("对照：不走缝就会越界（证明检查不是摆设）", () => {
    const bad = makeProduct("seam-boundary-bad");
    install(bad, ["--style", "cinematic", "--components", "insight-reveal"]);
    mkdirSync(path.join(bad, "app"), { recursive: true });
    writeFileSync(
      path.join(bad, "app", "page.tsx"),
      'import { cinematicMotion } from "@/lib/kits/installed/cinematic/index";\n',
    );
    expect(findManagedImports({ productRoot: bad }).violations).toHaveLength(1);
  });

  it("装在仓库里的 fixture 本身也只 import adapters", () => {
    /*
     * 注释被剥掉再断言：fixture 里有一句说明性注释
     * 「从不 import lib/kits/installed/*」—— 那是文档，不是依赖。
     * 这也正是安装器的说明符扫描必须去注释的原因（K-06）。
     */
    const strip = (s: string) =>
      s.replace(/(^|[^:])\/\/[^\n]*/g, "$1").replace(/\/\*[\s\S]*?\*\//g, "");
    const files = [
      ["page.tsx", path.join(ROOT, "fixtures", "standalone-product", "app", "page.tsx")],
      ["globals.css", path.join(ROOT, "fixtures", "standalone-product", "app", "globals.css")],
    ] as const;
    for (const [name, file] of files) {
      const content = strip(readFileSync(file, "utf8"));
      expect(content, name).not.toContain("installed/");
      expect(content, name).toContain("adapters/");
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 所有权：不覆盖产品改过的任何缝                                              */
/* -------------------------------------------------------------------------- */

describe("K-04 · 新增的缝同样遵守'已存在则保留'", () => {
  const product = makeProduct("seam-ownership");
  install(product, ["--style", "cinematic"]);

  it("产品改过的 style-pack.ts 在重装后原样保留", () => {
    const target = path.join(product, "lib", "kits", "adapters", "style-pack.ts");
    const edited = "// 产品自己换 pack 的写法\nexport * from \"./style-editorial\";\n";
    writeFileSync(target, edited);
    install(product, ["--style", "cinematic"]);
    expect(readFileSync(target, "utf8")).toBe(edited);
  });

  it("锁里记录了适配层模板版本与新建/保留清单", () => {
    const lock = JSON.parse(
      readFileSync(path.join(product, "lib", "kits", "kits.lock.json"), "utf8"),
    );
    // v0.2：模板版本跟着 Installer 走（中性接缝让 banner 与推荐写法都变了）。
    expect(lock.adapters.templateVersion).toBe("0.2.0");
    expect(lock.adapters.kept).toContain("lib/kits/adapters/style-pack.ts");
    // 中性接缝同样是产品所有 —— 记进 lock 只为 doctor 能分清
    // 「v0.1.1 装的」与「有接缝但被删了」。
    expect(lock.seam.version).toBe("0.2.0");
    expect(lock.seam.file).toBe("lib/kits/adapters/seam/seam.json");
    // 第一次安装是 written，之后的安装是 kept（文件已存在就永不覆盖）——
    // 两个都要算，否则这条断言会依赖测试执行顺序。
    expect([...lock.seam.written, ...lock.seam.kept]).toContain(
      "lib/kits/adapters/seam/seam.json",
    );
  });

  it("模板版本落后时 doctor 报 warn 而不是静默覆盖", () => {
    const file = path.join(product, "lib", "kits", "kits.lock.json");
    const lock = JSON.parse(readFileSync(file, "utf8"));
    lock.adapters.templateVersion = "0.1.0";
    writeFileSync(file, JSON.stringify(lock, null, 2));
    const result = spawnSync(
      process.execPath,
      [path.join(product, "lib", "kits", ".kits", "kits.mjs"), "doctor"],
      { cwd: product, encoding: "utf8" },
    );
    const out = `${result.stdout}${result.stderr}`.replace(/\u001b\[[0-9;]*m/g, "");
    expect(out).toContain("adapters-template");
    expect(out).toContain("旧模板 v0.1.0");
    // 提醒的是"删掉再跑 kits add"，而不是"已经替你更新了"
    expect(out).toContain("删掉该文件再跑");
  });
});

/* -------------------------------------------------------------------------- */
/* 三个 pack 的导出名约定                                                      */
/* -------------------------------------------------------------------------- */

describe("K-04 · 三个 pack 都满足 <id>Motion / Profile / Meta 约定", () => {
  it("导出名推导正确", () => {
    expect(styleExportNames("cinematic")).toEqual({
      motion: "cinematicMotion",
      profile: "cinematicProfile",
      meta: "cinematicMeta",
    });
    expect(styleExportNames("editorial").motion).toBe("editorialMotion");
    expect(styleExportNames("instrument").meta).toBe("instrumentMeta");
  });

  it("每个 pack 的 index.ts 确实导出这三个名字", () => {
    for (const pack of ["editorial", "cinematic", "instrument"]) {
      const index = readFileSync(path.join(ROOT, "styles", pack, "index.ts"), "utf8");
      const names = styleExportNames(pack);
      for (const name of [names.motion, names.profile, names.meta]) {
        expect(index, `${pack} 缺 ${name}`).toMatch(
          new RegExp(`export (const|\\{)[^\\n]*\\b${name}\\b`),
        );
      }
    }
  });

  it("三个 pack 装进同一个产品时各自的缝都在，别名指向第一个（主 pack）", () => {
    const multi = makeProduct("seam-multi-pack");
    install(multi, ["--style", "editorial,cinematic"]);
    expect(existsSync(path.join(multi, "lib/kits/adapters/style-editorial.ts"))).toBe(true);
    expect(existsSync(path.join(multi, "lib/kits/adapters/style-cinematic.ts"))).toBe(true);
    expect(readAdapter(multi, "style-pack.ts")).toContain('export * from "./style-editorial"');
  });
});

/* -------------------------------------------------------------------------- */
/* 变量名 → 对象键                                                             */
/* -------------------------------------------------------------------------- */

describe("K-04 · effect 变量名到 TS 键的推导", () => {
  it("按最长公共段前缀裁剪，而不是按资产 id 拼字面量", () => {
    const names = [
      "--kits-effect-ambient-primary",
      "--kits-effect-ambient-primary-falloff",
      "--kits-effect-ambient-strength",
    ];
    expect(commonVariablePrefix(names)).toBe("--kits-effect-ambient-");
    expect(variableKeyMap(names)).toEqual({
      primary: "--kits-effect-ambient-primary",
      primaryFalloff: "--kits-effect-ambient-primary-falloff",
      strength: "--kits-effect-ambient-strength",
    });
  });

  it("前缀不会吃掉整个名字（单变量时退化成 value）", () => {
    expect(variableKeyMap(["--kits-effect-x-strength"])).toEqual({
      strength: "--kits-effect-x-strength",
    });
    expect(variableKeyMap([])).toEqual({});
  });

  it("键与值一一对应，没有丢失变量", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(ROOT, "effects", "manifest.json"), "utf8"),
    );
    const ambient = manifest.effects.find((e: { id: string }) => e.id === "ambient-glow");
    const names = ambient.variables.map((v: { name: string }) => v.name);
    const map = variableKeyMap(names);
    expect(Object.values(map).sort()).toEqual([...names].sort());
  });
});
