import { green, yellow } from 'kolorist'
import { readCliVersion } from './paths'

interface RepoFileResponse {
  content: string
  encoding: string
}

/**
 * 从 Gitee 获取 unibestX 最新版本
 */
export async function getUnibestXVersionFromGitee(): Promise<string | null> {
  try {
    const apiUrl = 'https://gitee.com/api/v5/repos/htwoO-cq/uni-best-x/contents/package.json?ref=main'
    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    })

    if (res.ok) {
      const data = (await res.json()) as RepoFileResponse
      if (data.encoding === 'base64') {
        const decoded = Buffer.from(data.content, 'base64').toString('utf8')
        const pkg = JSON.parse(decoded)
        return pkg.version || null
      }
    }
    return null
  }
  catch {
    return null
  }
}

/**
 * 从 GitHub 获取 unibestX 最新版本
 */
export async function getUnibestXVersionFromGithub(): Promise<string | null> {
  try {
    const apiUrl = 'https://api.github.com/repos/cq112233/unibestX/contents/package.json?ref=main'
    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'create-unibestx',
      },
      signal: AbortSignal.timeout(5000),
    })

    if (res.ok) {
      const data = (await res.json()) as RepoFileResponse
      if (data.encoding === 'base64') {
        const decoded = Buffer.from(data.content, 'base64').toString('utf8')
        const pkg = JSON.parse(decoded)
        return pkg.version || null
      }
    }
    return null
  }
  catch {
    return null
  }
}

/**
 * 获取 unibestX 最新版本（先试 Gitee，再试 GitHub）
 */
export async function getLatestUnibestXVersion(): Promise<string | null> {
  const giteeVer = await getUnibestXVersionFromGitee()
  if (giteeVer) {
    return giteeVer
  }
  return getUnibestXVersionFromGithub()
}

/**
 * 打印版本信息
 */
export async function printVersion(): Promise<void> {
  const cliVersion = await readCliVersion()
  const latestTemplateVersion = await getLatestUnibestXVersion()

  console.log(`create-unibestx v${cliVersion}`)
  if (latestTemplateVersion) {
    console.log(`模板 unibestX 当前最新版本: ${green(`v${latestTemplateVersion}`)}`)
  }
  console.log(`如需更新脚手架，请运行: ${green('npm i -g create-unibestx')} 或 ${green('pnpm add -g create-unibestx')}`)
  console.log()
}
