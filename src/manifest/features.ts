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
    hint: '不勾选则只保留中文：删除语言切换卡片与 en-US 语言包（i18n 运行时是 navbar / tabbar / store 的依赖，会保留）',
    default: true,
    removePaths: [
      'src/pages/basic/components/LangSwitchCard.uvue',
      'src/i18n/locales/en-US.json',
    ],
    patches: dropCardFromView(BASIC_VIEW, 'LangSwitchCard', 'LangSwitchCard.uvue'),
    replacements: [
      {
        file: 'src/i18n/index.uts',
        from: 'import enUS from \'./locales/en-US.json\';',
        to: '',
        label: '移除 en-US 语言包导入',
      },
      {
        file: 'src/i18n/index.uts',
        from: '\'en-US\': enUS as UTSJSONObject',
        to: '',
        label: '移除 en-US 消息注册',
      },
      {
        file: 'src/i18n/index.uts',
        from: 'fallbackLocale: \'en-US\',',
        to: 'fallbackLocale: \'zh-CN\',',
        label: 'fallbackLocale 回落到 zh-CN',
      },
    ],
  },
  {
    key: 'theme',
    label: '主题配置（暗黑模式切换卡片）',
    hint: '不勾选则移除主题切换演示卡片；theme.json 与 src/utils/theme 是骨架依赖，会保留',
    default: true,
    removePaths: ['src/pages/basic/components/ThemeSwitchCard.uvue'],
    patches: dropCardFromView(BASIC_VIEW, 'ThemeSwitchCard', 'ThemeSwitchCard.uvue'),
  },
  {
    key: 'auth',
    label: '登录鉴权 + 路由守卫',
    hint: '登录/注册页、自研路由拦截器、401 跳登录、我的页登录态；不勾选则替换为无登录版「我的」页',
    default: true,
    removePaths: [
      'src/sub/auth',
      'src/router',
      'src/pages/basic/components/RouterDemoCard.uvue',
    ],
    patches: [
      // main.uts：摘掉拦截器安装
      {
        file: 'main.uts',
        start: 'import { installRouteInterceptor } from \'./src/router/interceptor\';',
        label: 'main.uts 移除拦截器 import',
      },
      {
        file: 'main.uts',
        start: 'installRouteInterceptor();',
        label: 'main.uts 移除拦截器安装调用',
      },
      // App.uvue：摘掉直达链接守卫
      {
        file: 'App.uvue',
        start: 'import { checkDirectEntry } from \'./src/router/interceptor\';',
        label: 'App.uvue 移除 checkDirectEntry import',
      },
      {
        file: 'App.uvue',
        start: 'onShow((options?) => {',
        end: '});',
        label: 'App.uvue 移除 onShow 直达守卫块',
      },
      // request.uts：401 与业务码不再跳登录
      {
        file: 'src/http/request.uts',
        start: 'import { toLoginPage } from \'../router/toLoginPage\';',
        label: 'request.uts 移除 toLoginPage import',
      },
      {
        file: 'src/http/request.uts',
        start: 'toLoginPage({ mode: \'reLaunch\' } as UTSJSONObject);',
        occurrence: 'many',
        label: 'request.uts 移除 401 / 业务码跳登录调用',
      },
      ...dropCardFromView(BASIC_VIEW, 'RouterDemoCard', 'RouterDemoCard.uvue'),
    ],
    replaceFiles: {
      'src/pages/me/views/MeView.uvue': 'no-auth/MeView.uvue',
    },
    replacements: [
      {
        file: 'CLAUDE.md',
        from: '鉴权头 / 业务码判定 / 401 跳登录都在 `src/http/request.uts` 的拦截器里',
        to: '鉴权头 / 业务码判定都在 `src/http/request.uts` 的拦截器里（本项目未启用登录鉴权，401 不跳转，需自行处理）',
        label: 'CLAUDE.md 修正 401 跳登录的说明',
      },
    ],
  },
  {
    key: 'echarts',
    label: 'ECharts 图表',
    hint: 'e-chart 组件（内置 echarts.min.js）与功能页图表卡片；不勾选则一并清理 easycom 注册',
    default: true,
    removePaths: [
      'uni_modules/e-chart',
      'src/pages/function/components/EchartsDemoCard.uvue',
    ],
    patches: [
      {
        file: FUNCTION_VIEW,
        start: 'import EchartsDemoCard from \'../components/EchartsDemoCard.uvue\';',
        label: '删除 EchartsDemoCard 的 import',
      },
      {
        file: FUNCTION_VIEW,
        start: '<EchartsDemoCard v-if="isCanvasReady" />',
        label: '删除 <EchartsDemoCard /> 标签',
      },
    ],
  },
  {
    key: 'ai',
    label: 'AI 对话页',
    hint: '带 SSE 流式传输的 AI 对话页（不在底部 Tab 中，独立页面）',
    default: true,
    removePaths: ['src/pages/ai'],
    replacements: [
      {
        file: 'src/tabbar/internal/navigate.uts',
        from: '\'/src/pages/ai/ai\'',
        to: '\'/src/pages/index/index\'',
        label: 'tabbar 兜底跳转从 AI 页改为首页',
      },
    ],
  },
  {
    key: 'skills',
    label: 'AI Skill 框架（.claude / .agents）',
    hint: 'unibestX-skill 知识库与 superpowers 技能框架，共约 1.7MB；AI 编程时需要，普通开发可不要',
    default: false,
    removePaths: ['.claude', '.agents'],
    replaceFiles: {
      'CLAUDE.md': 'no-skills/CLAUDE.md',
      'AGENTS.md': 'no-skills/AGENTS.md',
    },
  },
  {
    key: 'docs',
    label: 'VitePress 文档站',
    hint: 'docs/ 目录与 README 长文；不勾选则替换为精简版 README 并移除 vitepress 依赖',
    default: false,
    removePaths: ['docs'],
    replaceFiles: {
      'README.md': 'minimal/README.md',
    },
    removeDeps: ['vitepress', 'gh-pages'],
    removeScripts: ['docs:dev', 'docs:build', 'docs:preview'],
  },
  {
    key: 'deploy',
    label: 'H5 Docker 部署与 CI',
    hint: 'deploy/、Dockerfile、docker-compose、GitHub / Gitee / workflow 流水线配置',
    default: false,
    removePaths: [
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
    removeScripts: [
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
  },
]

export const FEATURE_DEFAULTS: Record<string, boolean> = Object.fromEntries(
  FEATURES.map(f => [f.key, f.default]),
)

export function getFeature(key: string): Feature | undefined {
  return FEATURES.find(f => f.key === key)
}
