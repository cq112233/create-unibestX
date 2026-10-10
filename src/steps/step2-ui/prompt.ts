import process from 'node:process'
import * as p from '@clack/prompts'
import type { UILibrary } from '../../types'
import { DEFAULT_UI_LIBRARY, getBranchByUILibrary, UI_LIBRARY_OPTIONS } from './config'
import type { Step2Result } from './types'

/**
 * 第二步：单选 UI 组件库
 * rice-ui 拉取 uniX-rice-ui，uview-ultra 拉取 uniX-uview-ultra，无拉取 main 分支，选择完走第三步，默认 rice-ui
 */
export async function promptStep2UI(): Promise<Step2Result> {
  const choice = await p.select({
    message: '第二步: 请选择 UI 组件库',
    options: UI_LIBRARY_OPTIONS.map(opt => ({
      value: opt.value,
      label: opt.label,
      hint: opt.hint,
    })),
    initialValue: DEFAULT_UI_LIBRARY,
  })

  if (p.isCancel(choice)) {
    p.cancel('操作已取消')
    process.exit(0)
  }

  const uiLibrary = choice as UILibrary
  return {
    uiLibrary,
    template: getBranchByUILibrary(uiLibrary),
  }
}
