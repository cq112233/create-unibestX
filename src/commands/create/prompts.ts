import path from 'node:path'
import process from 'node:process'
import * as p from '@clack/prompts'
import { cyan, green, yellow } from 'kolorist'
import { FEATURES, SUB_PACKAGES } from '../../manifest'
import type { CreateOptions, PackageManager, Platform, UILibrary } from '../../types'
import { deriveProjectName, validateProjectName } from '../../utils/validate'

export type CliFlags = {
  _?: string[]
  u?: string
  ui?: string
  p?: string | string[]
  platform?: string | string[]
  l?: boolean | string
  login?: boolean | string
  i?: boolean | string
  i18n?: boolean | string
  echarts?: boolean | string
  ai?: boolean | string
  theme?: boolean | string
  skills?: boolean | string
  docs?: boolean | string
  deploy?: boolean | string
  features?: string
  subs?: string
  template?: string
  keepUnusedModules?: boolean
  packageManager?: string
  m?: string
  install?: boolean | string
  yes?: boolean
  y?: boolean
}

const NONE_VALUES = new Set(['none', 'no', 'false', '0', ''])

function parseList(raw: string, allAllowed: string[]): string[] {
  const value = raw.trim()
  if (NONE_VALUES.has(value.toLowerCase())) {
    return []
  }
  if (value.toLowerCase() === 'all') {
    return [...allAllowed]
  }
  const wanted = value.split(',').map(s => s.trim()).filter(Boolean)
  const unknown = wanted.filter(k => !allAllowed.includes(k))
  if (unknown.length > 0) {
    throw new Error(`未知取值: ${unknown.join(', ')}（可选: ${allAllowed.join(', ')}, none, all）`)
  }
  return wanted
}

function guard(value: unknown): asserts value {
  if (p.isCancel(value)) {
    p.cancel('操作已取消')
    process.exit(0)
  }
}

/**
 * 把非交互 flag 转成 CreateOptions；缺项返回 null 表示需要交互补齐
 */
export function optionsFromFlags(flags: CliFlags): CreateOptions | null {
  const featureKeys = FEATURES.map(f => f.key)
  const subDirs = SUB_PACKAGES.map(s => s.dir)

  const rawName = flags._?.[0]
  if (!rawName || !flags.features) {
    return null
  }

  // 解析模板与 UI 库
  let template = flags.template ?? 'uniX-rice-ui'
  const uiFlag = flags.u || flags.ui
  let uiLibrary: UILibrary = 'rice-ui'
  if (uiFlag === 'uview-ultra') {
    uiLibrary = 'uview-ultra'
    if (!flags.template) {
      template = 'main'
    }
  }
  else if (uiFlag === 'rice-ui') {
    uiLibrary = 'rice-ui'
    if (!flags.template) {
      template = 'uniX-rice-ui'
    }
  }
  else if (uiFlag === 'none' || uiFlag === '无') {
    uiLibrary = 'none'
    if (!flags.template) {
      template = 'base'
    }
  }

  const pkgManager = (flags.packageManager || flags.m || 'pnpm') as PackageManager
  const install = flags.install !== false && flags.install !== 'false'

  return {
    projectName: deriveProjectName(rawName),
    targetDir: rawName,
    uiLibrary,
    features: parseList(flags.features, featureKeys),
    subPackages: flags.subs ? parseList(flags.subs, subDirs) : [],
    cleanUnusedModules: !flags.keepUnusedModules,
    template,
    packageManager: pkgManager,
    install,
  }
}

/**
 * 收集创建配置
 */
export async function promptCreateOptions(
  cwd: string,
  flags: CliFlags,
): Promise<CreateOptions> {
  const subDirs = SUB_PACKAGES.map(s => s.dir)
  const fromFlags = optionsFromFlags(flags)
  if (fromFlags) {
    return fromFlags
  }

  if (flags.yes || flags.y) {
    const rawName = flags._?.[0] ?? 'my-unibestx-app'

    let template = flags.template ?? 'uniX-rice-ui'
    const uiFlag = flags.u || flags.ui
    let uiLibrary: UILibrary = 'rice-ui'
    if (uiFlag === 'uview-ultra') {
      uiLibrary = 'uview-ultra'
      if (!flags.template) {
        template = 'main'
      }
    }
    else if (uiFlag === 'rice-ui') {
      uiLibrary = 'rice-ui'
      if (!flags.template) {
        template = 'uniX-rice-ui'
      }
    }
    else if (uiFlag === 'none' || uiFlag === '无') {
      uiLibrary = 'none'
      if (!flags.template) {
        template = 'base'
      }
    }

    return {
      projectName: deriveProjectName(rawName),
      targetDir: rawName,
      uiLibrary,
      features: FEATURES.filter(f => f.default).map(f => f.key),
      subPackages: flags.subs ? parseList(flags.subs, subDirs) : [],
      cleanUnusedModules: !flags.keepUnusedModules,
      template,
      packageManager: (flags.packageManager || flags.m || 'pnpm') as PackageManager,
      install: flags.install !== false && flags.install !== 'false',
    }
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      '当前不是交互式终端环境，必须显式指定要勾选的内容：\n'
      + '  --features <list>  如 i18n,theme,auth,echarts（none = 全不选，all = 全选）\n'
      + '想要默认值，可以只加 --yes。',
    )
  }

  // 1. 项目名称
  let projectName = flags._?.[0]
  if (!projectName) {
    const inputProjectName = await p.text({
      message: `请输入项目名称 ${green('[仅包含字母、数字、下划线和短横线]')}`,
      placeholder: 'my-unibestx-app',
      initialValue: 'my-unibestx-app',
      validate: (value) => {
        const problem = validateProjectName(value ?? '')
        if (problem) {
          return problem
        }
        return undefined
      },
    })
    guard(inputProjectName)
    projectName = String(inputProjectName).trim()
  }

  // 2. 选择 UI 库
  let uiLibrary: UILibrary = 'rice-ui'
  let defaultTemplate = 'uniX-rice-ui'

  const uiChoice = await p.select({
    message: '请选择 UI 组件库',
    options: [
      {
        value: 'rice-ui',
        label: `${green('Rice UI')}（强烈推荐）`,
        hint: '官方团队持续维护迭代，无缝支持 Vapor 蒸汽与 VDOM 双模式',
      },
      {
        value: 'uview-ultra',
        label: 'uview-ultra',
        hint: '内置深度修复版，已兼容 Vapor/VDOM 基础功能，可满足常规需求',
      },
      {
        value: 'none',
        label: '无',
        hint: '不引入第三方大型 UI 库，使用原生组件与 Tailwind CSS 纯净基线 (base 分支)',
      },
    ],
    initialValue: 'rice-ui',
  })
  guard(uiChoice)
  uiLibrary = uiChoice as UILibrary
  if (uiLibrary === 'uview-ultra') {
    defaultTemplate = 'main'
  }
  else if (uiLibrary === 'none') {
    defaultTemplate = 'base'
  }

  // 3. 目标支持平台（多选展示）
  const selectedPlatforms = await p.multiselect({
    message: `选择需要支持的目标平台（多选） ${green('[全端统一代码，基于 HBuilderX 驱动编译]')}`,
    options: [
      { value: 'web', label: 'H5 / Web', hint: '支持极速热更新与轻量容器部署' },
      { value: 'mp-weixin', label: '微信小程序', hint: '支持 weapp-tailwindcss 原子样式' },
      { value: 'app-android', label: 'Android 原生 App', hint: '高性能 Vapor 原生渲染' },
      { value: 'app-ios', label: 'iOS 原生 App', hint: '高性能 Vapor 原生渲染' },
      { value: 'app-harmony', label: '鸿蒙 (Harmony) Next', hint: '原生鸿蒙支持' },
    ],
    initialValues: ['web', 'mp-weixin', 'app-android', 'app-ios', 'app-harmony'],
    required: true,
  })
  guard(selectedPlatforms)

  // 4. 功能特性勾选（仅保留核心 4 样）
  const selectedFeatures = await p.multiselect({
    message: '选择需要内置的功能特性（空格切换，回车确认）',
    options: FEATURES.map(f => ({
      value: f.key,
      label: f.label,
      hint: f.hint,
    })),
    initialValues: FEATURES.filter(f => f.default).map(f => f.key),
    required: false,
  })
  guard(selectedFeatures)

  // 分包默认不额外保留演示分包，仅按需包含 auth 页面
  const selectedSubs: string[] = flags.subs ? parseList(flags.subs, subDirs) : []

  // 5. 高级选项确认
  const wantsAdvanced = await p.confirm({
    message: '是否需要配置高级选项？（模板来源分支 / 包管理器 / 自动安装）',
    initialValue: false,
  })
  guard(wantsAdvanced)

  let template = flags.template ?? defaultTemplate
  let cleanUnusedModules = true
  let packageManager: PackageManager = 'pnpm'
  let install = true

  if (wantsAdvanced) {
    const advanced = await p.group(
      {
        template: () =>
          p.text({
            message: '模板来源（分支名如 main/uniX-rice-ui，或本地仓库绝对路径）',
            placeholder: defaultTemplate,
            initialValue: defaultTemplate,
          }),
        cleanUnusedModules: () =>
          p.confirm({
            message: '清理 25 个零引用 uni_modules？（实测省约 6MB，可随时手动加回）',
            initialValue: true,
          }),
        packageManager: () =>
          p.select({
            message: '请选择包管理器',
            options: [
              { value: 'pnpm', label: 'pnpm', hint: '推荐' },
              { value: 'npm', label: 'npm' },
              { value: 'yarn', label: 'yarn' },
            ],
            initialValue: 'pnpm',
          }),
        install: () =>
          p.confirm({
            message: '生成后自动安装依赖？',
            initialValue: true,
          }),
      },
      {
        onCancel: () => {
          p.cancel('操作已取消')
          process.exit(0)
        },
      },
    )

    template = String(advanced.template).trim() || defaultTemplate
    cleanUnusedModules = Boolean(advanced.cleanUnusedModules)
    packageManager = advanced.packageManager as PackageManager
    install = Boolean(advanced.install)
  }

  return {
    projectName: deriveProjectName(projectName),
    targetDir: projectName,
    uiLibrary,
    platforms: selectedPlatforms as Platform[],
    features: selectedFeatures as string[],
    subPackages: selectedSubs,
    cleanUnusedModules,
    template,
    packageManager,
    install,
  }
}

/** 打印下一步指引 */
export function printNextSteps(
  projectDir: string,
  install: boolean,
  options: CreateOptions,
): void {
  const rel = path.relative(process.cwd(), projectDir) || '.'

  const lines: string[] = [
    `cd ${rel}`,
  ]

  if (!install) {
    lines.push(`${options.packageManager} install`)
  }

  lines.push(`${options.packageManager} dev            # 运行到 H5 / Web`)
  lines.push(`${options.packageManager} dev:mp-weixin  # 运行到微信小程序`)
  lines.push(`${options.packageManager} dev:app-android # 运行到 Android`)

  p.note(lines.join('\n'), '🎉 快速开始 / Next Steps')

  p.log.info(
    `${cyan('提示:')} 运行 CLI 命令前，请确保已启动 ${yellow('HBuilderX (推荐 5.21+ / 5.24)')}，CLI 本质是驱动 HBuilderX 完成跨端编译。`,
  )
}
