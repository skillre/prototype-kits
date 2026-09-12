/**
 * Package Boundary 审计。
 *
 * ===========================================================================
 * 这组测试的存在理由
 * ===========================================================================
 * 第一次真实产品集成暴露的头号缺口是：
 *
 *   「package 使用 `file:` 安装会失败，因为组件引用 package 外部的
 *     `_shared` / `_contract`」
 *
 * 也就是说：**package boundary 是漏的**。组件与 style pack 不是"包"，
 * 而是"仓库里的一段路径" —— 它们靠向上爬的 `../` 引用邻居，
 * 而任何真正的安装机制（`file:`、tarball、publish）都只会搬运包目录本身。
 *
 * 下面的断言把「self-contained」这件事变成可执行的规则：
 *   1. 包内**任何**文件都不允许用 `../` 爬到包目录之外；
 *   2. 跨包引用必须走裸包名（`@kits/*`），且必须声明在 package.json 里；
 *   3. `exports` 映射必须真的指向存在的文件（否则安装器解析不了）。
 *
 * 这三条一起，等价于「这个目录可以被单独拿走、装到别处、仍然能编译」。
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");

/** 仓库里所有「包」的目录。 */
const PACKAGE_DIRS = [
  ...readdirSync(path.join(ROOT, "packages")).map((d) => `packages/${d}`),
  ...readdirSync(path.join(ROOT, "styles")).map((d) => `styles/${d}`),
  ...readdirSync(path.join(ROOT, "components"))
    .filter((d) => !d.startsWith("_"))
    .map((d) => `components/${d}`),
  "effects",
].filter((rel) => existsSync(path.join(ROOT, rel, "package.json")));

const SOURCE_EXT = new Set([".ts", ".tsx", ".mts", ".mjs", ".css"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const abs = path.join(dir, entry);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (SOURCE_EXT.has(path.extname(entry))) out.push(abs);
  }
  return out;
}


/**
 * 去掉注释再扫描。
 *
 * 为什么必须这样做：Kits 的文档注释里**故意**写着代码示例
 * （`import { … } from "@kits/contracts"`、`而不是靠 ../_shared/*`），
 * 那是解释，不是依赖。把注释算进来会让这组测试变成"禁止写文档"。
 */
function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const readJson = (rel: string): Record<string, unknown> => JSON.parse(readFileSync(path.join(ROOT, rel), "utf8"));

/**
 * 一个源文件里全部「相对的」import/export 说明符。
 * 只看相对路径 —— 绝对与裸包名由别的断言负责。
 */
const RELATIVE_SPECIFIER = /(?:\bfrom\s*|\bimport\s*)\(?\s*["'](\.[^"']+)["']/g;

function relativeSpecifiers(content: string): string[] {
  const out = [];
  RELATIVE_SPECIFIER.lastIndex = 0;
  let m;
  while ((m = RELATIVE_SPECIFIER.exec(content)) !== null) out.push(m[1]);
  return out;
}

const KITS_SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*)\(?\s*["'](@kits\/[^"']+)["']/g;

function kitsSpecifiers(content: string): string[] {
  const out = [];
  KITS_SPECIFIER.lastIndex = 0;
  let m;
  while ((m = KITS_SPECIFIER.exec(content)) !== null) out.push(m[1]);
  return out;
}

/** 说明符是否指向包目录之外（允许包内的 ../）。 */
function escapesPackage(fromFile: string, spec: string, packageDirAbs: string): boolean {
  const resolved = path.resolve(path.dirname(fromFile), spec);
  const rel = path.relative(packageDirAbs, resolved);
  return rel.startsWith("..");
}

describe("package boundary · self-contained", () => {
  it("扫描到本仓库的全部包（防止测试因为路径写错而空跑）", () => {
    expect(PACKAGE_DIRS.length).toBeGreaterThanOrEqual(11);
  });

  for (const rel of PACKAGE_DIRS) {
    const pkgDir = path.join(ROOT, rel);
    const pkg = readJson(`${rel}/package.json`) as {
      name: string;
      exports?: Record<string, unknown>;
      files?: string[];
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    it(`${pkg.name}：包内文件不用 ../ 爬到包目录之外`, () => {
      const offenders: string[] = [];
      for (const file of walk(pkgDir)) {
        const content = stripComments(readFileSync(file, "utf8"));
        for (const spec of relativeSpecifiers(content)) {
          if (escapesPackage(file, spec, pkgDir)) {
            offenders.push(`${path.relative(ROOT, file)} → ${spec}`);
          }
        }
      }
      expect(
        offenders,
        `${pkg.name} 不是自足的：这些相对引用指向了包目录之外。\n` +
          `修法：把它变成包（package.json + exports），或改成裸包名 @kits/*。`,
      ).toEqual([]);
    });

    it(`${pkg.name}：跨包引用都用 @kits/* 且已声明依赖`, () => {
      const declared = new Set([
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.peerDependencies ?? {}),
      ]);
      const undeclared = new Set<string>();
      for (const file of walk(pkgDir)) {
        const content = stripComments(readFileSync(file, "utf8"));
        for (const spec of kitsSpecifiers(content)) {
          const packageName = spec.split("/").slice(0, 2).join("/");
          if (!declared.has(packageName)) undeclared.add(`${spec}（在 ${path.relative(ROOT, file)}）`);
        }
      }
      expect(
        [...undeclared],
        `${pkg.name} 引用了没有声明为依赖的 Kits 包 —— 安装器无法解析`,
      ).toEqual([]);
    });

    it(`${pkg.name}：exports 映射指向的文件都存在`, () => {
      const missing: string[] = [];
      for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
        const targetRel = typeof target === "string" ? target : null;
        if (!targetRel) continue;
        if (!existsSync(path.join(pkgDir, targetRel))) {
          missing.push(`${subpath} → ${targetRel}`);
        }
      }
      expect(missing, `${pkg.name} 的 exports 指向了不存在的文件`).toEqual([]);
    });

    it(`${pkg.name}：files 白名单里的每一项都存在`, () => {
      // files 里允许 glob（pnpm 的惯例），glob 不做存在性断言
      const missing = (pkg.files ?? []).filter(
        (f: string) => !f.includes("*") && !existsSync(path.join(pkgDir, f)),
      );
      expect(missing, `${pkg.name} 的 files 里有不存在的路径`).toEqual([]);
    });
  }
});

describe("package boundary · file: 安装可用性", () => {
  /**
   * `file:` 依赖只复制**包目录本身**。因此这条断言是：
   * 「仅凭包目录 + 其声明的依赖能否解析全部引用」。
   *
   * 上面那条 `../` 检查已经覆盖了主体；这里额外验证
   * **components/* 不再引用 components/_shared** —— 那是第一版的失败源。
   */
  it("没有任何包引用已删除的 _shared / _contract 目录", () => {
    expect(existsSync(path.join(ROOT, "components/_shared"))).toBe(false);
    expect(existsSync(path.join(ROOT, "styles/_contract"))).toBe(false);
  });

  it("源码里不再出现 ../_shared 或 ../_contract", () => {
    const offenders: string[] = [];
    const scan = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry.startsWith(".")) continue;
        const abs = path.join(dir, entry);
        if (statSync(abs).isDirectory()) {
          scan(abs);
          continue;
        }
        if (!SOURCE_EXT.has(path.extname(entry))) continue;
        const content = stripComments(readFileSync(abs, "utf8"));
        if (/\.\.\/_shared\/|\.\.\/_contract\//.test(content)) {
          offenders.push(path.relative(ROOT, abs));
        }
      }
    };
    for (const dir of ["components", "styles", "packages", "effects", "tests", "playground"]) {
      if (existsSync(path.join(ROOT, dir))) scan(path.join(ROOT, dir));
    }
    expect(offenders).toEqual([]);
  });
});
