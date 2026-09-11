/**
 * Signature Component Contract —— 组件层的稳定 API 契约。
 *
 * ## 为什么需要这一层
 *
 * 产品的界面代码**不允许**直接依赖第三方组件 API。原因不是洁癖：
 *   1. 第三方组件随时可能改 prop 名、改默认值、改 DOM 结构；
 *   2. 第三方组件的 API 反映的是它作者的抽象，不是我们的产品语义；
 *   3. 换一个第三方实现时，如果产品直接依赖它，就是全站重构。
 *
 * 因此强制这条链路：
 *
 *     外部资产 → inspect → adapter → 内部稳定 API → Product
 *                                    ↑
 *                              你只被允许用这个
 *
 * ## 三条硬规则
 *
 * 1. **内部 API 只表达产品语义**，不表达实现细节：
 *    `<SpotlightSurface tone="brand" intensity="medium" />`
 *    —— 不是 `<FancyGlowCard glowColor="#4fd6ff" blurRadius={24} />`。
 * 2. **视觉字面量一律禁止**。组件的样式只管结构与行为；
 *    颜色/圆角/间距/动效全部来自 `var(--kits-*)`，由 Style Pack 决定。
 * 3. **降级是 API 的一部分**。移动端与 reduced-motion 的 fallback 由组件内建，
 *    产品不需要（也不允许）自己写 `matchMedia` 分支。
 *
 * ## 版本策略
 *
 * 内部 API 用 `apiVersion` 标注（SemVer）。**破坏性变更必须升 major**，
 * 且必须在 `CHANGELOG` 段说明迁移方式。产品代码只依赖 major。
 */

/** 组件 API 的当前大版本。产品只依赖 major。 */
export const COMPONENT_API_VERSION = "1.0.0";

/** 性能分级。A = 静态 CSS；B = 合成友好但有滤镜/混合成本；C = 需要 JS 持续驱动。 */
export type PerformanceClass = "A" | "B" | "C";

/**
 * 强度刻度 —— 组件用它代替具体的数值。
 * `none` 是合法且重要的取值：产品应当能一键关掉装饰。
 */
export type Intensity = "none" | "subtle" | "medium" | "strong";

/** 强度 → 乘数。组件把这个乘数写进 CSS 变量，具体像素由 pack 决定。 */
export const INTENSITY_SCALE: Record<Intensity, number> = {
  none: 0,
  subtle: 0.5,
  medium: 1,
  strong: 1.6,
};

/**
 * 语调 —— 语义化的强调方向，映射到 pack 的颜色槽位。
 * 产品说 `tone="brand"`，而不是 `color="#4fd6ff"`。
 */
export type Tone = "neutral" | "brand" | "signal" | "critical";

/** 语调 → pack 颜色变量名。`--kits-*` 由 Style Pack 定义，组件不写死颜色。 */
export const TONE_VAR: Record<Tone, string> = {
  neutral: "--kits-color-ink",
  brand: "--kits-color-accent",
  signal: "--kits-color-accent-2",
  critical: "--kits-color-negative",
};

/** 所有组件共有的降级开关（产品可显式关闭，但**不需要**自己实现降级）。 */
export interface MotionFallbackProps {
  /**
   * 强制关闭动效。默认 `false` —— 组件已经内建
   * `prefers-reduced-motion` 与触屏降级，产品通常**不需要**传这个 prop。
   * 只有「用户主动关闭动画」这类产品级开关才用它。
   */
  disableMotion?: boolean;
}

/** 所有组件共有的布局注入点。 */
export interface LayoutProps {
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

export function cx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * 把强度与语调编译成组件级的 CSS 自定义属性。
 * 组件把它挂在根元素上，样式表里只读变量——这样组件的 CSS
 * 完全不知道"medium 是多少"、"brand 是什么颜色"。
 */
export function resolveToneVars(
  tone: Tone,
  intensity: Intensity,
): Record<string, string> {
  return {
    "--kits-component-tone": `var(${TONE_VAR[tone]})`,
    "--kits-component-intensity": String(INTENSITY_SCALE[intensity]),
  };
}

/* ==========================================================================
 * Style Pack Contract —— 视觉资产的第一公民
 *
 * 任何 Style Pack（无论自研还是外部引入）都必须在这份契约内表达自己。
 * 契约只有一个目的：**让风格可替换，而不让产品代码知道换过**。
 *
 * 三层结构：
 *   1. Contract —— 变量名与维度枚举（本段 + styles/_contract/tokens.css）
 *   2. Pack     —— 每个 pack 给这些变量填上自己的值
 *   3. Product  —— 只写 `data-kits-pack="cinematic"`，不写任何具体数值
 *
 * 严禁在 Product / Component 代码里出现 `#0b0e14`、`12px`、`cubic-bezier(...)`
 * 这类字面量 —— 它们只允许存在于 pack 的 tokens.css。
 * ======================================================================== */

/** 资产生命周期。incoming / experimental 的资产禁止进入业务 Prototype。 */
export const ASSET_STATUS = [
  "incoming",
  "experimental",
  "approved",
  "deprecated",
] as const;
export type AssetStatus = (typeof ASSET_STATUS)[number];

/** 资产类型 —— 与 registry/assets.json 的 `type` 字段一一对应。 */
export const ASSET_TYPE = ["style", "component", "effect", "skill"] as const;
export type AssetType = (typeof ASSET_TYPE)[number];

/* --- 十个必须明显不同的维度 ---------------------------------------------- */

/** 1. 排版性格 */
export const TYPE_VOICE = ["editorial", "spatial", "instrumental"] as const;
export type TypeVoice = (typeof TYPE_VOICE)[number];

/** 2. 间距节奏 */
export const SPACING_RHYTHM = ["generous", "layered", "compact"] as const;
export type SpacingRhythm = (typeof SPACING_RHYTHM)[number];

/** 3. 信息密度 */
export const DENSITY = ["low", "medium", "high"] as const;
export type Density = (typeof DENSITY)[number];

/** 4. 圆角哲学：不是「圆多少」，而是「这个风格相信什么」 */
export const RADIUS_PHILOSOPHY = [
  "flush", // 0px —— 印刷直角：没有圆角
  "square", // 1–3px —— 机械公差：有圆角，但小到像制造工艺
  "continuous", // 10–18px —— 材质连续：让光沿边缘爬
  "pill", // 全圆 —— 亲和
] as const;
export type RadiusPhilosophy = (typeof RADIUS_PHILOSOPHY)[number];

/** 5. 边界处理 */
export const BORDER_TREATMENT = [
  "hairline-rule",
  "none-with-depth",
  "hard-technical",
] as const;
export type BorderTreatment = (typeof BORDER_TREATMENT)[number];

/** 6. 表面处理 */
export const SURFACE_TREATMENT = [
  "paper",
  "ambient-glow",
  "panel",
] as const;
export type SurfaceTreatment = (typeof SURFACE_TREATMENT)[number];

/** 7. 导航手感 */
export const NAVIGATION_FEEL = [
  "running-head",
  "overlay-space",
  "rail-console",
] as const;
export type NavigationFeel = (typeof NAVIGATION_FEEL)[number];

/** 8. 数据可视化语言 */
export const DATA_LANGUAGE = [
  "ink-rules",
  "glow-series",
  "instrument-grid",
] as const;
export type DataLanguage = (typeof DATA_LANGUAGE)[number];

/** 9. 动效语言 */
export const MOTION_LANGUAGE = [
  "restrained",
  "atmospheric",
  "precise",
] as const;
export type MotionLanguage = (typeof MOTION_LANGUAGE)[number];

/** 10. 视觉层级建立方式 */
export const HIERARCHY_METHOD = [
  "scale-and-space",
  "light-and-depth",
  "rule-and-label",
] as const;
export type HierarchyMethod = (typeof HIERARCHY_METHOD)[number];

/** 一个 Style Pack 在十个维度上的立场。Registry 与文档都从这里派生。 */
export interface StylePackProfile {
  typeVoice: TypeVoice;
  spacingRhythm: SpacingRhythm;
  density: Density;
  radiusPhilosophy: RadiusPhilosophy;
  borderTreatment: BorderTreatment;
  surfaceTreatment: SurfaceTreatment;
  navigationFeel: NavigationFeel;
  dataLanguage: DataLanguage;
  motionLanguage: MotionLanguage;
  hierarchyMethod: HierarchyMethod;
}

/* --- Motion Contract ------------------------------------------------------ */

/**
 * 动效层级。Motion 服务于状态变化 / 层级 / 反馈 / 数据交互这四类，
 * 任何不属于这四类的动画都不允许存在（见 skills/motion-direction/SKILL.md）。
 */
export const MOTION_ROLES = ["enter", "interact", "ambient", "data"] as const;
export type MotionRole = (typeof MOTION_ROLES)[number];

export type MotionDurationName =
  | "instant"
  | "quick"
  | "base"
  | "slow"
  | "ambient";
export type MotionEaseName = "out" | "inOut" | "linear" | "spring";

/** `motion.ts` 必须导出的形状。时长单位 ms，缓动为 CSS easing 字符串。 */
export interface StylePackMotion {
  /** 该 pack 的动效性格 */
  language: MotionLanguage;
  /** 时长刻度（ms） */
  duration: Record<MotionDurationName, number>;
  /** 缓动刻度（CSS easing 字符串） */
  ease: Record<MotionEaseName, string>;
  /** 逐段揭示的步进（ms） */
  staggerStep: number;
  /** 环境动效周期（ms） */
  ambientCycle: number;
  /** 进入动效位移（CSS 长度字符串） */
  enterDistance: string;
  /** 指针驱动的位移强度倍率（0 = 完全禁用指针视差） */
  pointerFactor: number;
  /** 该 pack 允许使用的动效角色 */
  roles: readonly MotionRole[];
  /** 无障碍：reduced-motion 下保留哪些（弱化的、非位移的）反馈 */
  reducedMotion: {
    /** 全部动画时长坍缩到的值（ms），0 表示完全静态 */
    collapseTo: number;
    /** 是否保留透明度淡入 */
    keepOpacity: boolean;
    /** 是否保留颜色/描边等非位移动效 */
    keepColor: boolean;
    /** reduced-motion 下应当完全关闭的角色 */
    disableRoles: readonly MotionRole[];
  };
  /** 移动端约束 */
  mobile: {
    /** 小于该宽度（px）时启用移动降级 */
    breakpoint: number;
    /** 移动端是否允许指针视差（触屏通常应为 false） */
    pointer: boolean;
    /** 移动端位移量缩放 */
    distanceScale: number;
    /** 移动端环境动效是否关闭（省电 / 省性能） */
    ambient: boolean;
  };
}

/* --- 校验与编译 ------------------------------------------------------------ */

const REQUIRED_DURATIONS: MotionDurationName[] = [
  "instant",
  "quick",
  "base",
  "slow",
  "ambient",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 运行时校验一份 `motion.ts`。Playground 与测试都用它，
 * 因此 pack 作者写错字段会在 CI 里立刻暴露，而不是等到产品上线。
 */
export function assertStylePackMotion(
  value: unknown,
  label = "motion",
): asserts value is StylePackMotion {
  if (!isRecord(value)) throw new Error(`${label}: 必须是对象`);
  if (!MOTION_LANGUAGE.includes(value.language as MotionLanguage)) {
    throw new Error(`${label}.language 非法: ${String(value.language)}`);
  }
  const duration = value.duration;
  if (!isRecord(duration)) throw new Error(`${label}.duration 缺失`);
  for (const name of REQUIRED_DURATIONS) {
    const v = duration[name];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      throw new Error(`${label}.duration.${name} 非法: ${String(v)}`);
    }
    if (name !== "ambient" && v > 1000) {
      throw new Error(
        `${label}.duration.${name}=${v}ms 过长，交互动效上限 1000ms`,
      );
    }
  }
  const ease = value.ease;
  if (!isRecord(ease)) throw new Error(`${label}.ease 缺失`);
  for (const name of ["out", "inOut", "linear", "spring"] as const) {
    if (typeof ease[name] !== "string" || !ease[name]) {
      throw new Error(`${label}.ease.${name} 非法: ${String(ease[name])}`);
    }
  }
  if (typeof value.staggerStep !== "number" || value.staggerStep < 0) {
    throw new Error(`${label}.staggerStep 非法`);
  }
  if (typeof value.ambientCycle !== "number" || value.ambientCycle < 0) {
    throw new Error(`${label}.ambientCycle 非法`);
  }
  if (typeof value.enterDistance !== "string") {
    throw new Error(`${label}.enterDistance 必须是 CSS 长度字符串`);
  }
  if (typeof value.pointerFactor !== "number" || value.pointerFactor < 0) {
    throw new Error(`${label}.pointerFactor 非法`);
  }
  if (!Array.isArray(value.roles) || value.roles.length === 0) {
    throw new Error(`${label}.roles 必须是非空数组`);
  }
  for (const role of value.roles) {
    if (!MOTION_ROLES.includes(role as MotionRole)) {
      throw new Error(`${label}.roles 含非法角色: ${String(role)}`);
    }
  }
  if (!isRecord(value.reducedMotion)) {
    throw new Error(`${label}.reducedMotion 缺失`);
  }
  if (!isRecord(value.mobile)) throw new Error(`${label}.mobile 缺失`);
}

/**
 * 把一份 motion.ts 编译成 CSS 自定义属性。
 * 这是 motion 从 TS 进入 CSS 的**唯一**通道：组件只读 CSS 变量，
 * 因此换 pack 不需要动任何组件代码。
 */
export function motionToCssVars(
  motion: StylePackMotion,
): Record<string, string> {
  return {
    "--kits-dur-instant": `${motion.duration.instant}ms`,
    "--kits-dur-quick": `${motion.duration.quick}ms`,
    "--kits-dur-base": `${motion.duration.base}ms`,
    "--kits-dur-slow": `${motion.duration.slow}ms`,
    "--kits-dur-ambient": `${motion.duration.ambient}ms`,
    "--kits-ease-out": motion.ease.out,
    "--kits-ease-inout": motion.ease.inOut,
    "--kits-ease-linear": motion.ease.linear,
    "--kits-ease-spring": motion.ease.spring,
    "--kits-stagger-step": `${motion.staggerStep}ms`,
    "--kits-ambient-cycle": `${motion.ambientCycle}ms`,
    "--kits-enter-distance": motion.enterDistance,
    "--kits-pointer-factor": String(motion.pointerFactor),
  };
}
