/**
 * 【用户交互向导总协调器】
 *
 * 负责收集、校验并组织项目创建所需的全部配置参数：
 * 1. 非交互极速模式处理（-y / --yes 或直接带参数时，通过 optionsFromFlags 组装配置）；
 * 2. 交互式多步骤向导串联：
 *    - 步骤 0：项目名称输入与格式校验；
 *    - 步骤 1：模板模式单选（极简模式拉取 base，复杂模式继续后续步骤）；
 *    - 步骤 2：UI 组件库单选（rice-ui / uview-ultra / 无）；
 *    - 步骤 3：系统底座多选（i18n 国际化、theme 主题色）；
 *    - 步骤 4：扩展功能多选（echarts, signature, rxjs, device, lodash, crypto, webview）；
 *    - 步骤 5：预留位（配置包管理器与后续扩展）；
 * 3. 产物交付：输出标准 CreateOptions，并提供项目创建后的快捷启动指引 printNextSteps。
 */
import path from 'node:path'
import process from 'node:process'
import * as p from '@clack/prompts'
import { cyan, green, yellow } from 'kolorist'
import { EXTRA_FEATURES, FEATURES, SYSTEM_BASE_FEATURES } from '../manifest'
import { promptStep1Mode } from './step1-mode'
import { promptStep2UI } from './step2-ui'
import { promptStep3SystemBase } from './step3-system-base'
import { promptStep4Features } from './step4-features'
import { promptStep5Reserved } from './step5-reserved'
import type { CreateOptions, PackageManager, TemplateMode, UILibrary } from '../types'
import { deriveProjectName, validateProjectName } from '../utils/validate'
import type { CliFlags } from '../commands/create'


const NONE_VALUES = new Set(['none', 'no', 'false', '0', ''])

/**
 * 解析用户通过逗号分隔输入的特性列表参数（如 --features i18n,theme）
 * @param raw 原始字符串输入
 * @param allAllowed 允许的所有特性 key 集合
 */
function parseList(raw: string, allAllowed: string[]): string[] {
  const value = raw.trim()
  if (NONE_VALUES.has(value.toLowerCase())) {
    return []
  }
  if (value.toLowerCase() === 'all') {
    return [...allAllowed]
  }
  const wanted = value.split(',').map(s => s.trim()).filter(Boolean)
  // 过滤出合法选项，容错旧内置项与核心能力项
  const validWanted = wanted.filter(k => allAllowed.includes(k))
  const unknown = wanted.filter(
    k => !allAllowed.includes(k)
      && k !== 'auth'
      && k !== 'theme'
      && k !== 'z-paging-x'
      && k !== 'zpaging'
      && k !== 'dayuts'
      && k !== 'time',
  )
  if (unknown.length > 0) {
    throw new Error(`未知取值: ${unknown.join(', ')}（可选: ${allAllowed.join(', ')}, none, all）`)
  }
  return validWanted
}

/**
 * 校验用户交互中断操作（如按下 Ctrl+C 取消）
 */
function guard(value: unknown): asserts value {
  if (p.isCancel(value)) {
    p.cancel('操作已取消')
    process.exit(0)
  }
}

/**
 * 将命令行参数转化为标准的 CreateOptions 配置；
 * 若未提供完整必须参数，返回 null 以触发交互式问答流程补齐。
 */
export function optionsFromFlags(flags: CliFlags): CreateOptions | null {
  const featureKeys = FEATURES.map(f => f.key)

  const rawName = flags._?.[0]
  if (!rawName || !flags.features) {
    return null
  }

  // 解析模板分支与 UI 组件库
  let template = flags.template ?? 'uniX-rice-ui'
  const uiFlag = flags.u || flags.ui
  let uiLibrary: UILibrary = 'rice-ui'
  if (uiFlag === 'uview-ultra') {
    uiLibrary = 'uview-ultra'
    if (!flags.template) {
      template = 'uniX-uview-ultra'
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
      template = 'main'
    }
  }

  const pkgManager = (flags.packageManager || flags.m || 'pnpm') as PackageManager
  const install = flags.install !== false && flags.install !== 'false'

  return {
    projectName: deriveProjectName(rawName),
    targetDir: rawName,
    uiLibrary,
    features: parseList(flags.features, featureKeys),
    cleanUnusedModules: !flags['keep-unused-modules'],
    template,
    packageManager: pkgManager,
    install,
  }
}

/**
 * 收集并组织项目创建配置（分步交互向导）
 *
 * 流程包含：
 * 0. 确认项目名称与目录
 * 1. 第一步：单选模板模式（极简模式拉取 base，复杂模式继续后续步骤）
 * 2. 第二步：单选 UI 组件库（rice-ui / uview-ultra / 无）
 * 3. 第三步：多选系统底座（i18n 国际化、theme 主题色）
 * 4. 第四步：多选扩展功能（echarts, signature, rxjs, device, lodash, crypto, webview）
 * 5. 第五步：预留位（配置包管理器与后续扩展）
 */
export async function promptCreateOptions(
  cwd: string,
  flags: CliFlags,
): Promise<CreateOptions> {
  const featureKeys = FEATURES.map(f => f.key)
  const fromFlags = optionsFromFlags(flags)
  if (fromFlags) {
    return fromFlags
  }

  // 非交互快速模式（指定了 -y / --yes）
  if (flags.yes || flags.y) {
    const rawName = flags._?.[0] ?? 'my-unibestx-app'

    let template = flags.template ?? 'uniX-rice-ui'
    const uiFlag = flags.u || flags.ui
    let uiLibrary: UILibrary = 'rice-ui'
    if (uiFlag === 'uview-ultra') {
      uiLibrary = 'uview-ultra'
      if (!flags.template) {
        template = 'uniX-uview-ultra'
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
        template = 'main'
      }
    }

    const defaultFeatures = FEATURES.filter(f => f.default).map(f => f.key)
    const selectedFeatures = flags.features ? parseList(flags.features, featureKeys) : defaultFeatures

    return {
      projectName: deriveProjectName(rawName),
      targetDir: rawName,
      templateMode: 'complex',
      uiLibrary,
      systemBase: selectedFeatures.filter(k => SYSTEM_BASE_FEATURES.some(f => f.key === k)),
      extraFeatures: selectedFeatures.filter(k => EXTRA_FEATURES.some(f => f.key === k)),
      features: selectedFeatures,
      cleanUnusedModules: !flags['keep-unused-modules'],
      template,
      packageManager: (flags.packageManager || flags.m || 'pnpm') as PackageManager,
      install: flags.install !== false && flags.install !== 'false',
    }
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      '当前不是交互式终端环境，必须显式指定要勾选的内容：\n'
      + '  --features <list>  如 i18n,theme,lodash,echarts（none = 全不选，all = 全选）\n'
      + '想要默认值，可以只加 --yes。',
    )
  }

  // 0. 项目名称输入与格式校验
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

  // 1. 第一步：单选：模板模式选择（极简模式直接拉取 base 分支，复杂模式走第二步，默认复杂模式）
  const step1 = await promptStep1Mode()

  // ── 极简模式：直接拉取 base 分支，跳过第 2~5 步 ──
  if (step1.mode === 'minimal') {
    const template = flags.template ?? 'base'
    const packageManager: PackageManager = (flags.packageManager || flags.m || 'pnpm') as PackageManager
    const install = flags.install !== false && flags.install !== 'false'

    return {
      projectName: deriveProjectName(projectName),
      targetDir: projectName,
      templateMode: 'minimal',
      uiLibrary: 'none',
      systemBase: [],
      extraFeatures: [],
      features: [],
      cleanUnusedModules: !flags['keep-unused-modules'],
      template,
      packageManager,
      install,
    }
  }

  // ── 复杂模式：进入第 2、3、4、5 步 ──

  // 2. 第二步: 单选：选择 UI 组件库（rice-ui 拉取 uniX-rice-ui，uview-ultra 拉取 uniX-uview-ultra，无拉取 main 分支，默认 rice-ui）
  const step2 = await promptStep2UI()

  // 3. 第三步: 多选：选择系统底座（i18n 国际化和 theme 主题色，默认全选）
  const step3 = await promptStep3SystemBase()

  // 4. 第四步: 多选：选择扩展功能（echarts, signature, rxjs, device, lodash, crypto, webview, nestedScroll，默认都不选）
  const step4 = await promptStep4Features()

  // 5. 第五步: 预留位（配置包管理器与后续扩展）
  const step5 = await promptStep5Reserved(
    (flags.packageManager || flags.m || 'pnpm') as PackageManager,
    flags.install !== false && flags.install !== 'false',
  )

  const template = flags.template ?? step2.template
  const cleanUnusedModules = !flags['keep-unused-modules']
  const packageManager = step5.packageManager
  const install = step5.install

  const combinedFeatures = [
    ...step3.systemBase,
    ...step4.extraFeatures,
  ]

  return {
    projectName: deriveProjectName(projectName),
    targetDir: projectName,
    templateMode: 'complex',
    uiLibrary: step2.uiLibrary,
    systemBase: step3.systemBase,
    extraFeatures: step4.extraFeatures,
    features: combinedFeatures,
    cleanUnusedModules,
    template,
    packageManager,
    install,
  }
}

/**
 * 打印项目创建完成后的下一步运行提示
 */
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
  lines.push(`${options.packageManager} dev:mp-alipay  # 运行到支付宝小程序`)
  lines.push(`${options.packageManager} dev:app-android # 运行到 Android`)
  lines.push(`${options.packageManager} dev:app-ios    # 运行到 iOS (模拟器)`)
  lines.push(`${options.packageManager} dev:app-harmony # 运行到 HarmonyOS 鸿蒙`)

  p.note(lines.join('\n'), '🎉 快速开始 / Next Steps')

  p.log.info(
    `欢迎使用 unibestX！提示: 运行 CLI 命令前，请确保已启动 ${yellow('HBuilderX (推荐 5.21+ / 5.24)')}，CLI 本质是驱动 HBuilderX 完成跨端编译。`,
  )
}
