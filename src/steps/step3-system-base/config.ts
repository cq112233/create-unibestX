import type { Feature } from '../../types'

/**
 * 第三步：系统底座功能定义与裁剪配置
 * 选项：i18n 国际化、theme 主题色
 * 默认：全选
 */
export const SYSTEM_BASE_ITEMS: Feature[] = [
  {
    key: 'i18n',
    label: 'i18n 国际化',
    hint: '多语言国际化支持；不勾选则清理 lime-i18n 插件与多语言包，保留纯中文环境',
    default: true,
    removePaths: [
      'uni_modules/lime-i18n',
      'src/i18n',
      'src/sub/langBasicDemo',
      'src/store/vapor/i18n.ts',
      'src/store/vdom/i18n.uts',
    ],
    patches: [
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
    key: 'theme',
    label: 'theme 主题色',
    hint: '主题换肤与暗黑模式支持；不勾选则清理主题演示分包，保留默认单色主题',
    default: true,
    removePaths: [
      'theme.json',
      'src/theme',
      'src/sub/themeBasicDemo',
      'src/store/vapor/theme.ts',
      'src/store/vdom/theme.uts',
    ],
  },
]
