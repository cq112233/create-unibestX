import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { copyDir, fs, isEmptyDir, removePath } from '../utils/fs'

const execFileAsync = promisify(execFile)

/** 默认 GitHub 模板仓库，可用 `UNIBESTX_REPO` 环境变量覆盖 */
export const DEFAULT_REPO = process.env.UNIBESTX_REPO ?? 'https://github.com/cq112233/unibestX.git'

/** 国内 Gitee 镜像仓库 */
export const GITEE_REPO = 'https://gitee.com/htwoO-cq/uni-best-x.git'

/** 默认分支 */
export const DEFAULT_BRANCH = 'main'

/** 拷贝本地模板时跳过的目录 */
const SKIP_DIRS = [
  'node_modules',
  '.git',
  'unpackage',
  'dist',
  '.hbuilderx',
  '.idea',
  '.DS_Store',
]

/** `--template` 的取值形态 */
export type TemplateSource
  = | { kind: 'local', dir: string }
    | { kind: 'git', branch: string, repo: string }

/**
 * 判断 `--template` 是本地目录还是分支名
 */
export function resolveTemplate(template: string, cwd: string): TemplateSource {
  const asPath = path.isAbsolute(template) ? template : path.resolve(cwd, template)
  if (existsSync(asPath)) {
    return { kind: 'local', dir: asPath }
  }
  return { kind: 'git', branch: template, repo: DEFAULT_REPO }
}

export type AcquireResult = {
  strippedGit: boolean
  source: TemplateSource
}

/**
 * 取模板到 `targetDir`
 */
export async function acquireTemplate(
  targetDir: string,
  template: string,
  cwd: string,
  step: (msg: string) => void,
): Promise<AcquireResult> {
  if (!await isEmptyDir(targetDir)) {
    throw new Error(`目标目录已存在且非空: ${targetDir}`)
  }

  const source = resolveTemplate(template, cwd)

  if (source.kind === 'local') {
    step(`从本地目录拷贝模板: ${source.dir}`)
    await copyDir(source.dir, targetDir, SKIP_DIRS)
    const stripped = await removePath(path.join(targetDir, '.git'))
    return { strippedGit: stripped, source }
  }

  step(`浅克隆模板: ${source.repo} #${source.branch}`)
  try {
    await execFileAsync(
      'git',
      ['clone', '--depth=1', '--single-branch', '-b', source.branch, source.repo, targetDir],
      { maxBuffer: 32 * 1024 * 1024 },
    )
  }
  catch (error: any) {
    // 若 GitHub 克隆失败且未显式指定自定义仓库，自动尝试 Gitee 镜像源
    if (source.repo === DEFAULT_REPO) {
      step(`GitHub 连接受限，正在切换 Gitee 镜像重试: ${GITEE_REPO} #${source.branch}`)
      try {
        await removePath(targetDir)
        await execFileAsync(
          'git',
          ['clone', '--depth=1', '--single-branch', '-b', source.branch, GITEE_REPO, targetDir],
          { maxBuffer: 32 * 1024 * 1024 },
        )
        source.repo = GITEE_REPO
      }
      catch (giteeError: any) {
        // 如果本地存在 /Users/chenqi/Desktop/unibestX 且在同机器开发，尝试本地容灾提示
        const localDevPath = '/Users/chenqi/Desktop/unibestX'
        if (existsSync(localDevPath)) {
          step(`网络拉取失败，检测到本地开发模板 ${localDevPath}，正在使用本地模板容灾...`)
          await removePath(targetDir)
          await copyDir(localDevPath, targetDir, SKIP_DIRS)
          const stripped = await removePath(path.join(targetDir, '.git'))
          return { strippedGit: stripped, source: { kind: 'local', dir: localDevPath } }
        }

        const detail = String(giteeError?.stderr ?? giteeError?.message ?? giteeError).trim()
        throw new Error(`克隆模板失败（GitHub 与 Gitee 均未成功）:\n${detail}\n请检查网络连接或使用 --template <本地路径>。`)
      }
    }
    else {
      const detail = String(error?.stderr ?? error?.message ?? error).trim()
      throw new Error(`克隆失败（分支 '${source.branch}' 是否存在？网络是否可达？）:\n${detail}`)
    }
  }

  const stripped = await removePath(path.join(targetDir, '.git'))
  await pruneEmptyDirs(targetDir)
  return { strippedGit: stripped, source }
}

/** 递归删除空目录（不动 targetDir 自身） */
async function pruneEmptyDirs(dir: string): Promise<boolean> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  let empty = true

  for (const entry of entries) {
    const child = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const childEmpty = await pruneEmptyDirs(child)
      if (childEmpty) {
        await removePath(child)
      }
      else {
        empty = false
      }
    }
    else {
      empty = false
    }
  }

  return empty
}
