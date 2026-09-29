import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { readJson, walk } from './fs'

export type IssueLevel = 'error' | 'warn'

export type Issue = {
  level: IssueLevel
  code: 'dangling-import' | 'dangling-tag' | 'route' | 'dependency'
  message: string
  file?: string
}

/** 源码后缀：只有这些文件会被扫描 */
export const SOURCE_EXTS = ['.uvue', '.uts', '.ts', '.nvue', '.vue']

/**
 * uni-app X 内置标签白名单
 */
const BUILTIN_TAGS = new Set([
  'view', 'text', 'image', 'button', 'input', 'textarea', 'switch', 'slider', 'checkbox',
  'radio', 'picker', 'progress', 'icon', 'rich-text', 'video', 'audio', 'canvas', 'web-view',
  'scroll-view', 'list-view', 'list-item', 'swiper', 'swiper-item', 'movable-area', 'movable-view',
  'cover-view', 'cover-image', 'match-media', 'page-meta', 'navigation-bar', 'official-account',
  'open-data', 'picker-view', 'picker-view-column', 'functional-page-navigator', 'live-player',
  'live-pusher', 'native-button', 'ad', 'ad-draw', 'grid-view', 'grid-view-item', 'waterflow',
  'sticky-section', 'sticky-header', 'nested-scroll-body', 'nested-scroll-header', 'custom-tab-bar',
  'template', 'slot', 'block', 'component', 'transition', 'transition-group', 'keep-alive',
  'teleport', 'suspense', 'router-view', 'router-link',
  'root-portal', 'page-container', 'form', 'label', 'navigator', 'editor', 'keyboard-accessory',
  'match-media', 'share-element', 'save-button', 'open-container', 'voip-room', 'channel-live',
  'channel-video', 'page-meta', 'navigation-bar',
])

/**
 * 去掉注释，保留换行
 */
export function stripComments(input: string): string {
  let out = ''
  let quote: string | null = null

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!
    const next = input[i + 1]

    if (quote !== null) {
      out += ch
      if (ch === '\\') {
        out += next ?? ''
        i++
      }
      else if (ch === quote) {
        quote = null
      }
      continue
    }

    if (ch === '\'' || ch === '"' || ch === '`') {
      quote = ch
      out += ch
      continue
    }

    if (ch === '/' && next === '/') {
      while (i < input.length && input[i] !== '\n') {
        i++
      }
      out += '\n'
      continue
    }

    if (ch === '/' && next === '*') {
      i += 2
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) {
        if (input[i] === '\n') {
          out += '\n'
        }
        i++
      }
      i++
      continue
    }

    if (ch === '<' && input.startsWith('<!--', i)) {
      const end = input.indexOf('-->', i + 4)
      const stop = end === -1 ? input.length : end + 3
      for (const c of input.slice(i, stop)) {
        if (c === '\n') {
          out += '\n'
        }
      }
      i = stop - 1
      continue
    }

    out += ch
  }

  return out
}

/** Node 内置模块 */
const NODE_BUILTINS = new Set([
  'assert', 'buffer', 'child_process', 'cluster', 'console', 'crypto', 'dgram', 'dns', 'domain',
  'events', 'fs', 'http', 'https', 'net', 'os', 'path', 'process', 'punycode', 'querystring',
  'readline', 'stream', 'string_decoder', 'timers', 'tls', 'tty', 'url', 'util', 'v8', 'vm',
  'zlib', 'module', 'perf_hooks', 'worker_threads', 'async_hooks', 'inspector',
])

/** 从一行里抽取 import / export-from 的模块说明符 */
function extractSpecifiers(content: string): string[] {
  const specs: string[] = []
  const re = /(?:^|\n)\s*(?:import|export)[^\n]*?from\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    specs.push(m[1]!)
  }
  const bare = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g
  while ((m = bare.exec(content)) !== null) {
    specs.push(m[1]!)
  }
  return specs
}

/** 抽取 import 语句引入的本地绑定名 */
function extractImportBindings(content: string): string[] {
  const names: string[] = []

  const re = /(?:^|\n)\s*import\s+(?:type\s+)?([^'"]*?)\s*from\s*['"][^'"]+['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const clause = m[1]!.trim()
    if (clause === '') {
      continue
    }

    const defaultName = clause.split(',')[0]!.trim()
    if (/^[A-Za-z_$][\w$]*$/.test(defaultName)) {
      names.push(defaultName)
    }

    const namespace = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/)
    if (namespace) {
      names.push(namespace[1]!)
    }

    const braces = clause.match(/\{([^}]*)\}/)
    if (braces) {
      for (const part of braces[1]!.split(',')) {
        const alias = part.trim().match(/(?:^|\sas\s+)([A-Za-z_$][\w$]*)$/)
        if (alias) {
          names.push(alias[1]!)
        }
      }
    }
  }

  return names
}

/** 从文件内容里抽取模板中出现的标签名 */
function extractTags(content: string): string[] {
  const start = content.indexOf('<template')
  if (start === -1) {
    return []
  }
  const end = content.lastIndexOf('</template>')
  const region = end > start ? content.slice(start, end) : content.slice(start)

  const tags = new Set<string>()
  const re = /<([A-Za-z][\w-]*)[\s/>]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(region)) !== null) {
    tags.add(m[1]!)
  }
  return [...tags]
}

function isCustomTag(tag: string): boolean {
  if (BUILTIN_TAGS.has(tag)) {
    return false
  }
  const hasUpper = /[A-Z]/.test(tag)
  const hasHyphen = tag.includes('-')
  return hasUpper || hasHyphen
}

function candidatesFor(spec: string, fromFile: string, projectRoot: string): string[] {
  let base: string
  if (spec.startsWith('@/')) {
    base = path.join(projectRoot, spec.slice(2))
  }
  else if (spec.startsWith('.')) {
    base = path.resolve(path.dirname(fromFile), spec)
  }
  else {
    return []
  }

  const exts = ['', '.uvue', '.uts', '.ts', '.nvue', '.vue', '.js', '.json', '.tsx', '.d.uts.ts']
  const out: string[] = []
  for (const ext of exts) {
    out.push(base + ext)
    out.push(path.join(base, `index${ext}`))
  }
  return out
}

async function collectEasycomTags(projectRoot: string, configJson: any): Promise<Set<string>> {
  const tags = new Set<string>()

  const custom = configJson?.easycom?.custom
  if (custom && typeof custom === 'object') {
    for (const key of Object.keys(custom)) {
      tags.add(key.replace(/^\^/, '').replace(/\$$/, ''))
    }
  }

  const uniModules = path.join(projectRoot, 'uni_modules')
  if (existsSync(uniModules)) {
    for (const mod of await fs.readdir(uniModules)) {
      const compDir = path.join(uniModules, mod, 'components')
      if (!existsSync(compDir)) {
        continue
      }
      for (const comp of await fs.readdir(compDir)) {
        tags.add(comp)
        tags.add(comp.replace(/^(l|uni|x)-/, ''))
      }
    }
  }

  const srcComponents = path.join(projectRoot, 'src', 'components')
  if (existsSync(srcComponents)) {
    for (const entry of await fs.readdir(srcComponents, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        tags.add(entry.name)
      }
      else if (entry.name.endsWith('.uvue')) {
        tags.add(entry.name.replace(/\.uvue$/, ''))
      }
    }
  }

  return tags
}

const homeCache = new Map<string, boolean>()

async function homeDeclared(projectRoot: string): Promise<boolean> {
  const cached = homeCache.get(projectRoot)
  if (cached !== undefined) {
    return cached
  }

  const files = await walk(path.join(projectRoot, 'src', 'pages'), ['.uvue'], ['node_modules'])
  let found = false
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8')
    if (/type\s*:\s*['"]home['"]/.test(content)) {
      found = true
      break
    }
  }

  homeCache.set(projectRoot, found)
  return found
}

/**
 * 四查自检
 */
export async function runSelfCheck(projectRoot: string): Promise<Issue[]> {
  const issues: Issue[] = []

  const files = await walk(
    projectRoot,
    SOURCE_EXTS,
    [
      'node_modules',
      'unpackage',
      'dist',
      '.git',
      'docs',
      '.claude',
      '.agents',
      'plugins',
      'scripts',
      'packages',
    ],
  )

  const pkgPath = path.join(projectRoot, 'package.json')
  const pkg = existsSync(pkgPath) ? await readJson<any>(pkgPath) : {}
  const declared = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ])

  const configPath = path.join(projectRoot, 'pages.config.json')
  const configJson = existsSync(configPath) ? await readJson<any>(configPath).catch(() => null) : null
  const easycomTags = await collectEasycomTags(projectRoot, configJson)

  for (const file of files) {
    const rel = path.relative(projectRoot, file)

    if (rel.startsWith('uni_modules/') || rel.startsWith('uni_modules\\')) {
      continue
    }

    const content = stripComments(await fs.readFile(file, 'utf-8'))

    // 1 & 4：import 说明符
    for (const spec of extractSpecifiers(content)) {
      if (spec.startsWith('@/') || spec.startsWith('.')) {
        const candidates = candidatesFor(spec, file, projectRoot)
        if (!candidates.some(c => existsSync(c))) {
          issues.push({
            level: 'error',
            code: 'dangling-import',
            file: rel,
            message: `悬空 import：'${spec}' 解析不到任何文件`,
          })
        }
        continue
      }

      if (spec.startsWith('virtual:') || spec.startsWith('#') || spec.startsWith('/')) {
        continue
      }

      const bare = spec.startsWith('@')
        ? spec.split('/').slice(0, 2).join('/')
        : spec.split('/')[0]!

      if (NODE_BUILTINS.has(bare) || bare.startsWith('node:')) {
        continue
      }
      if (rel.startsWith('uni_modules/') || rel.startsWith('uni_modules\\')) {
        continue
      }
      if (!declared.has(bare)) {
        issues.push({
          level: 'warn',
          code: 'dependency',
          file: rel,
          message: `依赖未声明：'${bare}' 不在 package.json 的 dependencies/devDependencies 中`,
        })
      }
    }

    // 2：easycom 标签
    const localImports = new Set([
      ...extractSpecifiers(content).map(s => path.basename(s).replace(/\.[^.]+$/, '')),
      ...extractImportBindings(content),
    ])
    for (const tag of extractTags(content)) {
      if (!isCustomTag(tag)) {
        continue
      }
      if (easycomTags.has(tag) || localImports.has(tag)) {
        continue
      }
      if (new RegExp(`(?:const|function|class)\\s+${tag}\\b`).test(content)) {
        continue
      }
      issues.push({
        level: 'error',
        code: 'dangling-tag',
        file: rel,
        message: `悬空组件标签：<${tag}> 既未 import，也未被 easycom / uni_modules / src/components 解析到`,
      })
    }
  }

  // 3：路由一致性
  for (const pagesFile of ['pages.json', 'pages.config.json']) {
    const abs = path.join(projectRoot, pagesFile)
    if (!existsSync(abs)) {
      continue
    }
    const data = await readJson<any>(abs).catch(() => null)
    if (data == null) {
      continue
    }

    const pages: any[] = data.pages ?? []
    for (const page of pages) {
      if (typeof page?.path !== 'string') {
        continue
      }
      const candidate = path.join(projectRoot, `${page.path}.uvue`)
      if (!existsSync(candidate)) {
        issues.push({
          level: 'error',
          code: 'route',
          file: pagesFile,
          message: `路由指向不存在的页面：'${page.path}'（缺少 ${page.path}.uvue）`,
        })
      }
    }

    if (pages.length === 0) {
      issues.push({
        level: 'error',
        code: 'route',
        file: pagesFile,
        message: 'pages 为空 —— 应用没有启动页',
      })
    }
    else if (!await homeDeclared(projectRoot)) {
      issues.push({
        level: 'warn',
        code: 'route',
        file: pagesFile,
        message: '源码里找不到任何 `definePage({ type: \'home\' })`，启动首页只能靠扫描顺序决定',
      })
    }

    for (const sp of data.subPackages ?? []) {
      if (typeof sp?.root !== 'string') {
        continue
      }
      if (!existsSync(path.join(projectRoot, sp.root))) {
        issues.push({
          level: 'error',
          code: 'route',
          file: pagesFile,
          message: `分包根目录不存在：'${sp.root}'（插件不会自动清理，会导致编译报错）`,
        })
        continue
      }
      if (!Array.isArray(sp.pages) || sp.pages.length === 0) {
        issues.push({
          level: 'error',
          code: 'route',
          file: pagesFile,
          message: `分包 '${sp.root}' 的 pages 为空，应从配置中整体移除`,
        })
        continue
      }
      for (const page of sp.pages) {
        if (typeof page?.path !== 'string') {
          continue
        }
        const candidate = path.join(projectRoot, sp.root, `${page.path}.uvue`)
        if (!existsSync(candidate)) {
          issues.push({
            level: 'error',
            code: 'route',
            file: pagesFile,
            message: `分包路由指向不存在的页面：'${sp.root}/${page.path}'`,
          })
        }
      }
    }
  }

  return issues
}
