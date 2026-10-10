/** 支持的包管理器 */
export type PackageManager = 'pnpm' | 'npm' | 'yarn'

/** 支持的 UI 库选项 */
export type UILibrary = 'rice-ui' | 'uview-ultra' | 'none'

/**
 * 一条引用清理规则
 *
 * 锚点必须写成目标文件里真实存在的一整行（比较时按 trim 后的内容做 includes 匹配），
 * 这样规则可以被静态校验，而不是靠正则去猜。
 */
export type PatchRule = {
  /** 目标文件（相对项目根） */
  file: string
  /** 起始锚点：命中该行时开始删除 */
  start: string
  /** 结束锚点：命中该行时停止删除（含该行）；省略表示只删 start 这一行 */
  end?: string
  /**
   * start 锚点命中次数：
   * - 'once'（默认）—— 必须且只能命中一次，否则报错，用于防止锚点写得太宽泛
   * - 'many' —— 允许多次命中，规则会应用到全部命中处
   */
  occurrence?: 'once' | 'many'
  /**
   * 起始锚点是否按「保留前导缩进的精确整行」比较
   * 默认对两侧 trim 后做 includes。起始锚点几乎都是代码原文，用默认值即可。
   */
  startExact?: boolean
  /**
   * 结束锚点是否按「保留前导缩进的精确整行」比较
   * 装订一个块的结束行时几乎必须打开它。
   */
  endExact?: boolean
  /**
   * 起始行偏移：实际删除从「命中行 + startOffset」开始
   * 用于锚点落在元素中部、需要把开标签一起删掉的场景。
   */
  startOffset?: number
  /** 锚点未命中时：false（默认）报错中止；true 仅告警并跳过 */
  optional?: boolean
  /** 人话描述，用于日志 */
  label?: string
}

/** 一处精确的文本替换（用于改配置值，而非删代码） */
export type Replacement = {
  file: string
  from: string
  to: string
  optional?: boolean
  label?: string
}

/** 通用功能特性配置项（系统底座与扩展功能均统一使用该结构） */
export type Feature = {
  key: string
  label: string
  hint?: string
  default: boolean
  /** 未勾选时直接删除的文件/目录（如分包目录、插件目录等，相对项目根） */
  removePaths?: string[]
  /** 未勾选时执行的代码修剪 */
  patches?: PatchRule[]
  /** 未勾选时执行的精确文本替换 */
  replacements?: Replacement[]
  /** 未勾选时从 package.json 移除的依赖 */
  removeDeps?: string[]
  /** 未勾选时从 package.json 移除的 scripts */
  removeScripts?: string[]
}

export type TemplateMode = 'complex' | 'minimal'

export type SystemBaseKey = 'i18n' | 'theme'

export type ExtraFeatureKey =
  | 'echarts'
  | 'signature'
  | 'rxjs'
  | 'device'
  | 'lodash'
  | 'crypto'
  | 'webview'
  | 'nestedScroll'

/**
 * 用户最终选定的生成配置
 */
export type CreateOptions = {
  /** 项目名：写进 package.json 的 name、manifest 的应用名、.env 的标题。必须是合法 npm 包名 */
  projectName: string
  /**
   * 目标目录（原样来自位置参数，相对 cwd 或绝对路径）
   */
  targetDir: string
  /** 模板模式：极简模式或复杂模式 */
  templateMode?: TemplateMode
  /** UI 库选择（rice-ui、uview-ultra 或 none） */
  uiLibrary?: UILibrary
  /** 第三步：系统底座勾选项（i18n, theme） */
  systemBase?: string[]
  /** 第四步：扩展功能勾选项（echarts, signature, rxjs, device, lodash, crypto, webview） */
  extraFeatures?: string[]
  /** 功能 key 列表（已勾选的所有功能特性） */
  features: string[]
  /** 是否清理零引用 uni_modules（兼容参数） */
  cleanUnusedModules?: boolean
  /** 模板来源：分支名或本地绝对路径 */
  template: string
  /** 包管理器 */
  packageManager: PackageManager
  /** 是否自动安装依赖 */
  install: boolean
}
