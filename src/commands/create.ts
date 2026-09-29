import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import * as p from '@clack/prompts'
import { bold, green, yellow } from 'kolorist'
import { acquireTemplate } from '../steps/acquire'
import { finalize } from '../steps/finalize'
import { prune } from '../steps/prune'
import { sanitize } from '../steps/sanitize'
import { removePath } from '../utils/fs'
import { logger } from '../utils/logger'
import { readCliVersion } from '../utils/paths'
import { runSelfCheck } from '../utils/scan'
import { getLatestUnibestXVersion } from '../utils/version'
import type { CliFlags } from './create/prompts'
import { printNextSteps, promptCreateOptions } from './create/prompts'
import type { CreateOptions } from '../types'

const execFileAsync = promisify(execFile)

export type CreateCommandOptions = {
  keepOnFail?: boolean
}

export async function createCommand(
  flags: CliFlags,
  commandOptions: CreateCommandOptions = {},
): Promise<void> {
  const cwd = process.cwd()

  // 如果第一个参数是 create 或 new，剥离子命令
  if (flags._ && (flags._[0] === 'create' || flags._[0] === 'new')) {
    flags._.shift()
  }

  const cliVersion = await readCliVersion()
  const latestTemplateVersion = (await getLatestUnibestXVersion()) || '1.0.0'

  p.intro(bold(green(`create-unibestx@v${cliVersion} 快速创建 ${yellow(`unibestX@v${latestTemplateVersion}`)} 项目`)))

  let options: CreateOptions
  try {
    options = await promptCreateOptions(cwd, flags)
  }
  catch (error: any) {
    logger.error(error?.message ?? String(error))
    process.exit(1)
  }

  const projectDir = path.resolve(cwd, options.targetDir)
  if (existsSync(projectDir)) {
    logger.error(`目录已存在: ${projectDir}`)
    logger.info('请换一个项目名，或删除/重命名已有目录。')
    process.exit(1)
  }

  try {
    await stage('拉取模板', async () => {
      const result = await acquireTemplate(projectDir, options.template, cwd, logger.step)
      if (result.source.kind === 'git') {
        logger.info(`模板仓库: ${result.source.repo} #${result.source.branch}`)
      }
      else {
        logger.info(`模板来源: 本地目录 ${result.source.dir}`)
      }
    })

    const sanitizeResult = await stage('清理噪声与凭据', async () => {
      return sanitize(projectDir, options.projectName, logger.step)
    })
    for (const item of sanitizeResult.scrubbedCredentials) {
      logger.warn(`已清理 ${item}`)
    }

    const pruneResult = await stage('按勾选裁剪项目', async () => {
      return prune(
        projectDir,
        options.projectName,
        {
          features: options.features,
          subPackages: options.subPackages,
          cleanUnusedModules: options.cleanUnusedModules,
        },
        logger.step,
        logger.warn,
      )
    })

    await stage('项目四查自检', async () => {
      const issues = await runSelfCheck(projectDir)
      const errors = issues.filter(i => i.level === 'error')

      for (const issue of issues) {
        const line = `[${issue.code}] ${issue.message}${issue.file ? `（${issue.file}）` : ''}`
        if (issue.level === 'error') {
          logger.error(line)
        }
        else {
          logger.warn(line)
        }
      }

      if (errors.length > 0) {
        throw new SelfCheckFailed(errors.length)
      }
      logger.success('四查自检通过：无悬空 import / 组件标签 / 路由 / 依赖')
    })

    await stage('收尾与环境配置', async () => {
      const result = await finalize(projectDir, options, pruneResult, cliVersion, logger.step, logger.warn)
      if (!result.gitInitialized) {
        logger.warn(`git 初始化失败: ${result.gitError}`)
      }
    })

    printReport(projectDir, options, pruneResult)
    printNextSteps(projectDir, options.install, options)

    if (options.install) {
      await installDeps(projectDir, options.packageManager)
    }
  }
  catch (error: any) {
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

function printReport(
  projectDir: string,
  options: { features: string[], subPackages: string[], cleanUnusedModules: boolean },
  result: Awaited<ReturnType<typeof prune>>,
): void {
  const lines: string[] = []

  lines.push(`保留功能: ${options.features.length > 0 ? options.features.join(', ') : '（无）'}`)
  lines.push(`保留分包: ${options.subPackages.length > 0 ? `${options.subPackages.length} 个分包` : '（无，仅保留 4 个 Tab）'}`)
  lines.push(`清理冗余 uni_modules: ${options.cleanUnusedModules ? '是' : '否'}`)
  lines.push('')
  lines.push(`删除路径: ${result.removedPaths.length} 个`)
  lines.push(`引用改写: ${result.appliedRules} 处`)
  if (result.replacedFiles.length > 0) {
    lines.push(`替换文件: ${result.replacedFiles.join(', ')}`)
  }
  if (result.removedDeps.length > 0) {
    lines.push(`移除依赖: ${result.removedDeps.join(', ')}`)
  }
  if (result.removedScripts.length > 0) {
    lines.push(`移除脚本: ${result.removedScripts.join(', ')}`)
  }

  const { pages, subPackages, easycom } = result.routeCleanup
  if (pages.length + subPackages.length + easycom.length > 0) {
    lines.push('')
    lines.push(`清理失效路由: ${pages.length}`)
    lines.push(`清理空分包: ${subPackages.length}`)
    lines.push(`清理 easycom: ${easycom.length}`)
  }

  p.note(lines.join('\n'), `项目生成报告 · ${path.basename(projectDir)}`)
}

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
