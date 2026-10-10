/**
 * 【阶段二：收尾同步与元信息写入】
 *
 * 负责在裁剪与自检通过后，对新生成项目的工程配置文件进行最终规范化同步：
 * 1. 更新 package.json：
 *    - 将 name 改为用户指定的项目名，重置 version 为 1.0.0；
 *    - 移除已裁剪功能关联的依赖项（dependencies / devDependencies）与 scripts 脚本；
 *    - 写入 unibestx 官方元数据对象（记录本次生成所勾选的功能、UI 库、模板分支、时间戳与 CLI 版本）；
 * 2. 更新 .env 环境变量：
 *    - 将 VITE_APP_TITLE 对齐为用户实际的项目名称；
 * 3. 产物规范化：确保生成后的工程开箱即用，随时可以提交或分发。
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { PruneResult } from './prune'
import type { CreateOptions } from '../types'
import { fs, readJson, writeJson } from '../utils/fs'


/** 写在生成物 `package.json` 里的元信息字段 */
export type UnibestxMeta = {
  /** 生成时勾选的 feature key */
  features: string[]
  /** 模板模式 */
  templateMode?: string
  /** UI 组件库 */
  uiLibrary?: string
  /**
   * 模板来源标签
   *
   * - 远程分支：`uniX-rice-ui`
   * - 本地分支：`local:uniX-rice-ui`
   * - 字面目录拷贝：`local`
   *
   * 只记分支名不记绝对路径 —— 生成物是要被提交和分享的。
   */
  template: string
  /** 生成时间（ISO 8601） */
  createdAt: string
  /** CLI 版本 */
  cliVersion: string
}

/**
 * 收尾
 *
 * `templateLabel` 来自 acquireTemplate 解析出的来源，不在这里靠路径形态反推。
 */
export async function finalize(
  projectRoot: string,
  options: CreateOptions,
  pruneResult: PruneResult,
  cliVersion: string,
  templateLabel: string,
  step: (msg: string) => void,
  warn: (msg: string) => void,
): Promise<void> {
  step('重写 package.json')
  await rewritePackageJson(projectRoot, options, pruneResult, cliVersion, templateLabel)

  step('对齐 .env')
  await rewriteEnv(projectRoot, options, warn)
}

async function rewritePackageJson(
  projectRoot: string,
  options: CreateOptions,
  pruneResult: PruneResult,
  cliVersion: string,
  templateLabel: string,
): Promise<void> {
  const abs = path.join(projectRoot, 'package.json')
  const pkg = await readJson<Record<string, any>>(abs)

  pkg.name = options.projectName
  pkg.version = '1.0.0'

  for (const dep of pruneResult.removedDeps) {
    delete pkg.dependencies?.[dep]
    delete pkg.devDependencies?.[dep]
  }
  for (const script of pruneResult.removedScripts) {
    delete pkg.scripts?.[script]
  }

  // 移除 docs 文档网站相关脚本与依赖
  delete pkg.scripts?.['docs:dev']
  delete pkg.scripts?.['docs:build']
  delete pkg.scripts?.['docs:preview']
  delete pkg.devDependencies?.vitepress

  pkg.unibestx = {
    features: [...options.features].sort(),
    templateMode: options.templateMode,
    uiLibrary: options.uiLibrary,
    template: templateLabel,
    createdAt: new Date().toISOString(),
    cliVersion,
  } satisfies UnibestxMeta

  await writeJson(abs, pkg)
}

async function rewriteEnv(
  projectRoot: string,
  options: CreateOptions,
  warn: (msg: string) => void,
): Promise<void> {
  const abs = path.join(projectRoot, '.env')
  if (!existsSync(abs)) {
    warn('.env 不存在，跳过')
    return
  }

  const content = await fs.readFile(abs, 'utf-8')
  let next = content

  next = setEnvVar(next, 'VITE_APP_TITLE', options.projectName)

  if (!options.features.includes('i18n')) {
    next = setEnvVar(next, 'VITE_DEFAULT_LOCALE', 'zh-CN')
  }

  const sandboxMatch = next.match(/^VITE_DEV_SANDBOX_PAGES=(.*)$/m)
  if (sandboxMatch) {
    const pages = sandboxMatch[1]!.split(',').map(s => s.trim()).filter(Boolean)
    const alive = pages.filter(p => !p.includes('*') && existsSync(path.join(projectRoot, `${p}.uvue`)))
    if (alive.length !== pages.length) {
      warn(`VITE_DEV_SANDBOX_PAGES 移除了 ${pages.length - alive.length} 个已删页面`)
      next = setEnvVar(next, 'VITE_DEV_SANDBOX_PAGES', alive.join(', '))
    }
  }

  if (next !== content) {
    await fs.writeFile(abs, next, 'utf-8')
  }
}

function setEnvVar(content: string, key: string, value: string): string {
  const eol = content.includes('\r\n') ? '\r\n' : '\n'
  const lines = content.split(/\r?\n/)
  const re = new RegExp(`^${key}=`)

  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i]!)) {
      if (lines[i] === `${key}=${value}`) {
        return content
      }
      lines[i] = `${key}=${value}`
      return lines.join(eol)
    }
  }

  const trimmed = content.replace(/\s*$/, '')
  return `${trimmed}${eol}${key}=${value}${eol}`
}
