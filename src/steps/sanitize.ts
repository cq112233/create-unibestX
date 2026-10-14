/**
 * 【阶段二：基础规范化与隐私脱敏】
 *
 * 在拉取完模板后立即执行的基础清理操作（无条件执行）：
 * 1. 清理误提交的构建产物与开发环境噪声（dist, unpackage, .idea, .hbuilderx, .DS_Store 等）；
 * 2. 剥离脚手架工程自身的文件与历史 Monorepo 痕迹，以及模板作者的本机态文件
 *    （`.claude/settings.json`，注意只删具体文件、不删 `.claude/` 整个目录）；
 * 3. 隐私与敏感配置脱敏：
 *    - 把 manifest.json 与 manifest.config.ts 中的各端 appid 换成「同形态」假值；
 *    - 剥离 uniCloud 秘钥与 spaceId；
 *    - 清空鸿蒙 app-harmony 签名证书口令与本地绝对路径。
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

/**
 * 各端 appid 的「同形态」假值。
 *
 * 形态照着真实值来（DCloud 是 `__UNI__` + 7 位十六进制，微信是 `wx` + 16 位十六进制，
 * 支付宝是 16 位数字），这样填进 manifest 后各端仍认得出这是「未配置」而非格式非法；
 * 同时明显是假值，不会让人误以为是可用的真实标识。
 *
 * ⚠️ `manifest.json` 由 `manifest.config.ts` 经 vite-plugin-uni-manifest **生成**
 * （见模板 manifest.config.ts 顶部注释：json 是产物、config.ts 才是唯一真源）。
 * 只改 json 的话，下次 `pnpm dev` / `pnpm build` 会被 config.ts 里的真实 appid 覆盖回去。
 * 所以两个文件必须一起换，且共用本表 —— 否则两文件对不上，生成出来的 json 又会漂回真实值。
 */
const FAKE_APPIDS = {
  dcloud: '__UNI__XXXXXXX',
  weixin: 'wx0000000000000000',
  alipay: '2000000000000000',
} as const

/** 按形态判定某个 appid 属于哪个端，返回对应的假值 */
function fakeAppIdFor(value: string): string {
  if (/^__UNI__/i.test(value)) {
    return FAKE_APPIDS.dcloud
  }
  if (/^wx/i.test(value)) {
    return FAKE_APPIDS.weixin
  }
  if (/^\d+$/.test(value)) {
    return FAKE_APPIDS.alipay
  }
  // 认不出来的形态：仍换成假值，绝不把原值带出去
  return FAKE_APPIDS.dcloud
}

/** 递归把对象里所有名为 appid 的字符串值换成同形态假值 */
function scrubAllAppIds(obj: any): void {
  if (!obj || typeof obj !== 'object') {
    return
  }
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === 'appid' && typeof obj[key] === 'string') {
      obj[key] = fakeAppIdFor(obj[key])
    }
    else if (typeof obj[key] === 'object') {
      scrubAllAppIds(obj[key])
    }
  }
}

/**
 * 把 manifest.config.ts 源码里的 appid 字面量换成同形态假值。
 *
 * 走正则而非结构化改写：config.ts 是 TS 源码（含注释、缩进、单双引号混用），
 * 正则只碰 `appid: '<值>'` 这一段，引号与缩进原样保留，不会动到别的字段。
 */
function scrubConfigAppIds(content: string): { next: string, changed: boolean } {
  let changed = false
  const next = content.replace(
    /(['"]?appid['"]?\s*:\s*)(['"])([^'"]*)\2/gi,
    (whole: string, head: string, quote: string, value: string) => {
      const fake = fakeAppIdFor(value)
      if (fake === value) {
        return whole
      }
      changed = true
      return `${head}${quote}${fake}${quote}`
    },
  )
  return { next, changed }
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

  step('清理 manifest 中的凭据与替换各端 appid')
  const manifestPath = path.join(projectRoot, 'manifest.json')
  const manifestConfigPath = path.join(projectRoot, 'manifest.config.ts')
  const scrubbedCredentials: string[] = []

  // manifest.config.ts 是 manifest.json 的真源，先改它，保证两文件换成同一批假值
  if (existsSync(manifestConfigPath)) {
    const configContent = await fs.readFile(manifestConfigPath, 'utf-8')
    const { next, changed } = scrubConfigAppIds(configContent)
    if (changed) {
      await fs.writeFile(manifestConfigPath, next, 'utf-8')
      scrubbedCredentials.push('manifest.config.ts: 各端 appid 换成同形态假值')
    }
  }

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

    // 把所有平台（根节点 DCloud、微信 mp-weixin、支付宝 mp-alipay 等）的 appid
    // 换成与 manifest.config.ts 同形态、同取值的假值
    scrubAllAppIds(manifest)
    scrubbedCredentials.push('manifest.json: 各端 appid 换成同形态假值')

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
