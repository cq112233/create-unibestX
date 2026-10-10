import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import * as p from '@clack/prompts'
import { bold, green, yellow } from 'kolorist'
import { acquireTemplate } from '../steps/acquire'
import type { TemplateSource } from '../steps/acquire'
import { finalize } from '../steps/finalize'
import { promptCreateOptions, printNextSteps } from '../steps/prompt'
import { prune } from '../steps/prune'
import type { PruneResult } from '../steps/prune'
import { sanitize } from '../steps/sanitize'
import type { CreateOptions } from '../types'
import { removePath } from '../utils/fs'
import type { LocalRepoConfig } from '../utils/localRepo'
import { resolveLocalRepo } from '../utils/localRepo'
import { logger } from '../utils/logger'
import { readCliVersion } from '../utils/paths'
import { runSelfCheck } from '../utils/scan'
import { getLatestUnibestXVersion } from '../utils/version'

const execFileAsync = promisify(execFile)

/**
 * CLI 命令参数定义（minimist 的原始解析产物）
 */
export type CliFlags = {
  /** 位置参数：第 0 项通常为项目名 */
  _?: string[]
  /** -u / --ui: 指定 UI 组件库 (rice-ui / uview-ultra / none) */
  u?: string
  ui?: string
  /** --features: 指定开启的功能特性列表（逗号分隔，或 none / all） */
  features?: string
  /** -t / --template: 指定分支名或本地目录路径 */
  template?: string
  /** --local-repo: 本地模板仓库绝对路径（不带值时回退至环境变量） */
  'local-repo'?: boolean | string
  /** --no-local 时由 minimist 置为 false */
  local?: boolean
  /** --keep-unused-modules: 保留全部 uni_modules（跳过依赖检测） */
  'keep-unused-modules'?: boolean
  /** -m / --package-manager: 指定包管理器 (pnpm / npm / yarn) */
  packageManager?: string
  m?: string
  /** --no-install 时为 false，不自动安装依赖 */
  install?: boolean | string
  /** -y / --yes: 跳过所有交互提问，直接使用默认配置快速生成 */
  yes?: boolean
  y?: boolean
}

export type CreateCommandOptions = {
  /** 自检失败时是否保留现场文件（默认自动回滚清理） */
  keepOnFail?: boolean
}

/**
 * 创建新项目的核心命令入口
 *
 * 完整生命周期流程：
 * 1. 规范化处理命令行位置参数（兼容 create / new 子命令）
 * 2. 读取 CLI 及模板最新版本号，打印欢迎横幅
 * 3. 校验并解析本地仓库调试模式（提前失败原则）
 * 4. 调用步骤协调器（promptCreateOptions）收集用户创建配置
 * 5. 目标目录冲突检测（防止覆盖已有项目）
 * 6. 阶段一：拉取模板（本地克隆 / 远程拉取目标分支）
 * 7. 阶段二：初始化与裁剪（极简模式跳过裁剪，复杂模式按需裁剪与自检）
 * 8. 阶段三：收尾写入元信息与环境变量
 * 9. 阶段四：按需安装依赖（pnpm/npm/yarn）
 * 10. 阶段五：打印快速开始指引与异常事务回滚
 *
 * @param flags 命令行解析出的参数对象
 * @param commandOptions 命令行为控制选项（如失败时是否保留现场）
 */
export async function createCommand(
  flags: CliFlags,
  commandOptions: CreateCommandOptions = {},
): Promise<void> {
  const cwd = process.cwd()

  // 1. 如果第一个参数是 create 或 new，剥离冗余子命令关键字，取后续的真实项目名
  if (flags._ && (flags._[0] === 'create' || flags._[0] === 'new')) {
    flags._.shift()
  }

  // 2. 读取 CLI 本身版本号与模板版本，渲染友好的终端欢迎信息
  const cliVersion = await readCliVersion()
  const latestTemplateVersion = (await getLatestUnibestXVersion()) || '1.0.0'

  p.intro(bold(green(`create-unibestx@v${cliVersion} 快速创建 ${yellow(`unibestX@v${latestTemplateVersion}`)} 项目`)))

  // 3. 本地模板模式先于交互解析：如果配置了 --local-repo 但路径无效，立刻报错中断，避免用户输入一堆选项后才失败
  let localRepo: LocalRepoConfig
  try {
    const resolution = await resolveLocalRepo(flags)
    localRepo = resolution.config
    for (const message of resolution.warnings) {
      logger.warn(message)
    }
  }
  catch (error: any) {
    logger.error(error?.message ?? String(error))
    process.exit(1)
  }

  if (localRepo.mode === 'on') {
    logger.info(`本地模板模式已开启: ${localRepo.root}（--no-local 可单次关闭）`)
  }

  // 4. 收集创建选项：通过独立步骤向导（steps/prompt）或命令行快速参数解析
  let options: CreateOptions
  try {
    options = await promptCreateOptions(cwd, flags)
  }
  catch (error: any) {
    logger.error(error?.message ?? String(error))
    process.exit(1)
  }

  // 5. 检测目标目录是否已存在：若存在则安全阻断，避免破坏用户已有文件
  const projectDir = path.resolve(cwd, options.targetDir)
  if (existsSync(projectDir)) {
    logger.error(`目录已存在: ${projectDir}`)
    logger.info('请换一个项目名，或删除/重命名已有目录。')
    process.exit(1)
  }

  try {
    // 记录取模板阶段解析出的实际来源标签，收尾时写入生成物 package.json 的元数据中
    let templateLabel = options.template

    // ==========================================
    // 阶段一：拉取模板代码
    // ==========================================
    await stage('拉取模板', async () => {
      const result = await acquireTemplate(projectDir, options.template, cwd, localRepo)
      templateLabel = result.label
      for (const message of result.warnings) {
        logger.warn(message)
      }
      logger.info(describeSource(result.source))
    })

    // 判断是否为极简模式（base 分支本身就是纯净基线，零冗余代码）
    const isMinimalTemplate = options.template === 'base'

    // ==========================================
    // 阶段二：初始化与按需裁剪项目
    // ==========================================
    await stage('初始化项目', async () => {
      // 1. 基础规范化：清理旧 Git 历史、更新 package.json 项目名等
      await sanitize(projectDir, options.projectName, () => {})

      let pruneResult: PruneResult

      if (isMinimalTemplate) {
        // 极简模板（base 分支）无需裁剪，直接返回空操作统计
        pruneResult = {
          removedPaths: [],
          appliedRules: 0,
          skippedRules: [],
          replacedFiles: [],
          removedDeps: [],
          removedScripts: [],
          routeCleanup: { pages: [], subPackages: [], easycom: [] },
        }
      }
      else {
        // 复杂模式：按照用户勾选的系统底座与扩展功能，执行安全精准的裁剪
        pruneResult = await prune(
          projectDir,
          options.projectName,
          {
            features: options.features,
            cleanUnusedModules: options.cleanUnusedModules,
          },
          () => {},
          () => {},
        )

        // 裁剪后执行严格自检：检查是否有悬空 import、未声明模块或丢失的路由
        const issues = await runSelfCheck(projectDir)
        const errors = issues.filter(i => i.level === 'error')
        if (errors.length > 0) {
          for (const issue of errors) {
            logger.error(`[${issue.code}] ${issue.message}${issue.file ? `（${issue.file}）` : ''}`)
          }
          throw new SelfCheckFailed(errors.length)
        }
      }

      // 2. 收尾同步：写入 unibestx 元数据、同步 package.json 依赖与 .env 配置
      await finalize(projectDir, options, pruneResult, cliVersion, templateLabel, () => {}, () => {})
    })

    // ==========================================
    // 阶段三：询问并执行依赖安装
    // ==========================================
    let shouldInstall = options.install
    if (process.stdin.isTTY && shouldInstall) {
      const confirmInstall = await p.confirm({
        message: `是否立即安装依赖？（${options.packageManager} install）`,
        initialValue: true,
      })
      if (p.isCancel(confirmInstall)) {
        shouldInstall = false
      }
      else {
        shouldInstall = confirmInstall
      }
    }

    if (shouldInstall) {
      await installDeps(projectDir, options.packageManager)
    }

    // ==========================================
    // 阶段四：打印下一步操作指引
    // ==========================================
    printNextSteps(projectDir, shouldInstall, options)
  }
  catch (error: any) {
    // 事务性安全保护：若自检失败且未开启 --keep-on-fail，自动回滚删除生成目录
    if (error instanceof SelfCheckFailed && !commandOptions.keepOnFail) {
      logger.error(`自检失败（${error.count} 处错误），已回滚生成物。`)
      logger.info('添加 --keep-on-fail 参数可以保留失败现场排查。')
      await removePath(projectDir)
      process.exit(1)
    }
    if (error instanceof SelfCheckFailed) {
      logger.error(`自检失败（${error.count} 处错误），现场已保留在 ${projectDir}`)
      process.exit(1)
    }
    logger.error(`创建项目失败: ${error?.message ?? String(error)}`)
    if (!commandOptions.keepOnFail) {
      await removePath(projectDir)
    }
    process.exit(1)
  }
}

class SelfCheckFailed extends Error {
  readonly count: number
  constructor(count: number) {
    super(`自检未通过（${count} 处错误）`)
    this.name = 'SelfCheckFailed'
    this.count = count
  }
}

/**
 * 格式化渲染模板来源日志文本
 */
function describeSource(source: TemplateSource): string {
  switch (source.kind) {
    case 'literal-dir': {
      const head = source.headBranch === null
        ? ''
        : `，当前分支 ${source.headBranch}${source.dirtyCount > 0 ? `，含 ${source.dirtyCount} 处未提交改动` : ''}`
      return `模板来源: 本地目录 ${source.dir}${head}`
    }
    case 'local-branch': {
      const detail = source.from === 'workspace'
        ? `工作区${source.dirtyCount > 0 ? `，含 ${source.dirtyCount} 处未提交改动` : ''}`
        : '本地克隆，仅已提交内容'
      return `模板来源: 本地仓库 ${source.repoRoot} #${source.branch}（${detail}）`
    }
    case 'git':
      return `模板仓库: ${source.repo} #${source.branch}`
  }
}

/**
 * 统一包装步骤执行状态与终端加载指示器
 */
async function stage<T>(title: string, run: () => Promise<T>): Promise<T> {
  const task = logger.start(title)
  try {
    const result = await run()
    task.stop(`${title} ✓`)
    return result
  }
  catch (error) {
    task.fail(`${title} ✗`)
    throw error
  }
}

/**
 * 自动安装项目依赖
 */
async function installDeps(projectDir: string, packageManager: string): Promise<void> {
  const task = logger.start(`正在安装依赖（${packageManager} install）...`)
  try {
    await execFileAsync(packageManager, ['install'], {
      cwd: projectDir,
      maxBuffer: 64 * 1024 * 1024,
    })
    task.stop('依赖安装完成 ✓')
  }
  catch (error: any) {
    task.fail('依赖安装失败')
    logger.warn(String(error?.stderr ?? error?.message ?? error).trim().slice(0, 2000))
    logger.info(`项目已生成完毕，可进入目录手动执行 ${packageManager} install 重新安装。`)
  }
}
