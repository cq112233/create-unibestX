import process from 'node:process'
import * as p from '@clack/prompts'
import { CHART_OPTIONS, DEFAULT_CHART, type ChartOption } from './config'
import type { Step4ChartsResult } from './types'

/**
 * 第四步：单选图表引擎方案
 * 选项：XTF-Charts (推荐) / ECharts / 全部包含 / 无
 * 默认：xtf-charts
 */
export async function promptStep4Charts(initialChart?: ChartOption): Promise<Step4ChartsResult> {
  const choice = await p.select({
    message: '第四步: 请选择图表引擎方案',
    options: CHART_OPTIONS.map(opt => ({
      value: opt.value,
      label: opt.label,
      hint: opt.hint,
    })),
    initialValue: initialChart ?? DEFAULT_CHART,
  })

  if (p.isCancel(choice)) {
    p.cancel('操作已取消')
    process.exit(0)
  }

  const chart = choice as ChartOption
  let chartFeatures: string[] = []
  if (chart === 'xtf-charts') {
    chartFeatures = ['xtfCharts']
  }
  else if (chart === 'echarts') {
    chartFeatures = ['echarts']
  }
  else if (chart === 'all') {
    chartFeatures = ['xtfCharts', 'echarts']
  }

  return {
    chart,
    chartFeatures,
  }
}
