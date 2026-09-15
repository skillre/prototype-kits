/**
 * kits doctor · 独立安装（standalone）下的判据与措辞（K-03）
 * 以及产品源码的引用边界（v0.1.1 §7）。
 *
 * ===========================================================================
 * K-03 修的是什么
 * ===========================================================================
 * v0.1.0 的判据是这样的：
 *
 *     const sameMajor = kitsTypesMajor === null || targetMajor === kitsTypesMajor;
 *
 * `kitsTypesMajor` 为 null 意味着**读不到上游**（Kits 仓库不在）。
 * 于是这一条在独立安装下**恒为真** —— 它没查，但它通过。
 * 更糟的是 detail 文案照写"与 Kits 解析到同一 major（19）"，
 * 把"无从验证"说成了"已验证"。
 *
 * v0.1.1 起每个检查都带 state，明确说明结论是靠什么得到的：
 *   verified / compatible / upstream-unavailable / not-applicable
 *
 * ===========================================================================
 * §7 修的是什么
 * ===========================================================================
 * 产品代码不得直接 import lib/kits/installed/*。这条是整条 Distribution
 * 设计的承重点：产品越过适配层，升级 Kits 时引用面就会断。
 * 它是 fail 而不是 warn —— 因为它破坏的是"升级不动产品代码"这个承诺本身。
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");
const CLI = path.join(ROOT, "packages", "cli", "kits.mjs");
const TMP = path.join(ROOT, "node_modules", ".cache", "kits-doctor-tests");

const STRIP_ANSI = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, "");

function makeProduct(name: string, pkg: Record<string, unknown> = {}) {
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
        ...pkg,
      },
      null,
      2,
    ),
  );
  /*
   * 每个 fixture 都要有真实产品源码（v0.2 起）：
   * 一个没有源码根的"产品"，boundary 检查会正确地判成 vacuous-scan（FAIL）——
   * 那是 K5 要的行为，但它会盖住这些用例真正要验的东西（独立安装下的上游诚实性）。
   */
  mkdirSync(path.join(dir, "app"), { recursive: true });
  writeFileSync(
    path.join(dir, "app", "page.tsx"),
    "export default function Page() { return null }\n",
  );
  return dir;
}

/**
 * 再往前一步：模拟"依赖已经装好"的产品。
 *
 * doctor 的 state 里 `verified` 与 `compatible` 的区别，恰好就是
 * "版本号是从 node_modules 读到的真实版本" 还是 "只读到 package.json 的区间"。
 * 不造出 node_modules，就永远测不到 verified 那条分支。
 */
function makeInstalledProduct(name: string) {
  const dir = makeProduct(name);
  const fake = {
    react: "19.2.8",
    "react-dom": "19.2.8",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    typescript: "5.9.3",
  };
  for (const [pkg, version] of Object.entries(fake)) {
    const p = path.join(dir, "node_modules", pkg, "package.json");
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify({ name: pkg, version }));
  }
  return dir;
}

function runCli(args: string[], cwd = ROOT) {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });
  return {
    status: result.status,
    out: STRIP_ANSI(`${result.stdout ?? ""}${result.stderr ?? ""}`),
  };
}

/** 用产品自己那份 `.kits/` CLI 跑 —— 这就是真实的独立安装场景。 */
function runProductCli(product: string, args: string[]) {
  const entry = path.join(product, "lib", "kits", ".kits", "kits.mjs");
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd: product,
    encoding: "utf8",
  });
  return {
    status: result.status,
    out: STRIP_ANSI(`${result.stdout ?? ""}${result.stderr ?? ""}`),
  };
}

function install(product: string) {
  const { status, out } = runCli([
    "add",
    "--target",
    product,
    "--style",
    "cinematic",
    "--components",
    "animated-grid,data-cursor,insight-reveal",
    "--effects",
    "ambient-glow",
  ]);
  if (status !== 0) throw new Error(`安装失败：\n${out}`);
  return out;
}

/** 只取 doctor 里某一行检查。 */
function checkLine(out: string, id: string): string {
  return out.split("\n").find((l) => l.includes(` ${id} `) || l.includes(` ${id}  `)) ?? "";
}

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

/* -------------------------------------------------------------------------- */
/* K-03 · doctor 的状态词汇                                                    */
/* -------------------------------------------------------------------------- */

describe("K-03 · 独立安装下不得声称'与上游一致'", () => {
  const product = makeProduct("doctor-standalone");
  install(product);

  const { out, status } = runProductCli(product, ["doctor"]);

  it("明确报出'未找到 Kits 仓库'，而不是沉默地跳过", () => {
    expect(out).toContain("upstream-kits");
    expect(out).toContain("[upstream-unavailable]");
    expect(out).toContain("未找到 Kits 仓库");
  });

  it("React 类型对齐的 state 是 compatible，不是 verified", () => {
    const line = checkLine(out, "react-types-major-parity");
    expect(line).toContain("[compatible]");
    expect(line).not.toContain("[verified]");
  });

  it("**不出现**'与 Kits 解析到同一 major'这句无法验证的结论", () => {
    /*
     * 这是 K-03 的核心断言。v0.1.0 在同一个场景下会打印这句话。
     */
    const line = checkLine(out, "react-types-major-parity");
    expect(line).not.toContain("与 Kits 解析到同一 major");
    // 反过来，必须明说"没做上游比对"
    expect(line).toContain("未做上游比对");
  });

  it("改用安装时声明的区间做判据，并说明区间来自哪里", () => {
    const line = checkLine(out, "react-types-major-parity");
    expect(line).toContain("^18.0.0 || ^19.0.0");
    expect(out).toContain("lib/kits/kits.lock.json");
  });

  it("独立安装是正常状态：只警告，不失败", () => {
    expect(status).toBe(0);
    expect(out).not.toContain("✗");
  });

  it("lock 里留下了安装时声明的兼容区间（standalone 判据的来源）", () => {
    const lock = JSON.parse(
      readFileSync(path.join(product, "lib", "kits", "kits.lock.json"), "utf8"),
    );
    expect(lock.compat.declaredReactRange).toBe("^18.0.0 || ^19.0.0");
    expect(typeof lock.compat.kitsTypesVersion).toBe("string");
  });
});

describe("K-03 · 上游可见时才说 verified", () => {
  const product = makeInstalledProduct("doctor-upstream");
  install(product);

  it("从 Kits 仓库跑（上游可见 + 依赖已装）→ verified，并点名上游版本", () => {
    const { out } = runCli(["doctor", "--target", product]);
    expect(checkLine(out, "upstream-kits")).toContain("[verified]");
    expect(checkLine(out, "react-types-major-parity")).toContain("[verified]");
    expect(out).toContain("与上游 Kits 解析到的");
  });

  it("--kits 显式指向上游时同样升级为 verified", () => {
    // 从产品目录跑（默认拿不到上游），但显式给 --kits
    const { out } = runProductCli(product, ["doctor", "--kits", ROOT]);
    expect(checkLine(out, "react-types-major-parity")).toContain("[verified]");
  });

  it("--kits 指向不存在的路径 → 退回 compatible，不假装通过", () => {
    const { out } = runProductCli(product, [
      "doctor",
      "--kits",
      path.join(TMP, "no-such-kits-repo"),
    ]);
    expect(checkLine(out, "react-types-major-parity")).toContain("[compatible]");
    expect(checkLine(out, "upstream-kits")).toContain("[upstream-unavailable]");
  });

  it("产品依赖还没装时，上游可见也只给 compatible（不把区间当版本）", () => {
    const bare = makeProduct("doctor-upstream-bare-deps");
    install(bare);
    const { out } = runCli(["doctor", "--target", bare]);
    const line = checkLine(out, "react-types-major-parity");
    expect(line).toContain("[compatible]");
    expect(line).toContain("尚未安装依赖");
  });
});

describe("K-03 · 状态词汇本身", () => {
  it("四个状态就是这四个，没有别的", async () => {
    const mod = (await import("../packages/cli/lib/compat.mjs")) as unknown as {
      auditCompatibility: (
        root: string,
        info: Record<string, unknown>,
      ) => { checks: Array<{ id: string; state: string; status: string }> };
      describeUpstream: (info: Record<string, unknown>) => {
        available: boolean;
        note: string;
      };
      majorSatisfiesRange: (major: number | null, range: string | null) => boolean | null;
    };
    const product = makeProduct("doctor-states");
    const { checks } = mod.auditCompatibility(product, {
      kitsTypesMajor: null,
      upstreamAvailable: false,
      supportedReactRange: "^18.0.0 || ^19.0.0",
    });
    const allowed = new Set([
      "verified",
      "compatible",
      "upstream-unavailable",
      "not-applicable",
    ]);
    for (const c of checks) {
      expect(allowed.has(c.state), `${c.id} 的 state 是 ${c.state}`).toBe(true);
    }
  });

  it("上游可读时 parity 的 state 是 verified；不可读时是 compatible", async () => {
    const mod = (await import("../packages/cli/lib/compat.mjs")) as unknown as {
      auditCompatibility: (
        root: string,
        info: Record<string, unknown>,
      ) => { checks: Array<{ id: string; state: string; detail: string }> };
    };
    const product = makeInstalledProduct("doctor-parity-states");

    const upstream = mod.auditCompatibility(product, {
      kitsReactTypesVersion: "19.3.0",
      kitsTypesMajor: 19,
      upstreamAvailable: true,
    });
    const a = upstream.checks.find((c) => c.id === "react-types-major-parity");
    expect(a?.state).toBe("verified");

    const standalone = mod.auditCompatibility(product, {
      kitsTypesMajor: null,
      upstreamAvailable: false,
      supportedReactRange: "^18.0.0 || ^19.0.0",
    });
    const b = standalone.checks.find((c) => c.id === "react-types-major-parity");
    expect(b?.state).toBe("compatible");
    expect(b?.detail).not.toContain("与 Kits 解析到同一 major");
  });

  it("只装 style / effect（无组件）时 parity 是 not-applicable", async () => {
    const mod = (await import("../packages/cli/lib/compat.mjs")) as unknown as {
      auditCompatibility: (
        root: string,
        info: Record<string, unknown>,
      ) => { checks: Array<{ id: string; state: string }> };
    };
    const product = makeProduct("doctor-no-components");
    const { checks } = mod.auditCompatibility(product, {
      kitsTypesMajor: null,
      upstreamAvailable: false,
      installedComponents: 0,
    });
    expect(checks.find((c) => c.id === "react-types-major-parity")?.state).toBe(
      "not-applicable",
    );
  });

  it("majorSatisfiesRange 认识 || 组合的 ^ 区间，不认识就返回 null", async () => {
    const { majorSatisfiesRange } = (await import(
      "../packages/cli/lib/compat.mjs"
    )) as unknown as {
      majorSatisfiesRange: (m: number | null, r: string | null) => boolean | null;
    };
    expect(majorSatisfiesRange(19, "^18.0.0 || ^19.0.0")).toBe(true);
    expect(majorSatisfiesRange(18, "^18.0.0 || ^19.0.0")).toBe(true);
    expect(majorSatisfiesRange(17, "^18.0.0 || ^19.0.0")).toBe(false);
    expect(majorSatisfiesRange(19, null)).toBeNull();
    expect(majorSatisfiesRange(null, "^19.0.0")).toBeNull();
  });

  it("describeUpstream 区分'找不到仓库'与'仓库在但依赖没装'", async () => {
    const { describeUpstream } = (await import(
      "../packages/cli/lib/compat.mjs"
    )) as unknown as {
      describeUpstream: (i: Record<string, unknown>) => { available: boolean; note: string };
    };
    expect(describeUpstream({ discovered: false }).note).toContain("未找到 Kits 仓库");
    const found = describeUpstream({
      discovered: true,
      kitsRoot: "/tmp/kits",
      kitsTypesVersion: null,
    });
    expect(found.available).toBe(false);
    expect(found.note).toContain("依赖未安装");
  });
});

/* -------------------------------------------------------------------------- */
/* §7 · 引用边界                                                              */
/* -------------------------------------------------------------------------- */

describe("§7 · 产品源码不得绕过适配层引用托管区", () => {
  const product = makeProduct("boundary-clean");
  install(product);

  it("干净产品（只 import adapters）→ 没有违规", async () => {
    mkdirSync(path.join(product, "app"), { recursive: true });
    writeFileSync(
      path.join(product, "app", "page.tsx"),
      [
        'import { stylePackMotionVars } from "@/lib/kits/adapters/style-pack";',
        'import { InsightReveal } from "@/lib/kits/adapters/insight-reveal";',
        "export default function P() { return <main style={stylePackMotionVars} />; }",
      ].join("\n"),
    );
    const { findManagedImports } = (await import(
      "../packages/cli/lib/boundary.mjs"
    )) as unknown as {
      findManagedImports: (o: { productRoot: string }) => {
        violations: Array<{ file: string }>;
        scanned: number;
      };
    };
    const result = findManagedImports({ productRoot: product });
    expect(result.scanned).toBeGreaterThan(0);
    expect(result.violations).toEqual([]);
  });

  it("适配层自己的 ../installed/ 引用**不**算违规（那是设计）", async () => {
    const { findManagedImports } = (await import(
      "../packages/cli/lib/boundary.mjs"
    )) as unknown as {
      findManagedImports: (o: { productRoot: string }) => {
        violations: Array<{ file: string; spec: string }>;
      };
    };
    const { violations } = findManagedImports({ productRoot: product });
    expect(violations.filter((v) => v.file.startsWith("lib/kits/adapters/"))).toEqual([]);
  });

  it("相对路径越界被抓住", async () => {
    const p = makeProduct("boundary-rel");
    install(p);
    mkdirSync(path.join(p, "app"), { recursive: true });
    writeFileSync(
      path.join(p, "app", "bad.ts"),
      'import { motionToCssVars } from "../lib/kits/installed/contracts/index";\n',
    );
    const { findManagedImports } = (await import(
      "../packages/cli/lib/boundary.mjs"
    )) as unknown as {
      findManagedImports: (o: { productRoot: string }) => {
        violations: Array<{ file: string; resolved: string | null; line: number | null }>;
      };
    };
    const { violations } = findManagedImports({ productRoot: p });
    expect(violations).toHaveLength(1);
    expect(violations[0].file).toBe("app/bad.ts");
    expect(violations[0].resolved).toBe("lib/kits/installed/contracts/index");
    expect(violations[0].line).toBe(1);
  });

  it("别名路径越界被抓住 —— 即使产品没有 tsconfig", async () => {
    /*
     * 别名解析依赖产品 tsconfig；没有它时 `@/lib/kits/installed/…`
     * 会解析不出来。**静默放过比误报更糟**，因此另有一条按布局路径
     * 文本匹配的兜底规则。这条测试锁住那条兜底。
     */
    const p = makeProduct("boundary-alias");
    install(p);
    mkdirSync(path.join(p, "app"), { recursive: true });
    writeFileSync(
      path.join(p, "app", "bad.ts"),
      'import { cinematicMotion } from "@/lib/kits/installed/cinematic/index";\n',
    );
    const { findManagedImports } = (await import(
      "../packages/cli/lib/boundary.mjs"
    )) as unknown as {
      findManagedImports: (o: { productRoot: string }) => {
        violations: Array<{ file: string }>;
      };
    };
    expect(findManagedImports({ productRoot: p }).violations).toHaveLength(1);
  });

  it("tsconfig 里配了别名时走真正的路径解析", async () => {
    const p = makeProduct("boundary-tsconfig");
    install(p);
    writeFileSync(
      path.join(p, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { paths: { "@/*": ["./*"] } },
      }),
    );
    mkdirSync(path.join(p, "app"), { recursive: true });
    writeFileSync(
      path.join(p, "app", "bad.ts"),
      'import { cinematicMotion } from "@/lib/kits/installed/cinematic/index";\n',
    );
    const { findManagedImports } = (await import(
      "../packages/cli/lib/boundary.mjs"
    )) as unknown as {
      findManagedImports: (o: { productRoot: string }) => {
        violations: Array<{ resolved: string | null }>;
      };
    };
    const { violations } = findManagedImports({ productRoot: p });
    expect(violations).toHaveLength(1);
    expect(violations[0].resolved).toBe("lib/kits/installed/cinematic/index");
  });

  it("剩余的 @kits/* 裸说明符也算越界（源码安装后不该再有）", async () => {
    const p = makeProduct("boundary-bare");
    install(p);
    mkdirSync(path.join(p, "app"), { recursive: true });
    writeFileSync(
      path.join(p, "app", "bad.ts"),
      'import { AnimatedGrid } from "@kits/animated-grid";\n',
    );
    const { findManagedImports } = (await import(
      "../packages/cli/lib/boundary.mjs"
    )) as unknown as {
      findManagedImports: (o: { productRoot: string }) => {
        violations: Array<{ spec: string }>;
      };
    };
    const { violations } = findManagedImports({ productRoot: p });
    expect(violations.map((v) => v.spec)).toContain("@kits/animated-grid");
  });

  it("同一个说明符不会被重复报告（@import 只能匹配一次）", async () => {
    /*
     * scanSpecifiers 里"副作用导入"与"CSS @import"两条正则曾经重叠，
     * `@import "x"` 会被收集两次。安装器不受影响（重写是 split/join），
     * 但逐条报告的消费者会看到重复项。
     */
    const p = makeProduct("boundary-dedupe");
    install(p);
    mkdirSync(path.join(p, "app"), { recursive: true });
    writeFileSync(
      path.join(p, "app", "bad.css"),
      '@import "../lib/kits/installed/cinematic/tokens.css";\n',
    );
    const { findManagedImports } = (await import(
      "../packages/cli/lib/boundary.mjs"
    )) as unknown as {
      findManagedImports: (o: { productRoot: string }) => {
        violations: Array<{ spec: string }>;
      };
    };
    expect(findManagedImports({ productRoot: p }).violations).toHaveLength(1);
  });

  it("不扫描托管区与 CLI 副本（它们的引用是内部实现）", async () => {
    const { findManagedImports } = (await import(
      "../packages/cli/lib/boundary.mjs"
    )) as unknown as {
      findManagedImports: (o: { productRoot: string }) => {
        violations: Array<{ file: string }>;
      };
    };
    const { violations } = findManagedImports({ productRoot: product });
    for (const v of violations) {
      expect(v.file.startsWith("lib/kits/")).toBe(false);
    }
  });

  it("doctor 把越界报成 fail，退出码非 0", () => {
    const p = makeProduct("boundary-doctor");
    install(p);
    mkdirSync(path.join(p, "app"), { recursive: true });
    writeFileSync(
      path.join(p, "app", "bad.ts"),
      'import { x } from "../lib/kits/installed/contracts/index";\n',
    );
    const { status, out } = runProductCli(p, ["doctor"]);
    expect(status).toBe(1);
    expect(out).toContain("✗ boundary");
    expect(out).toContain("绕过适配层");
  });

  it("干净产品在 doctor 里 boundary 通过并给出扫描数", () => {
    const { out } = runProductCli(product, ["doctor"]);
    expect(out).toContain("✓ boundary");
    expect(out).toMatch(/扫过 \d+ 个产品源文件/);
  });
});
