import { existsSync } from 'node:fs'
import path from 'node:path'
import { fs, readJson, removePath, removePaths, writeJson } from '../utils/fs'

/**
 * 噪声路径：误提交的构建产物与本机 IDE 状态，任何模板都不该带出去
 */
const NOISE_PATHS = [
  'dist',
  'unpackage',
  '.idea',
  '.hbuilderx',
  '.pages.json.bak',
  'uniCloud-alipay',
  '.env.local',
  'tsconfig.tsbuildinfo',
  '.claude/settings.local.json',
  '.agents/settings.local.json',
]

/** 递归清理目录下的 .DS_Store */
async function removeDsStore(root: string): Promise<string[]> {
  const removed: string[] = []
  if (!existsSync(root)) {
    return removed
  }
  const entries = await fs.readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') {
      continue
    }
    const abs = path.join(root, entry.name)
    if (entry.isDirectory()) {
      removed.push(...await removeDsStore(abs))
    }
    else if (entry.name === '.DS_Store') {
      await removePath(abs)
      removed.push(path.relative(root, abs))
    }
  }
  return removed
}

export type SanitizeResult = {
  removedPaths: string[]
  scrubbedCredentials: string[]
}

/** 占位 appid */
const PLACEHOLDER_UNI_APPID = '__UNI__XXXXXXXX'
const PLACEHOLDER_WX_APPID = 'wx0000000000000000'

/**
 * 清噪声与凭据（无开关，必做）
 */
export async function sanitize(
  projectRoot: string,
  projectName: string,
  step: (msg: string) => void,
): Promise<SanitizeResult> {
  const removedPaths: string[] = []

  step('清理构建产物与本机噪声')
  for (const rel of NOISE_PATHS) {
    if (await removePath(path.join(projectRoot, rel))) {
      removedPaths.push(rel)
    }
  }
  removedPaths.push(...await removeDsStore(projectRoot))

  step('剥离脚手架自身')
  if (await stripSelf(projectRoot)) {
    removedPaths.push('packages/cli', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', ...SELF_DOCS)
  }

  step('清理 manifest.json 中的凭据与占位 appid')
  const manifestPath = path.join(projectRoot, 'manifest.json')
  const scrubbedCredentials: string[] = []

  if (existsSync(manifestPath)) {
    const manifest = await readJson<Record<string, any>>(manifestPath)

    manifest.name = projectName
    manifest.appid = PLACEHOLDER_UNI_APPID

    if (manifest.uniCloud) {
      delete manifest.uniCloud
      scrubbedCredentials.push('manifest.json: uniCloud（accessKey / secretKey / spaceId）')
    }

    const harmony = manifest['app-harmony']
    if (harmony?.distribute?.signingConfigs) {
      delete harmony.distribute.signingConfigs
      scrubbedCredentials.push('manifest.json: app-harmony.distribute.signingConfigs（签名口令与本机路径）')
    }
    if (harmony?.distribute?.bundleName) {
      harmony.distribute.bundleName = 'com.example.unibestx'
      scrubbedCredentials.push('manifest.json: app-harmony.distribute.bundleName')
    }

    if (manifest['mp-weixin']?.appid) {
      manifest['mp-weixin'].appid = PLACEHOLDER_WX_APPID
      scrubbedCredentials.push('manifest.json: mp-weixin.appid')
    }

    await writeJson(manifestPath, manifest, '\t')
  }

  return { removedPaths, scrubbedCredentials }
}

const SELF_DOCS = [
  'docs/superpowers/specs/2026-09-21-create-unibestx-cli-design.md',
  'docs/superpowers/plans/2026-09-21-create-unibestx-cli.md',
]

/**
 * 把脚手架自身从生成物中移除（如果模板自带）
 */
async function stripSelf(projectRoot: string): Promise<boolean> {
  const cliPkg = path.join(projectRoot, 'packages', 'cli', 'package.json')
  if (!existsSync(cliPkg)) {
    return false
  }
  const pkg = await readJson<{ name?: string }>(cliPkg).catch(() => null)
  if (pkg?.name !== 'create-unibestx') {
    return false
  }
  await removePath(path.join(projectRoot, 'packages', 'cli'))
  await removePath(path.join(projectRoot, 'pnpm-workspace.yaml'))
  await removePath(path.join(projectRoot, 'pnpm-lock.yaml'))
  await removePaths(SELF_DOCS.map(rel => path.join(projectRoot, rel)))
  return true
}
