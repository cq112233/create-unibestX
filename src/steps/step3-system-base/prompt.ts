import process from 'node:process'
import * as p from '@clack/prompts'
import { SYSTEM_BASE_ITEMS } from './config'
import type { Step3Result } from './types'

/**
 * 第三步：多选系统底座
 * 选项：i18n 国际化和 theme 主题色，默认全选
 */
export async function promptStep3SystemBase(): Promise<Step3Result> {
  const choice = await p.multiselect({
    message: '第三步: 请选择系统底座（空格切换，回车确认）',
    options: SYSTEM_BASE_ITEMS.map(item => ({
      value: item.key,
      label: item.label,
      hint: item.hint,
    })),
    initialValues: SYSTEM_BASE_ITEMS.filter(item => item.default).map(item => item.key),
    required: false,
  })

  if (p.isCancel(choice)) {
    p.cancel('操作已取消')
    process.exit(0)
  }

  return {
    systemBase: choice as string[],
  }
}
