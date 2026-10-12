/**
 * 【阶段二：基础规范化与隐私脱敏】
 *
 * 在拉取完模板后立即执行的基础清理操作（无条件执行）：
 * 1. 清理误提交的构建产物与开发环境噪声（dist, unpackage, .idea, .hbuilderx, .DS_Store 等）；
 * 2. 剥离脚手架工程自身的文件与历史 Monorepo 痕迹，以及模板作者的本机态文件
 *    （`.claude/settings.json`，注意只删具体文件、不删 `.claude/` 整个目录）；
 * 3. 隐私与敏感配置脱敏：
 *    - 重置 manifest.json 中的 appid 为纯净占位符（__UNI__XXXXXXXX）；
 *    - 剥离 uniCloud 秘钥与 spaceId；
 *    - 清空鸿蒙 app-harmony 签名证书口令与本地绝对路径；
 *    - 重置微信小程序 AppID 为通用占位符。
 */
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
  'docs',
  '.github',
]

/**
 * 模板作者的本机态文件：只删与「这台机器/这个人」绑定的东西，别碰模板的交付内容
 *
 * - `.claude/settings.json` —— 作者本机的 Claude Code 权限白名单（里头是他自己的 bash
 *   命令），带进用户工程既没用，也等于替用户预设了一批权限。
 *
 * ⚠️ 这里**只能写具体文件**。2026-10-12 曾经把整个 `.claude/` 和 `scripts/router-guard-test/`
 * 列进来自动剥离，结果删掉了模板 README「🤖 AI 与 Skill 体系」里明确宣传的交付能力：
 * `.claude/skills/unibestX-skill/`（「1 个入口 + 8 分册」的 uni-app X 规范库，Claude Code
 * 克隆即可用；在复杂分支上它是指向 `.agents/skills/unibestX-skill` 的相对软链，在 base 上是
 * 实体目录）和 `scripts/router-guard-test/`（README 项目结构里的「路由守卫决策矩阵测试」）。
 * 这两样都不在裁剪设计里，冒烟断言当时写「应当被删」是错的。
 *
 * 同样刻意**不**列入的还有：`Dockerfile` / `docker-compose.yml` / `deploy/`（H5 容器化部署，
 * `docker:*` 脚本直接引用）、`.agents/`、`CLAUDE.md`、`AGENTS.md`（面向使用者的 AI 协作资产）。
 */
const AUTHOR_LOCAL_PATHS = [
  '.claude/settings.json',
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

/** 递归清空对象中所有名为 appid 的字符串值 */
function cleanAllAppIds(obj: any): void {
  if (!obj || typeof obj !== 'object') {
    return
  }
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === 'appid' && typeof obj[key] === 'string') {
      obj[key] = ''
    }
    else if (typeof obj[key] === 'object') {
      cleanAllAppIds(obj[key])
    }
  }
}

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

  step('剥离模板作者的本机态文件')
  for (const rel of AUTHOR_LOCAL_PATHS) {
    if (await removePath(path.join(projectRoot, rel))) {
      removedPaths.push(rel)
    }
  }

  step('剥离脚手架自身')
  if (await stripSelf(projectRoot)) {
    removedPaths.push('packages/cli', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', ...SELF_DOCS)
  }

  step('清理 manifest.json 中的凭据与清空各端 appid')
  const manifestPath = path.join(projectRoot, 'manifest.json')
  const scrubbedCredentials: string[] = []

  if (existsSync(manifestPath)) {
    const manifest = await readJson<Record<string, any>>(manifestPath)

    manifest.name = projectName

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

    // 彻底清空所有平台（根节点 DCloud、微信 mp-weixin、支付宝 mp-alipay 等）的 appid
    cleanAllAppIds(manifest)
    scrubbedCredentials.push('manifest.json: 清空各端 appid')

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
