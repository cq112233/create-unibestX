import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

/**
 * 从当前模块位置向上找包根
 *
 * 打包后 import.meta.url 指向 <pkg>/dist/index.js，用 tsx 直跑源码时指向
 * <pkg>/src/utils/paths.ts —— 深度不同，所以向上找「含 templates/ 的目录」，
 * 而不是写死 ../ 的层数。
 */
function walkUp(predicate: (dir: string) => boolean): string | null {
  let dir = here
  for (let i = 0; i < 6; i++) {
    if (predicate(dir)) {
      return dir
    }
    const parent = path.dirname(dir)
    if (parent === dir) {
      break
    }
    dir = parent
  }
  return null
}

/** 包根目录（templates/ 的父级） */
export function findPackageRoot(): string {
  const root = walkUp(dir => existsSync(path.join(dir, 'package.json')))
  if (root === null) {
    throw new Error(`定位不到包根目录（从 ${here} 向上查找 package.json 失败）`)
  }
  return root
}

/** templates/ 目录的绝对路径 */
export function findTemplatesDir(): string {
  return path.join(findPackageRoot(), 'templates')
}

/** 读 CLI 自身版本号，用于写进生成物的 unibestx.cliVersion */
export async function readCliVersion(): Promise<string> {
  try {
    const raw = await fs.readFile(path.join(findPackageRoot(), 'package.json'), 'utf-8')
    return (JSON.parse(raw) as { version?: string }).version ?? '1.0.0'
  }
  catch {
    return '1.0.0'
  }
}
