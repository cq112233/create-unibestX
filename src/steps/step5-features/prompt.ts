import process from 'node:process'
import * as p from '@clack/prompts'
import { EXTRA_FEATURE_ITEMS } from './config'
import type { Step5FeaturesResult } from './types'

/**
 * 第五步：多选业务扩展功能（对齐 FunctionView 功能演示页）
 * 包含：time, limeShared, limeUse, limeColor, bignumber, crypto, webview
 * （注意：z-paging-x 原生分页为核心底座永久保留；图表选型已单独拆为第四步）
 * 默认仅勾选 time（lime-dayuts 时间日期处理），其余默认不选
 */
export async function promptStep5Features(): Promise<Step5FeaturesResult> {
  const choice = await p.multiselect({
    message: '第五步: 请选择业务扩展功能（空格切换，回车确认）',
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
