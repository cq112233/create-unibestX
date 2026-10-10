import process from 'node:process'
import * as p from '@clack/prompts'
import { EXTRA_FEATURE_ITEMS } from './config'
import type { Step4Result } from './types'

/**
 * 第四步：多选扩展功能（对齐 FunctionView 功能演示页）
 * 包含：echarts, signature, rxjs, device, lodash, crypto, webview
 * （注意：z-paging-x 原生分页与 lime-dayuts 时间操作为核心内置，无需勾选）
 * 默认全选
 */
export async function promptStep4Features(): Promise<Step4Result> {
  const choice = await p.multiselect({
    message: '第四步: 请选择扩展功能（空格切换，回车确认）',
    options: EXTRA_FEATURE_ITEMS.map(item => ({
      value: item.key,
      label: item.label,
      hint: item.hint,
    })),
    initialValues: EXTRA_FEATURE_ITEMS.filter(item => item.default).map(item => item.key),
    required: false,
  })

  if (p.isCancel(choice)) {
    p.cancel('操作已取消')
    process.exit(0)
  }

  return {
    extraFeatures: choice as string[],
  }
}
