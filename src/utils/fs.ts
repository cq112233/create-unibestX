import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

/** 路径是否存在 */
export function exists(p: string): boolean {
  return existsSync(p)
}

/** 删除文件或目录（不存在时静默跳过） */
export async function removePath(p: string): Promise<boolean> {
  if (!existsSync(p)) {
    return false
  }
  await fs.rm(p, { recursive: true, force: true })
  return true
}

/** 批量删除，返回真正删掉的那些 */
export async function removePaths(paths: string[]): Promise<string[]> {
  const removed: string[] = []
  for (const p of paths) {
    if (await removePath(p)) {
      removed.push(p)
    }
  }
  return removed
}

/** 递归拷贝目录，跳过 `skip` 中命名的目录 */
export async function copyDir(src: string, dest: string, skip: string[] = []): Promise<void> {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    if (skip.includes(entry.name)) {
      continue
    }
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      await copyDir(from, to, skip)
    }
    else if (entry.isSymbolicLink()) {
      const link = await fs.readlink(from)
      await fs.symlink(link, to)
    }
    else {
      await fs.copyFile(from, to)
    }
  }
}

/**
 * 递归删除空目录（不动根目录自身），返回被删掉的相对路径
 *
 * git 不跟踪空目录，所以干净克隆里不可能有空目录 —— 见到一个就说明是本机
 * 手工操作留下的残渣。删掉它既能清掉模板自带的空壳（如 src/sub/dialogPage），
 * 也能收拾裁剪后只剩空壳的分包根（src/sub）。
 */
export async function removeEmptyDirs(
  root: string,
  base = root,
  skipDirs: string[] = ['node_modules', '.git'],
): Promise<string[]> {
  if (!existsSync(root)) {
    return []
  }

  const removed: string[] = []
  const entries = await fs.readdir(root, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory() || skipDirs.includes(entry.name)) {
      continue
    }
    removed.push(...await removeEmptyDirs(path.join(root, entry.name), base, skipDirs))
  }

  const left = await fs.readdir(root)
  if (left.length === 0 && root !== base) {
    await fs.rmdir(root)
    removed.push(path.relative(base, root))
  }

  return removed
}

/** 目标目录必须不存在或为空 */
export async function isEmptyDir(p: string): Promise<boolean> {
  if (!existsSync(p)) {
    return true
  }
  const entries = await fs.readdir(p)
  return entries.length === 0
}

/** 读 JSON（容忍注释与尾逗号，用于 pages.config.json / manifest.json 这类可含注释的文件） */
export async function readJson<T = any>(file: string): Promise<T> {
  const raw = await fs.readFile(file, 'utf-8')
  return JSON.parse(stripJsonComments(raw)) as T
}

/**
 * 写 JSON，保留结尾换行
 *
 * indent 默认 2 空格；manifest.json 与 pages.config.json 原文用制表符，
 * 传 '\t' 可以避免生成物出现整篇缩进漂移的 diff。
 */
export async function writeJson(
  file: string,
  data: unknown,
  indent: string | number = 2,
): Promise<void> {
  await fs.writeFile(file, `${JSON.stringify(data, null, indent)}\n`, 'utf-8')
}

/** 去掉 // 与 /* *\/ 注释（跳过字符串字面量内部），容忍尾逗号 */
export function stripJsonComments(input: string): string {
  let out = ''
  let inString = false
  let inLine = false
  let inBlock = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    const next = input[i + 1]

    if (inLine) {
      if (ch === '\n') {
        inLine = false
        out += ch
      }
      continue
    }
    if (inBlock) {
      if (ch === '*' && next === '/') {
        inBlock = false
        i++
      }
      continue
    }
    if (inString) {
      out += ch
      if (ch === '\\') {
        out += next ?? ''
        i++
      }
      else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      out += ch
      continue
    }
    if (ch === '/' && next === '/') {
      inLine = true
      i++
      continue
    }
    if (ch === '/' && next === '*') {
      inBlock = true
      i++
      continue
    }
    out += ch
  }

  // 去掉尾逗号
  return out.replace(/,(\s*[}\]])/g, '$1')
}

/** 收集目录下所有匹配后缀的文件（递归） */
export async function walk(
  dir: string,
  exts: string[],
  skipDirs: string[] = [],
): Promise<string[]> {
  const found: string[] = []
  if (!existsSync(dir)) {
    return found
  }

  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (skipDirs.includes(entry.name)) {
        continue
      }
      found.push(...await walk(path.join(dir, entry.name), exts, skipDirs))
    }
    else if (exts.some(ext => entry.name.endsWith(ext))) {
      found.push(path.join(dir, entry.name))
    }
  }
  return found
}

export { fs }
