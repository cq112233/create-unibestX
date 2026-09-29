import { blue, cyan, green, yellow } from 'kolorist'

export function printHelp(): void {
  console.log(`
  ${cyan('create-unibestx')} - ${green('unibestX (uni-app X) 项目脚手架工具')}

  ${blue('使用方式:')}
  ${green('pnpm create unibestx [projectName] [options]')}
  ${green('npx create-unibestx [projectName] [options]')}
  ${green('bestx [projectName] [options]')}
  ${green('unibestx [projectName] [options]')}

  ${blue('快捷命令:')}
  ${green('  pnpm create unibestx my-project             交互式创建新的 unibestX 项目')}
  ${green('  pnpm create unibestx doctor [dir]           对已有项目执行四查自检（组件/路由/导入/依赖）')}
  ${green('  pnpm create unibestx -v                     查看版本信息')}
  ${green('  pnpm create unibestx -h                     查看帮助信息')}

  ${blue('可用子命令:')}
  ${green('  create <projectName>       创建新项目（也可直接指定项目名）')}
  ${green('  doctor [path]              自检指定项目目录')}

  ${blue('创建选项:')}
  ${green('  -u, --ui <library>         指定 UI 库：rice-ui (推荐)、uview-ultra 或 none (无)')}
  ${green('  -p, --platform <types>     支持平台：web, mp-weixin, app-android, app-ios, app-harmony')}
  ${green('                             支持逗号分隔或多选：-p web,mp-weixin')}
  ${green('  -l, --login                启用登录鉴权与路由守卫（--no-login 为禁用）')}
  ${green('  -i, --i18n                 启用多语言 i18n（--no-i18n 为禁用）')}
  ${green('  -t, --theme                启用主题切换卡片')}
  ${green('  --echarts                  启用 ECharts 图表')}
  ${green('  --features <list>          功能开关列表（none = 全不选，all = 全选）')}
  ${green('  --template <source>        模板来源（分支名如 uniX-rice-ui / uniX-uview-ultra / main，或本地目录路径）')}
  ${green('  --keep-unused-modules      保留 25 个零引用 uni_modules（默认会自动清理精简）')}
  ${green('  -m, --package-manager      指定包管理器 (pnpm, npm, yarn)')}
  ${green('  --no-install               生成后不自动安装依赖')}
  ${green('  -y, --yes                  快速生成（使用默认配置跳过交互提问）')}

  ${blue('可选的功能特性 (Features):')}
  ${yellow('  i18n                       多语言国际化支持')}
  ${yellow('  theme                      明暗主题切换与 CSS 变量驱动')}
  ${yellow('  auth                       登录鉴权 + 路由守卫 + 401 拦截')}
  ${yellow('  echarts                    ECharts 图表全端兼容支持')}

  ${blue('示例:')}
  ${green('  # 交互式引导创建')}
  ${cyan('  pnpm create unibestx')}
  ${cyan('  pnpm create unibestx my-app')}

  ${green('  # 快捷参数创建：指定 UI 库与功能')}
  ${cyan('  pnpm create unibestx my-app -u rice-ui -l -i')}
  ${cyan('  pnpm create unibestx my-app -u uview-ultra -p web,mp-weixin')}

  ${green('  # 极简模式：无演示分包与扩展功能')}
  ${cyan('  pnpm create unibestx my-app --features none --subs none')}

  ${green('  # 离线或本地模板创建')}
  ${cyan('  pnpm create unibestx my-app --template /Users/chenqi/Desktop/unibestX')}

  ${green('  # 自检项目完整性')}
  ${cyan('  pnpm create unibestx doctor')}
`)
}
