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
      // 注意：模板已把 src/store/vapor/*.ts 改名为 .uts（仅 base 分支仍是 .ts，
      // 而 base 走极简模式、不经过 prune），写成 .ts 会导致文件留下、其内部
      // import 的 src/i18n 已被删掉，生成后被自检判为悬空 import 而整体回滚。
      'src/store/vapor/i18n.uts',
      'src/store/vdom/i18n.uts',
      // 单元测试直接 import src/i18n 内部模块，不跟着删同样会悬空
      'tests/unit/utils/i18n-text.test.ts',
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
      // 同 i18n：模板 vapor store 已改名 .uts，写 .ts 会让 theme store 残留
      'src/store/vapor/theme.uts',
      'src/store/vdom/theme.uts',
    ],
  },
]
