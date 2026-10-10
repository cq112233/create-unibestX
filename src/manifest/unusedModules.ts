/**
 * 无论怎么裁剪都要保留的 uni_modules 核心底座
 *
 * 1. z-paging-x 是列表页的原生底座（下拉刷新 / 上拉加载 / 聊天记录模式）；
 * 2. lime-dayuts 是轻量高性能时间日期处理底座（uview-ultra 深度依赖，业务与请求日志高频使用）；
 * 两者均为项目核心必备底座能力，永久保留，不提供取消勾选项。
 */
export const ALWAYS_KEEP_MODULES: string[] = [
  'z-paging-x',
  'lime-dayuts',
]

export const UNUSED_MODULES: string[] = []
export const ORPHAN_FILES: string[] = []
export const SCRIPTS_TIED_TO_UNUSED_MODULES: string[] = []
export const HARNESS_TIED_TO_UNUSED_MODULES: string[] = []

