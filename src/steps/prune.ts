import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  ALWAYS_PRUNE_FEATURE_ASSETS,
  CARD_GROUPS,
  FEATURES,
  HARNESS_TIED_TO_UNUSED_MODULES,
  ORPHAN_FILES,
  SCRIPTS_TIED_TO_UNUSED_MODULES,
  SUB_PACKAGES,
  UNUSED_MODULES,
} from '../manifest'
import type { PatchRule, Replacement } from '../types'
import { fs, readJson, removeEmptyDirs, removePaths, writeJson } from '../utils/fs'
import { findTemplatesDir } from '../utils/paths'
import { applyPatches, applyReplacements } from '../utils/patch'

export type Selection = {
  /** 已勾选的 feature key */
  features: string[]
  /** 保留的分包目录名 */
  subPackages: string[]
  /** 是否清理零引用 uni_modules */
  cleanUnusedModules: boolean
}

export type PruneResult = {
  removedPaths: string[]
  appliedRules: number
  skippedRules: string[]
  replacedFiles: string[]
  removedDeps: string[]
  removedScripts: string[]
  routeCleanup: {
    pages: string[]
    subPackages: string[]
    easycom: string[]
  }
}

/**
 * 按勾选结果裁剪项目
 */
export async function prune(
  projectRoot: string,
  projectName: string,
  selection: Selection,
  step: (msg: string) => void,
  warn: (msg: string) => void,
): Promise<PruneResult> {
  const kept = new Set(selection.features)
  const keptSubs = new Set(selection.subPackages)

  const removeList: string[] = []
  const patchRules: PatchRule[] = []
  const replacements: Replacement[] = []
  const replaceFiles: Record<string, string> = {}
  const removedDeps: string[] = []
  const removedScripts: string[] = []

  // ---------- 1. 功能开关 ----------
  for (const feature of FEATURES) {
    if (kept.has(feature.key)) {
      continue
    }
    removeList.push(...feature.removePaths ?? [])
    patchRules.push(...feature.patches ?? [])
    replacements.push(...feature.replacements ?? [])
    Object.assign(replaceFiles, feature.replaceFiles ?? {})
    removedDeps.push(...feature.removeDeps ?? [])
    removedScripts.push(...feature.removeScripts ?? [])
  }

  // 默认自动裁剪非核心特性（AI、Skills、Docs、Docker 部署）
  removeList.push(...ALWAYS_PRUNE_FEATURE_ASSETS.removePaths)
  replacements.push(...ALWAYS_PRUNE_FEATURE_ASSETS.replacements)
  Object.assign(replaceFiles, ALWAYS_PRUNE_FEATURE_ASSETS.replaceFiles)
  removedDeps.push(...ALWAYS_PRUNE_FEATURE_ASSETS.removeDeps)
  removedScripts.push(...ALWAYS_PRUNE_FEATURE_ASSETS.removeScripts)

  // ---------- 2. 演示分包 ----------
  for (const sub of SUB_PACKAGES) {
    if (keptSubs.has(sub.dir)) {
      continue
    }
    removeList.push(`src/sub/${sub.dir}`)
    removeList.push(...sub.extraRemovePaths ?? [])
    for (const mod of sub.modules ?? []) {
      removeList.push(`uni_modules/${mod}`)
    }
    patchRules.push(...(sub.patches ?? []))
  }

  // ---------- 3. 入口卡片 ----------
  for (const group of CARD_GROUPS) {
    if (group.serves.some(dir => keptSubs.has(dir))) {
      continue
    }
    removeList.push(group.card)
    patchRules.push(
      { file: group.importer.file, start: group.importer.importAnchor, label: `删除 ${group.card} 的 import` },
      { file: group.importer.file, start: group.importer.tagAnchor, label: `删除 ${group.card} 的标签` },
    )
  }

  // ---------- 4. 零引用 uni_modules ----------
  if (selection.cleanUnusedModules) {
    for (const mod of UNUSED_MODULES) {
      removeList.push(`uni_modules/${mod}`)
    }
    removeList.push(...ORPHAN_FILES)
    removeList.push(...HARNESS_TIED_TO_UNUSED_MODULES)
    removedScripts.push(...SCRIPTS_TIED_TO_UNUSED_MODULES)
  }

  // ---------- 5. 删文件 ----------
  const uniqueRemovals = [...new Set(removeList)]

  assertModuleClosure(projectRoot, makeRemovalCheck(uniqueRemovals))

  step(`删除 ${uniqueRemovals.length} 个路径`)
  const removedPaths = await removePaths(uniqueRemovals.map(rel => path.join(projectRoot, rel)))
  const removedRel = removedPaths.map(abs => path.relative(projectRoot, abs))

  // ---------- 6. 模板替换 ----------
  const isGone = makeRemovalCheck(uniqueRemovals)
  const replacedFiles: string[] = []
  if (Object.keys(replaceFiles).length > 0) {
    step('写入替换版文件')
    const templatesDir = findTemplatesDir()
    for (const [target, source] of Object.entries(replaceFiles)) {
      if (isGone(target) || !existsSync(path.join(projectRoot, target))) {
        warn(`跳过替换（目标已删或不存在）: ${target} ← templates/${source}`)
        continue
      }
      const src = path.join(templatesDir, source)
      if (!existsSync(src)) {
        throw new Error(`模板文件缺失: templates/${source}`)
      }
      const dest = path.join(projectRoot, target)
      await fs.mkdir(path.dirname(dest), { recursive: true })
      const rendered = (await fs.readFile(src, 'utf-8'))
        .replaceAll('{{PROJECT_NAME}}', projectName)
      await fs.writeFile(dest, rendered, 'utf-8')
      replacedFiles.push(target)
    }
  }

  // ---------- 7. 改引用 ----------
  step('清理悬空引用')
  const aliveRules = patchRules.filter(rule => !isGone(rule.file) && existsSync(path.join(projectRoot, rule.file)))
  const aliveReplacements = replacements.filter(rule => !isGone(rule.file) && existsSync(path.join(projectRoot, rule.file)))

  const patchOutcomes = await applyPatches(projectRoot, aliveRules, warn)
  const replacementOutcomes = await applyReplacements(projectRoot, aliveReplacements, warn)

  const appliedRules = patchOutcomes.filter(o => !o.skipped).length
    + replacementOutcomes.filter(o => !o.skipped).length
  const skippedRules = [
    ...patchOutcomes.filter(o => o.skipped).map(o => `${o.file} ← ${o.label}`),
    ...replacementOutcomes.filter(o => o.skipped).map(o => `${o.file} ← ${o.label}`),
  ]

  // ---------- 8. 同步路由与 easycom ----------
  step('同步 pages.config.json / pages.json')
  const routeCleanup = await syncRouteConfigs(projectRoot, warn)

  // ---------- 9. 清理代码生成物的残留 ----------
  step('清理 .d.uts.ts 残留与 gen-uts-dts 源清单')
  await cleanGeneratedArtifacts(projectRoot, warn)

  // ---------- 10. 收拾空壳目录 ----------
  step('清理空目录')
  const emptyDirs = await removeEmptyDirs(
    projectRoot,
    projectRoot,
    ['node_modules', '.git', 'unpackage', 'dist', '.hbuilderx', '.idea'],
  )
  removedRel.push(...emptyDirs)

  return {
    removedPaths: removedRel,
    appliedRules,
    skippedRules,
    replacedFiles,
    removedDeps: [...new Set(removedDeps)],
    removedScripts: [...new Set(removedScripts)],
    routeCleanup,
  }
}

async function cleanGeneratedArtifacts(
  projectRoot: string,
  warn: (msg: string) => void,
): Promise<void> {
  const dtsFiles = await fsWalk(path.join(projectRoot, 'uni_modules'), '.d.uts.ts')
  const srcDts = await fsWalk(path.join(projectRoot, 'src'), '.d.uts.ts')
  const dangling: string[] = []

  for (const dts of [...dtsFiles, ...srcDts]) {
    const source = dts.replace(/\.d\.uts\.ts$/, '.uts')
    if (!existsSync(source)) {
      await fs.rm(dts, { force: true })
      dangling.push(path.relative(projectRoot, dts))
    }
  }
  if (dangling.length > 0) {
    warn(`清理了 ${dangling.length} 个悬空声明文件：${dangling.join(', ')}`)
  }

  const genFile = path.join(projectRoot, 'scripts/gen-uts-dts.mjs')
  if (!existsSync(genFile)) {
    return
  }

  const content = await fs.readFile(genFile, 'utf-8')
  const eol = content.includes('\r\n') ? '\r\n' : '\n'
  const lines = content.split(/\r?\n/)

  const start = lines.findIndex(line => /^const EXTRA_SOURCES = \[/.test(line))
  if (start === -1) {
    warn('scripts/gen-uts-dts.mjs 里找不到 EXTRA_SOURCES，跳过同步')
    return
  }
  let end = -1
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\];/.test(lines[i]!)) {
      end = i
      break
    }
  }
  if (end === -1) {
    warn('scripts/gen-uts-dts.mjs 的 EXTRA_SOURCES 数组没有正常闭合，跳过同步')
    return
  }

  const dropped: string[] = []
  const kept: string[] = []
  for (let i = start + 1; i < end; i++) {
    const line = lines[i]!
    const m = line.match(/path\.join\(ROOT,\s*'([^']+)'\)/)
    if (m && !existsSync(path.join(projectRoot, m[1]!))) {
      dropped.push(m[1]!)
      continue
    }
    kept.push(line)
  }

  if (dropped.length === 0) {
    return
  }

  const next = [...lines.slice(0, start + 1), ...kept, ...lines.slice(end)].join(eol)
  await fs.writeFile(genFile, next, 'utf-8')
  warn(`gen-uts-dts.mjs 的 EXTRA_SOURCES 移除了 ${dropped.length} 条已删路径：${dropped.join(', ')}`)
}

async function fsWalk(dir: string, suffix: string): Promise<string[]> {
  if (!existsSync(dir)) {
    return []
  }
  const out: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') {
        continue
      }
      out.push(...await fsWalk(abs, suffix))
    }
    else if (entry.name.endsWith(suffix)) {
      out.push(abs)
    }
  }
  return out
}

function makeRemovalCheck(removed: string[]): (file: string) => boolean {
  const normalized = removed.map(rel => rel.replace(/\\/g, '/').replace(/\/$/, ''))
  return (file: string): boolean => {
    const target = file.replace(/\\/g, '/')
    return normalized.some(rel => target === rel || target.startsWith(`${rel}/`))
  }
}

function subPagePath(root: string, pagePath: string): string {
  return `${root}/${pagePath}`
}

function assertModuleClosure(projectRoot: string, isGone: (p: string) => boolean): void {
  const modulesDir = path.join(projectRoot, 'uni_modules')
  if (!existsSync(modulesDir)) {
    return
  }

  const broken: string[] = []
  for (const name of readdirSync(modulesDir)) {
    if (name.startsWith('.')) {
      continue
    }
    if (isGone(`uni_modules/${name}`)) {
      continue
    }

    const pkgFile = path.join(modulesDir, name, 'package.json')
    if (!existsSync(pkgFile)) {
      continue
    }

    const raw = readFileSync(pkgFile, 'utf-8')
    const pkg = JSON.parse(raw) as Record<string, any>
    const deps = new Set<string>()

    for (const key of ['dependencies', 'devDependencies']) {
      for (const dep of Object.keys(pkg[key] ?? {})) {
        deps.add(dep)
      }
    }
    const uniDeps = pkg.uni_modules?.dependencies
    if (Array.isArray(uniDeps)) {
      for (const dep of uniDeps) {
        deps.add(String(dep))
      }
    }
    else if (uniDeps && typeof uniDeps === 'object') {
      for (const dep of Object.keys(uniDeps)) {
        deps.add(dep)
      }
    }

    for (const dep of deps) {
      if (isGone(`uni_modules/${dep}`)) {
        broken.push(`${name} 依赖 ${dep}`)
      }
    }
  }

  if (broken.length > 0) {
    throw new Error(
      `裁剪清单自相矛盾：以下保留的模块依赖了被删的模块，会直接编译失败：\n  · ${broken.join('\n  · ')}`,
    )
  }
}

export async function syncRouteConfigs(
  projectRoot: string,
  warn: (msg: string) => void,
): Promise<PruneResult['routeCleanup']> {
  const cleanup: PruneResult['routeCleanup'] = { pages: [], subPackages: [], easycom: [] }

  for (const file of ['pages.config.json', 'pages.json']) {
    const abs = path.join(projectRoot, file)
    if (!existsSync(abs)) {
      continue
    }
    const data = await readJson<Record<string, any>>(abs)
    if (data == null || typeof data !== 'object') {
      continue
    }

    // --- pages ---
    if (Array.isArray(data.pages)) {
      data.pages = data.pages.filter((page: any) => {
        if (typeof page?.path !== 'string') {
          return true
        }
        if (existsSync(path.join(projectRoot, `${page.path}.uvue`))) {
          return true
        }
        cleanup.pages.push(`${file}: ${page.path}`)
        return false
      })
    }

    // --- subPackages ---
    if (Array.isArray(data.subPackages)) {
      const nextSubs: any[] = []
      for (const sub of data.subPackages) {
        if (typeof sub?.root !== 'string') {
          nextSubs.push(sub)
          continue
        }
        if (!existsSync(path.join(projectRoot, sub.root))) {
          cleanup.subPackages.push(`${file}: ${sub.root}（目录已删）`)
          continue
        }
        const pages = Array.isArray(sub.pages)
          ? sub.pages.filter((page: any) => {
              if (typeof page?.path !== 'string') {
                return true
              }
              if (existsSync(path.join(projectRoot, `${subPagePath(sub.root, page.path)}.uvue`))) {
                return true
              }
              cleanup.pages.push(`${file}: ${subPagePath(sub.root, page.path)}`)
              return false
            })
          : []
        if (pages.length === 0) {
          cleanup.subPackages.push(`${file}: ${sub.root}（已无页面）`)
          continue
        }
        nextSubs.push({ ...sub, pages })
      }
      data.subPackages = nextSubs
    }

    // --- easycom.custom ---
    const custom = data?.easycom?.custom
    if (custom && typeof custom === 'object') {
      for (const [tag, target] of Object.entries(custom)) {
        if (typeof target !== 'string') {
          continue
        }
        const rel = target.replace(/^@\//, '')
        if (!existsSync(path.join(projectRoot, rel))) {
          delete custom[tag]
          cleanup.easycom.push(`${file}: ${tag} → ${target}`)
        }
      }
    }

    await writeJson(abs, data, '\t')
  }

  if (cleanup.pages.length > 0) {
    warn(`清理了 ${cleanup.pages.length} 条失效页面路由`)
  }
  if (cleanup.subPackages.length > 0) {
    warn(`清理了 ${cleanup.subPackages.length} 个空分包`)
  }
  if (cleanup.easycom.length > 0) {
    warn(`清理了 ${cleanup.easycom.length} 条失效 easycom 注册`)
  }

  return cleanup
}
