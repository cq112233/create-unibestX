import type { Feature, Replacement } from '../types'
import { SYSTEM_BASE_ITEMS } from '../steps/step3-system-base/config'
import { CHART_ITEMS } from '../steps/step4-charts/config'
import { EXTRA_FEATURE_ITEMS } from '../steps/step5-features/config'

/**
 * 系统底座功能清单（引用自 step3 配置）
 */
export const SYSTEM_BASE_FEATURES: Feature[] = SYSTEM_BASE_ITEMS

/**
 * 图表方案功能清单（引用自 step4 配置）
 */
export const CHART_FEATURES: Feature[] = CHART_ITEMS

/**
 * 扩展功能清单（引用自 step5 配置）
 */
export const EXTRA_FEATURES: Feature[] = EXTRA_FEATURE_ITEMS

/**
 * 所有可选功能清单（包含系统底座、图表方案与扩展功能）
 */
export const FEATURES: Feature[] = [
  ...SYSTEM_BASE_FEATURES,
  ...CHART_FEATURES,
  ...EXTRA_FEATURES,
]

/**
 * 全局预设清理资产（对齐新架构，默认不误删工程文件与核心页面）
 *
 * 这里的路径**不进第四步选项列表**，任何勾选组合下都直接删掉：
 * - signature（lime-signature 签名板）、device（原生设备与系统能力）与
 *   nestedScroll（自研嵌套滚动）已从选配项中移除，它们的插件、演示分包与组件
 *   不再随项目交付；
 * - 三者都只被各自的演示页引用（签名看板插件仅 signatureFunctionDemo import），
 *   删掉不会影响其它页面。
 * - `src/api/generated` 是 OpenAPI 示例生成物；唯一引用它的 httpBasicDemo 也一并
 *   裁掉，避免生成目录缺失后留下悬空 import。需要时仍可通过 `pnpm api:gen` 重建。
 */
export const ALWAYS_PRUNE_FEATURE_ASSETS = {
  removePaths: [
    'uni_modules/lime-signature',
    'src/sub/signatureFunctionDemo',
    'src/sub/deviceFunctionDemo',
    'src/components/NestedScroll',
    'src/sub/nestedScrollFunctionDemo',
    'src/api/generated',
    'src/sub/httpBasicDemo',
  ] as string[],
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
