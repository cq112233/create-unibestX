import { green } from 'kolorist'
import type { UILibrary } from '../../types'

export type UILibraryOption = {
  value: UILibrary
  label: string
  hint: string
  branch: string
}

/**
 * 第二步：UI 组件库选项与对应拉取分支
 * rice-ui: 拉取 uniX-rice-ui（默认）
 * uview-ultra: 拉取 uniX-uview-ultra
 * none: 无，拉取 main 分支
 */
export const UI_LIBRARY_OPTIONS: UILibraryOption[] = [
  {
    value: 'rice-ui',
    label: `${green('Rice UI')}（官方推荐）`,
    hint: '官方团队持续维护迭代，无缝支持 Vapor 蒸汽与 VDOM 双模式 (拉取 uniX-rice-ui)',
    branch: 'uniX-rice-ui',
  },
  {
    value: 'uview-ultra',
    label: 'uview-ultra',
    hint: '深度兼容版，满足常规 Vapor/VDOM 业务开发 (拉取 uniX-uview-ultra)',
    branch: 'uniX-uview-ultra',
  },
  {
    value: 'none',
    label: '无 (原生 + Tailwind CSS)',
    hint: '不引入大型第三方 UI 库，纯净原子化基线 (拉取 main 分支)',
    branch: 'main',
  },
]

export const DEFAULT_UI_LIBRARY: UILibrary = 'rice-ui'

export function getBranchByUILibrary(ui: UILibrary): string {
  const match = UI_LIBRARY_OPTIONS.find(opt => opt.value === ui)
  return match ? match.branch : 'uniX-rice-ui'
}
