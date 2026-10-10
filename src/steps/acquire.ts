/**
 * 【阶段一：模板拉取】
 *
 * 负责根据用户选择的模式或指定的模板参数，将模板项目获取到目标工程目录中。
 * 支持三种获取渠道与智能容灾切换：
 * 1. 本地目录拷贝：用于开发者本地单向复制调试；
 * 2. 本地仓库分支硬链接克隆：利用已克隆的本地 unibestX 仓库极速秒级拉取目标分支；
 * 3. 远程 Git 仓库浅克隆：默认使用国内 Gitee 极速源，超时或受限时自动无缝降级到 GitHub 备份源。
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { copyDir, fs, isEmptyDir, removePath } from '../utils/fs'
import {
  countUncommittedChanges,
  currentBranch,
  findRepoRoot,
  hasLocalBranch,
  listLocalBranches,
  runGit,
} from '../utils/git'
import type { LocalRepoConfig } from '../utils/localRepo'


/** 默认 Gitee 模板仓库（国内极速源，可用 `UNIBESTX_REPO` 环境变量覆盖） */
export const DEFAULT_REPO = process.env.UNIBESTX_REPO ?? 'https://gitee.com/htwoO-cq/uni-best-x.git'

/** GitHub 备份容灾仓库 */
export const GITHUB_REPO = 'https://github.com/cq112233/unibestX.git'

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

/** `--template` 的语义：一个具体目录，还是一个分支名 */
export type TemplateRequest
  = | { kind: 'dir', dir: string }
    | { kind: 'branch', branch: string }

/** 模板的实际来源 */
export type TemplateSource
  = | { kind: 'literal-dir', dir: string, headBranch: string | null, dirtyCount: number }
    | { kind: 'local-branch', repoRoot: string, branch: string, from: 'workspace' | 'clone', dirtyCount: number }
    | { kind: 'git', branch: string, repo: string }

export type AcquireResult = {
  source: TemplateSource
  /** 写进生成物 `package.json` 的 `unibestx.template` */
  label: string
  /** 取模板过程中产生的提示，由调用方在合适时机打印 */
  warnings: string[]
}

/** 生成物里记录的模板标签 —— 只记分支，不记本机绝对路径 */
function labelOf(source: TemplateSource): string {
  switch (source.kind) {
    case 'literal-dir':
      return 'local'
    case 'local-branch':
      return `local:${source.branch}`
    case 'git':
      return source.branch
  }
}

/**
 * 判断 `--template` 是个路径还是个分支名
 *
 * 只有**不带路径分隔符的裸名**才当分支名。否则 cwd 下恰好存在同名目录时
 * （比如一个叫 `main` 的目录），分支名会被静默顶替成本地目录。
 */
export function classifyTemplate(template: string, cwd: string): TemplateRequest {
  const looksLikePath
    = path.isAbsolute(template) || template.includes('/') || template.includes('\\')

  if (!looksLikePath) {
    return { kind: 'branch', branch: template }
  }

  const dir = path.isAbsolute(template) ? template : path.resolve(cwd, template)
  if (!existsSync(dir)) {
    throw new Error(`模板路径不存在: ${dir}`)
  }
  return { kind: 'dir', dir }
}

/**
 * 取模板到 `targetDir`
 *
 * 三种来源：字面目录拷贝 / 本地仓库按分支取 / 远程浅克隆。
 */
export async function acquireTemplate(
  targetDir: string,
  template: string,
  cwd: string,
  localRepo: LocalRepoConfig,
): Promise<AcquireResult> {
  if (!await isEmptyDir(targetDir)) {
    throw new Error(`目标目录已存在且非空: ${targetDir}`)
  }

  const request = classifyTemplate(template, cwd)

  if (request.kind === 'dir') {
    return acquireLiteralDir(targetDir, request.dir)
  }

  // 裸名走分支语义时，若 cwd 下有同名目录，提醒一句（见 classifyTemplate 注释）
  const shadowed = path.resolve(cwd, request.branch)
  const shadowWarning = existsSync(shadowed)
    ? `当前目录下存在同名目录 ${shadowed}，已按分支名「${request.branch}」解释；`
      + `如需使用该目录请改用 --template ./${request.branch}`
    : null

  const result = localRepo.mode === 'on'
    ? await acquireLocalBranch(targetDir, localRepo.root, request.branch)
    : await acquireRemoteBranch(targetDir, request.branch, localRepo)

  if (shadowWarning !== null) {
    result.warnings.unshift(shadowWarning)
  }
  return result
}

/**
 * 直接拷贝一个目录（不吃分支语义）
 *
 * 保留 `--template <路径>` 的既有语义：指哪个目录就拷哪个目录。若该目录本身
 * 是个 git 仓库，顺带把它的当前分支和未提交改动数记下来，由调用方打日志 ——
 * 免得「以为在拷某分支，其实拷的是工作区当前那一支」这种误判再次静默发生。
 */
async function acquireLiteralDir(targetDir: string, dir: string): Promise<AcquireResult> {
  await copyDir(dir, targetDir, SKIP_DIRS)
  await removePath(path.join(targetDir, '.git'))

  let repoRoot: string | null = null
  try {
    repoRoot = await findRepoRoot(dir)
  }
  catch {
    repoRoot = null
  }

  const headBranch = repoRoot === null ? null : await currentBranch(repoRoot)
  const dirtyCount = repoRoot === null ? 0 : await countUncommittedChanges(repoRoot)

  const source: TemplateSource = { kind: 'literal-dir', dir, headBranch, dirtyCount }
  return { source, label: labelOf(source), warnings: [] }
}

/**
 * 从本地仓库取指定分支
 *
 * HEAD 正好在目标分支上时直接拷工作区（连未提交的改动一起取，方便边改模板边测）；
 * 否则用 `git clone --local` 取该分支**已提交**的内容 —— 对象库走硬链接，
 * 不复制数据也不改动源仓库。
 */
async function acquireLocalBranch(
  targetDir: string,
  repoRoot: string,
  branch: string,
): Promise<AcquireResult> {
  if (!await hasLocalBranch(repoRoot, branch)) {
    const available = await listLocalBranches(repoRoot)
    throw new Error(
      `本地仓库 ${repoRoot} 中不存在分支 '${branch}'。\n`
      + `可用分支: ${available.length > 0 ? available.join(', ') : '(无)'}\n`
      + '若该分支尚未拉取，请先在本地仓库执行 git fetch。',
    )
  }

  const head = await currentBranch(repoRoot)

  if (head === branch) {
    await copyDir(repoRoot, targetDir, SKIP_DIRS)
    await removePath(path.join(targetDir, '.git'))
    const dirtyCount = await countUncommittedChanges(repoRoot)
    await pruneEmptyDirs(targetDir)

    const source: TemplateSource
      = { kind: 'local-branch', repoRoot, branch, from: 'workspace', dirtyCount }
    return { source, label: labelOf(source), warnings: [] }
  }

  await removePath(targetDir)
  try {
    await runGit(['clone', '--local', '--single-branch', '-b', branch, repoRoot, targetDir])
  }
  catch (error: any) {
    const detail = String(error?.stderr ?? error?.message ?? error).trim()
    throw new Error(
      `从本地仓库取分支 '${branch}' 失败:\n${detail}\n`
      + '若本地仓库与目标目录不在同一磁盘卷（硬链接不可用），请改用 --template <本地路径> 直接拷贝目录。',
    )
  }

  await removePath(path.join(targetDir, '.git'))
  await pruneEmptyDirs(targetDir)

  const source: TemplateSource
    = { kind: 'local-branch', repoRoot, branch, from: 'clone', dirtyCount: 0 }
  return { source, label: labelOf(source), warnings: [] }
}

/**
 * 远程浅克隆（Gitee 主源 + GitHub 容灾）
 *
 * 两个源都不可达且开了本地模式时，改用本地仓库的同名分支。
 */
async function acquireRemoteBranch(
  targetDir: string,
  branch: string,
  localRepo: LocalRepoConfig,
): Promise<AcquireResult> {
  const warnings: string[] = []

  try {
    await cloneRemoteInto(DEFAULT_REPO, branch, targetDir)
  }
  catch {
    warnings.push(`Gitee 连接受限，正在切换 GitHub 备份源重试: ${GITHUB_REPO} #${branch}`)

    try {
      await cloneRemoteInto(GITHUB_REPO, branch, targetDir)
    }
    catch (githubError: any) {
      const local = await fallbackToLocal(targetDir, branch, localRepo, warnings)
      if (local !== null) {
        return local
      }

      const detail = String(githubError?.stderr ?? githubError?.message ?? githubError).trim()
      throw new Error(
        `克隆模板失败（Gitee 与 GitHub 均未成功）:\n${detail}\n`
        + '请检查网络连接，或通过 --local-repo <本地仓库> 使用本地模板。',
      )
    }

    await removePath(path.join(targetDir, '.git'))
    await pruneEmptyDirs(targetDir)
    return { source: { kind: 'git', branch, repo: GITHUB_REPO }, label: branch, warnings }
  }

  await removePath(path.join(targetDir, '.git'))
  await pruneEmptyDirs(targetDir)
  return { source: { kind: 'git', branch, repo: DEFAULT_REPO }, label: branch, warnings }
}

/** 远程不可达时的本地兜底；本地模式未开启返回 null */
async function fallbackToLocal(
  targetDir: string,
  branch: string,
  localRepo: LocalRepoConfig,
  warnings: string[],
): Promise<AcquireResult | null> {
  if (localRepo.mode !== 'on') {
    return null
  }

  await removePath(targetDir)
  warnings.push(
    `远程仓库不可达，已改用本地仓库 ${localRepo.root} #${branch}（--no-local 可单次关闭本地模式）`,
  )

  try {
    const local = await acquireLocalBranch(targetDir, localRepo.root, branch)
    local.warnings.unshift(...warnings)
    return local
  }
  catch (error: any) {
    throw new Error(`远程与本地模板均不可用: ${error?.message ?? String(error)}`)
  }
}

/** 清空目标目录后浅克隆指定仓库 */
async function cloneRemoteInto(repo: string, branch: string, targetDir: string): Promise<void> {
  await removePath(targetDir)
  await runGit(['clone', '--depth=1', '--single-branch', '-b', branch, repo, targetDir])
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
