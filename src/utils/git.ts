import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** git 调用是否因「可执行文件不存在」而失败 */
export function isGitMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT'
}

/** 执行 git 命令，返回 trim 后的 stdout；失败时原样抛出 execFile 的错误（含 stderr） */
export async function runGit(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    maxBuffer: 32 * 1024 * 1024,
  })
  return stdout.trim()
}

/**
 * 取目录所在仓库的根；不是 git 仓库返回 null
 *
 * git 可执行文件缺失时向上抛出 —— 调用方需要区分「不是仓库」和「没装 git」。
 */
export async function findRepoRoot(dir: string): Promise<string | null> {
  try {
    return await runGit(['-C', dir, 'rev-parse', '--show-toplevel'])
  }
  catch (error) {
    if (isGitMissing(error)) {
      throw error
    }
    return null
  }
}

/** 当前 HEAD 指向的分支名；detached HEAD 返回 null */
export async function currentBranch(repoRoot: string): Promise<string | null> {
  try {
    return await runGit(['-C', repoRoot, 'symbolic-ref', '--quiet', '--short', 'HEAD'])
  }
  catch {
    return null
  }
}

/** 本地是否存在该分支 */
export async function hasLocalBranch(repoRoot: string, branch: string): Promise<boolean> {
  try {
    await runGit(['-C', repoRoot, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`])
    return true
  }
  catch {
    return false
  }
}

/** 列出全部本地分支名 */
export async function listLocalBranches(repoRoot: string): Promise<string[]> {
  const raw = await runGit([
    '-C',
    repoRoot,
    'for-each-ref',
    '--format=%(refname:short)',
    'refs/heads/',
  ])
  return raw.split('\n').map(line => line.trim()).filter(Boolean).sort()
}

/** 未提交改动的条数（含未跟踪文件） */
export async function countUncommittedChanges(repoRoot: string): Promise<number> {
  const raw = await runGit(['-C', repoRoot, 'status', '--porcelain'])
  return raw ? raw.split('\n').filter(Boolean).length : 0
}
