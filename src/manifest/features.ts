import type { Feature, Replacement } from '../types'
import { SYSTEM_BASE_ITEMS } from '../steps/step3-system-base/config'
import { EXTRA_FEATURE_ITEMS } from '../steps/step4-features/config'

/**
 * 系统底座功能清单（引用自 step3 配置）
 */
export const SYSTEM_BASE_FEATURES: Feature[] = SYSTEM_BASE_ITEMS

/**
 * 扩展功能清单（引用自 step4 配置）
 */
export const EXTRA_FEATURES: Feature[] = EXTRA_FEATURE_ITEMS

/**
 * 所有可选功能清单（包含系统底座与扩展功能）
 */
export const FEATURES: Feature[] = [
  ...SYSTEM_BASE_FEATURES,
  ...EXTRA_FEATURES,
]

/**
 * 全局预设清理资产（对齐新架构，默认不误删工程文件与核心页面）
 */
export const ALWAYS_PRUNE_FEATURE_ASSETS = {
  removePaths: [] as string[],
  replacements: [] as Replacement[],
  replaceFiles: {} as Record<string, string>,
  removeDeps: [] as string[],
  removeScripts: [] as string[],
}

export const FEATURE_DEFAULTS: Record<string, boolean> = Object.fromEntries(
  FEATURES.map(f => [f.key, f.default]),
)

export function getFeature(key: string): Feature | undefined {
  return FEATURES.find(f => f.key === key)
}
