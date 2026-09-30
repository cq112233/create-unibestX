import { existsSync } from 'node:fs'
import path from 'node:path'
import type { PruneResult } from './prune'
import type { CreateOptions } from '../types'
import { fs, readJson, writeJson } from '../utils/fs'

/** 写在生成物 `package.json` 里的元信息字段 */
export type UnibestxMeta = {
  /** 生成时勾选的 feature key */
  features: string[]
  /** 保留的分包目录名 */
  subPackages: string[]
  /** 是否清理了零引用 uni_modules */
  cleanUnusedModules: boolean
  /** 模板来源：分支名，或 'local' */
  template: string
  /** 生成时间（ISO 8601） */
  createdAt: string
  /** CLI 版本 */
  cliVersion: string
}

function isLocalTemplate(template: string): boolean {
  return path.isAbsolute(template) || template.startsWith('./') || template.startsWith('../')
}

/**
 * 收尾
 */
export async function finalize(
  projectRoot: string,
  options: CreateOptions,
  pruneResult: PruneResult,
  cliVersion: string,
  step: (msg: string) => void,
  warn: (msg: string) => void,
): Promise<void> {
  step('重写 package.json')
  await rewritePackageJson(projectRoot, options, pruneResult, cliVersion)

  step('对齐 .env')
  await rewriteEnv(projectRoot, options, warn)
}

async function rewritePackageJson(
  projectRoot: string,
  options: CreateOptions,
  pruneResult: PruneResult,
  cliVersion: string,
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

  pkg.unibestx = {
    features: [...options.features].sort(),
    subPackages: [...options.subPackages].sort(),
    cleanUnusedModules: options.cleanUnusedModules,
    template: isLocalTemplate(options.template) ? 'local' : options.template,
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
