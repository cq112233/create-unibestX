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
      const result = await acquireTemplate(projectDir, options.template, cwd, () => {})
      if (result.source.kind === 'git') {
        logger.info(`模板仓库: ${result.source.repo} #${result.source.branch}`)
      }
      else {
        logger.info(`模板来源: 本地目录 ${result.source.dir}`)
      }
    })

    await stage('初始化项目', async () => {
      await sanitize(projectDir, options.projectName, () => {})

      const pruneResult = await prune(
        projectDir,
        options.projectName,
        {
          features: options.features,
          subPackages: options.subPackages,
          cleanUnusedModules: options.cleanUnusedModules,
        },
        () => {},
        () => {},
      )

      const issues = await runSelfCheck(projectDir)
      const errors = issues.filter(i => i.level === 'error')
      if (errors.length > 0) {
        for (const issue of errors) {
          logger.error(`[${issue.code}] ${issue.message}${issue.file ? `（${issue.file}）` : ''}`)
        }
        throw new SelfCheckFailed(errors.length)
      }

      await finalize(projectDir, options, pruneResult, cliVersion, () => {}, () => {})
    })

    // 交互询问是否安装依赖
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

    printNextSteps(projectDir, shouldInstall, options)
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
