import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { logger } from '../utils/logger'
import { runSelfCheck } from '../utils/scan'

/**
 * `create-unibestx doctor [path]` —— 对已有项目进行四查自检
 */
export async function doctorCommand(target?: string): Promise<void> {
  const projectRoot = path.resolve(process.cwd(), target ?? '.')

  if (!existsSync(path.join(projectRoot, 'pages.config.json'))) {
    logger.error(`${projectRoot} 似乎不是合法的 uni-app X 项目（未找到 pages.config.json）`)
    process.exit(1)
  }

  logger.info(`正在检查项目: ${projectRoot}`)
  const issues = await runSelfCheck(projectRoot)

  if (issues.length === 0) {
    logger.success('四查自检通过：无悬空 import / 组件标签 / 路由 / 依赖')
    return
  }

  const errors = issues.filter(i => i.level === 'error')
  const warns = issues.filter(i => i.level === 'warn')

  for (const issue of errors) {
    logger.error(`[${issue.code}] ${issue.message}${issue.file ? `（${issue.file}）` : ''}`)
  }
  for (const issue of warns) {
    logger.warn(`[${issue.code}] ${issue.message}${issue.file ? `（${issue.file}）` : ''}`)
  }

  logger.info(`自检结果：${errors.length} 处错误，${warns.length} 处警告`)

  if (errors.length > 0) {
    process.exit(1)
  }
}
