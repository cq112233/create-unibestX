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
  ${green('  -f, --features <list>      功能开关的入口（none = 全不选，all = 全选，或逗号分隔）')}
  ${green('  -t, --template <source>    模板来源（分支名如 uniX-rice-ui / uniX-uview-ultra / main / base，或本地路径）')}
  ${green('  --local-repo <path>        本地模板仓库路径。设了之后按 --template 的分支名从本地仓库取内容')}
  ${green('                             不带值时读 UNIBESTX_LOCAL_REPO 环境变量；环境变量即常开')}
  ${green('  --keep-unused-modules      保留全部 uni_modules（跳过依赖检测）')}
  ${green('  -m, --package-manager      指定包管理器 (pnpm, npm, yarn)')}
  ${green('  --no-install               生成后不自动安装依赖')}
  ${green('  -y, --yes                  快速生成（使用默认配置跳过交互提问）')}
  ${green('  --keep-on-fail             自检失败时保留生成物现场，便于排查（默认自动回滚）')}

  ${blue('可选的功能特性 (Features):')}
  ${yellow('  系统底座: i18n, theme')}
  ${yellow('  扩展功能: echarts, signature, rxjs, device, lodash, crypto, webview, nestedScroll')}

  ${blue('示例:')}
  ${green('  # 交互式引导创建')}
  ${cyan('  pnpm create unibestx')}
  ${cyan('  pnpm create unibestx my-app')}

  ${green('  # 快捷参数创建：指定 UI 库与功能')}
  ${cyan('  pnpm create unibestx my-app -u rice-ui -f i18n,theme,echarts')}
  ${cyan('  pnpm create unibestx my-app -u uview-ultra -f lodash,crypto')}

  ${green('  # 极简模式：直接拉取纯净 base 分支')}
  ${cyan('  pnpm create unibestx my-app --template base')}

  ${green('  # 调试本地模板仓库（按分支从本地取，未提交改动也会生效）')}
  ${cyan('  export UNIBESTX_LOCAL_REPO=/Users/chenqi/Desktop/unibestX')}
  ${cyan('  pnpm create unibestx my-app -u rice-ui')}
  ${cyan('  pnpm create unibestx my-app --local-repo /Users/chenqi/Desktop/unibestX --template uniX-uview-ultra')}

  ${green('  # 离线或指定模板目录（指哪个目录拷哪个目录）')}
  ${cyan('  pnpm create unibestx my-app --no-local --template /Users/chenqi/Desktop/unibestX')}

  ${green('  # 自检项目完整性')}
  ${cyan('  pnpm create unibestx doctor')}
`)
}
