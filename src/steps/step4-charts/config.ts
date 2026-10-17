import type { Feature } from '../../types'

export type ChartOption = 'xtf-charts' | 'echarts' | 'all' | 'none'

/**
 * 第四步：图表引擎定义与裁剪配置
 * 包含：XTF-Charts 原生图表 与 ECharts 跨端图表
 */
export const CHART_ITEMS: Feature[] = [
  {
    key: 'xtfCharts',
    label: 'XTF-Charts 原生图表',
    hint: '基于 Canvas 2D 零依赖轻量渲染，体积缩减 90%+，全端支持折线、柱状、环形饼图、雷达与仪表盘',
    default: false,
    removePaths: [
      'uni_modules/xtf-charts',
      'src/sub/chartsFunctionDemo',
    ],
  },
  {
    key: 'echarts',
    label: 'ECharts 跨端图表',
    hint: '基于 e-chart 组件，折线图、柱状图、饼图跨端渲染',
    default: false,
    removePaths: [
      'uni_modules/e-chart',
      'src/sub/echartsFunctionDemo',
    ],
  },
]

export const CHART_OPTIONS = [
  {
    value: 'xtf-charts',
    label: 'XTF-Charts 原生跨端图表',
    hint: '推荐：基于 Canvas 2D 零依赖，体积缩减 90%+，全端原生流畅',
  },
  {
    value: 'echarts',
    label: 'ECharts 跨端图表',
    hint: '经典成熟：基于 e-chart 组件与 Webview/Canvas 交互',
  },
  {
    value: 'all',
    label: '两者兼备（全选）',
    hint: '同时保留 XTF-Charts 与 ECharts 双图表引擎及演示分包',
  },
  {
    value: 'none',
    label: '无（不集成图表）',
    hint: '保持项目轻量纯净，不安装任何图表组件与演示分包',
  },
] as const

export const DEFAULT_CHART: ChartOption = 'xtf-charts'
