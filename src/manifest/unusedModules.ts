/**
 * 无论怎么裁剪都要保留的 uni_modules 核心底座
 *
 * z-paging-x 是列表页的原生底座（下拉刷新 / 上拉加载 / 聊天记录模式），
 * 不在第四步选配项里，插件本体永久保留。
 *
 * 注意：lime-dayuts 已移出本清单 —— 它是第四步的 time 项（默认勾选），
 * 取消勾选时插件本体与 src/sub/timeFunctionDemo 一并清理。
 * uniX-uview-ultra 分支无需特殊处理：uview-ultra 的 package.json 声明了
 * uni_modules.dependencies: ['lime-dayuts']，由 resolveModuleClosure 自动保护。
 */
export const ALWAYS_KEEP_MODULES: string[] = [
  'z-paging-x',
]

export const UNUSED_MODULES: string[] = []
export const ORPHAN_FILES: string[] = []
export const SCRIPTS_TIED_TO_UNUSED_MODULES: string[] = []
export const HARNESS_TIED_TO_UNUSED_MODULES: string[] = []

