import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import type { CliFlags } from '../commands/create'
import { findRepoRoot, isGitMissing } from './git'

/** 环境变量名，与 scripts/smoke.mjs 共用同一个约定 */
export const LOCAL_REPO_ENV = 'UNIBESTX_LOCAL_REPO'

/** 本地模板模式是否开启，以及仓库根路径 */
export type LocalRepoConfig =
  | { mode: 'off' }
  | { mode: 'on', root: string }

export type LocalRepoResolution = {
  config: LocalRepoConfig
  warnings: string[]
}

/**
 * 解析本地模板仓库配置
 *
 * 优先级：`--no-local` > `--local-repo <path>` > `--local-repo`(取环境变量) > 环境变量。
 * 校验失败一律抛错，不静默回落远程 —— 否则会让人以为在测 A 实际在测 B。
 */
export async function resolveLocalRepo(flags: CliFlags): Promise<LocalRepoResolution> {
  const warnings: string[] = []
  const flagValue = flags['local-repo']
  const hasFlag = flagValue !== undefined
  const flagPath
    = typeof flagValue === 'string' && flagValue.trim() ? flagValue.trim() : undefined
  const envPath = process.env[LOCAL_REPO_ENV]?.trim() || undefined

  // `--no-local` 被 minimist 解析成 local: false
  if (flags.local === false) {
    if (hasFlag) {
      warnings.push('--no-local 与 --local-repo 同时指定，已按 --no-local 关闭本地模板模式。')
    }
    return { config: { mode: 'off' }, warnings }
  }

  const input = flagPath ?? envPath

  if (input === undefined) {
    // 显式要了本地模式却没给路径：属于配置错误，不退回远程
    if (hasFlag) {
      throw new Error(
        '已指定 --local-repo 但未提供路径。\n'
        + `请用 --local-repo <path> 指定路径，或先设置 ${LOCAL_REPO_ENV} 环境变量。`,
      )
    }
    return { config: { mode: 'off' }, warnings }
  }

  return { config: { mode: 'on', root: await normalizeRoot(input) }, warnings }
}

/** 把用户给的路径归一成 git 仓库根（允许填子目录或 worktree 路径） */
async function normalizeRoot(input: string): Promise<string> {
  const abs = path.resolve(input)

  if (!existsSync(abs)) {
    throw new Error(
      `本地模板仓库路径不存在: ${abs}\n`
      + `该路径来自 --local-repo 或 ${LOCAL_REPO_ENV} 环境变量，请检查后重试。`,
    )
  }

  let root: string | null
  try {
    root = await findRepoRoot(abs)
  }
  catch (error) {
    if (isGitMissing(error)) {
      throw new Error('本地模板模式需要 git，但未找到 git 命令，请先安装 git。')
    }
    throw error
  }

  if (root === null) {
    throw new Error(
      `路径不是 git 仓库: ${abs}\n`
      + '本地模板模式要求该目录位于一个 git 工作区内（需要按分支取内容）。',
    )
  }

  return root
}
