import type { Feature } from '../types'

const BASIC_VIEW = 'src/pages/basic/views/BasicView.uvue'
const FUNCTION_VIEW = 'src/pages/function/views/FunctionView.uvue'

/** 在某个视图里同时删掉一个组件的 import 行与标签行 */
function dropCardFromView(view: string, component: string, fileName: string) {
  return [
    {
      file: view,
      start: `import ${component} from '../components/${fileName}';`,
      label: `删除 ${component} 的 import`,
    },
    {
      file: view,
      start: `<${component} />`,
      label: `删除 <${component} /> 标签`,
    },
  ]
}

/**
 * 可勾选的功能清单
 *
 * ⚠️ 关于 i18n 与主题的「精简模式」：
 * 这两个功能不是可删的（src/store/<模式>/app 反向依赖它们，真删会带崩全部 19 页），
 * 所以这里的做法是保留底座、只删演示层 —— 详见各条目的 hint。
 */
export const FEATURES: Feature[] = [
  {
    key: 'i18n',
    label: '多语言 i18n',
    hint: '多语言国际化支持；不勾选则彻底删除 lime-i18n 插件与 src/i18n 目录，保留纯中文轻量环境',
    default: true,
    removePaths: [
      'src/i18n',
      'uni_modules/lime-i18n',
    ],
    replaceFiles: {
      'src/utils/i18n/index.uts': 'no-i18n/i18n-utils.uts',
      // 轻量版的导出面与完整版不同（没有 I18nUtils / testI18n / 默认导出），
      // 声明文件必须一起换，否则 IDE 会按完整版的类型放行不存在的导出，
      // 且 pnpm check:uts-dts 会判定声明与源码不同步
      'src/utils/i18n/index.d.uts.ts': 'no-i18n/i18n-utils.d.uts.ts',
      'src/store/vapor/app.ts': 'no-i18n/vapor-app.ts',
      'src/store/vdom/app.uts': 'no-i18n/vdom-app.uts',
    },
    patches: [
      // main.uts 移除 i18n
      {
        file: 'main.uts',
        start: 'import i18n from \'./src/i18n\';',
        optional: true,
        label: 'main.uts 移除 i18n import',
      },
      {
        file: 'main.uts',
        start: 'app.use(i18n);',
        optional: true,
        label: 'main.uts 移除 app.use(i18n)',
      },
    ],
  },
  {
    key: 'echarts',
    label: 'ECharts 图表',
    hint: 'e-chart 组件（内置 echarts.min.js）；不勾选则裁剪 uni_modules/e-chart 插件',
    default: true,
    removePaths: [
      'uni_modules/e-chart',
    ],
  },
]

/**
 * 核心非必要特性与演示卡片资产
 * 基础页与功能页重置为纯净空白视图，默认清理所有演示 Card 组件与非核心资产
 */
export const ALWAYS_PRUNE_FEATURE_ASSETS = {
  removePaths: [
    'uni_modules/lime-icon',
    'uni_modules/lime-shared',
    'uni_modules/lime-style',
    'uni_modules/uni-scss',
    'src/pages/basic/components',
    'src/pages/function/components',
    'src/pages/ai',
    '.claude',
    '.agents',
    'docs',
    'deploy',
    'Dockerfile',
    'docker-compose.yml',
    '.dockerignore',
    '.github',
    '.gitee',
    '.workflow',
    'scripts/build-h5.mjs',
    'scripts/switch-env.mjs',
  ],
  replacements: [
    {
      file: 'src/tabbar/internal/navigate.uts',
      from: '\'/src/pages/ai/ai\'',
      to: '\'/src/pages/index/index\'',
      optional: true,
      label: 'tabbar 兜底跳转从 AI 页改为首页',
    },
    {
      file: 'uni_modules/uni-icons/package.json',
      from: `"dependencies": [
      "uni-scss"
    ]`,
      to: '"dependencies": []',
      optional: true,
      label: 'uni-icons 移除对已删除 uni-scss 的依赖',
    },
  ],
  replaceFiles: {
    'src/pages/basic/views/BasicView.uvue': 'clean-pages/BasicView.uvue',
    'src/pages/function/views/FunctionView.uvue': 'clean-pages/FunctionView.uvue',
    'CLAUDE.md': 'no-skills/CLAUDE.md',
    'AGENTS.md': 'no-skills/AGENTS.md',
    'README.md': 'minimal/README.md',
  },
  removeDeps: ['vitepress', 'gh-pages'],
  removeScripts: [
    'docs:dev',
    'docs:build',
    'docs:preview',
    'build:h5',
    'env:test',
    'env:prod',
    'build:test',
    'build:prod',
    'docker:build:test',
    'docker:build:prod',
    'docker:up:test',
    'docker:up:prod',
    'docker:stop:test',
    'docker:stop:prod',
    'docker:down:test',
    'docker:down:prod',
    'docker:down',
  ],
}

export const FEATURE_DEFAULTS: Record<string, boolean> = Object.fromEntries(
  FEATURES.map(f => [f.key, f.default]),
)

export function getFeature(key: string): Feature | undefined {
  return FEATURES.find(f => f.key === key)
}
