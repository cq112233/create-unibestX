import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { PatchRule, Replacement } from '../types'

/** 锚点未命中且规则非 optional 时抛出 */
export class PatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PatchError'
  }
}

export type PatchOutcome = {
  file: string
  label: string
  /** 实际删除的行数 */
  removedLines: number
  /** 锚点未命中且规则 optional，已跳过 */
  skipped: boolean
}

/** 统计一段文本里某个正则的出现次数 */
function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length
}

/** 按标签名统计「开标签 / 闭标签」，忽略自闭合写法 */
type TagBalance = { open: number, close: number }

/**
 * 扫描标签，跨行统计，并跳过 HTML 注释
 */
function tagBalance(content: string, tag: string): TagBalance {
  const openRe = new RegExp(`^<${tag}(?=[\\s/>])`)
  const closeRe = new RegExp(`^</${tag}[\\s>]`)
  const balance: TagBalance = { open: 0, close: 0 }

  let i = 0
  while (i < content.length) {
    const lt = content.indexOf('<', i)
    if (lt === -1) {
      break
    }

    // 注释整块跳过，里面的尖括号不算标签
    if (content.startsWith('<!--', lt)) {
      const endComment = content.indexOf('-->', lt + 4)
      i = endComment === -1 ? content.length : endComment + 3
      continue
    }

    // 读到不在属性引号里的第一个 '>'，标签才算结束
    let j = lt + 1
    let quote = ''
    while (j < content.length) {
      const ch = content[j]!
      if (quote !== '') {
        if (ch === quote) {
          quote = ''
        }
      }
      else if (ch === '"' || ch === '\'') {
        quote = ch
      }
      else if (ch === '>') {
        break
      }
      j++
    }

    const raw = content.slice(lt, j + 1)
    if (closeRe.test(raw)) {
      balance.close++
    }
    else if (openRe.test(raw) && !/\/>$/.test(raw.trim())) {
      balance.open++
    }
    i = j + 1
  }

  return balance
}

/**
 * 结构签名：各类括号与标签的净余额
 */
export function balanceSignature(content: string): string {
  const pair = (label: string, open: number, close: number): string => `${label}${open - close}`

  const view = tagBalance(content, 'view')
  const template = tagBalance(content, 'template')
  const script = tagBalance(content, 'script')
  const style = tagBalance(content, 'style')

  return [
    pair('{}', countMatches(content, /\{/g), countMatches(content, /\}/g)),
    pair('view', view.open, view.close),
    pair('template', template.open, template.close),
    pair('script', script.open, script.close),
    pair('style', style.open, style.close),
  ].join('|')
}

/**
 * 行匹配
 * - 默认（exact 为假）：两侧 trim 后做 includes，容忍缩进与行尾差异
 * - exact 为真：保留前导缩进做整行比较（仅忽略行尾空白）
 */
function makeMatcher(anchor: string, exact: boolean): (line: string) => boolean {
  if (exact) {
    const target = anchor.replace(/\s+$/, '')
    return line => line.replace(/\s+$/, '') === target
  }
  const target = anchor.trim()
  return line => line.trim().includes(target)
}

/** 把连续的多个空行压成一个 */
function collapseBlankLines(lines: string[]): string[] {
  const out: string[] = []
  let blanks = 0
  for (const line of lines) {
    if (line.trim() === '') {
      blanks++
      if (blanks > 1) {
        continue
      }
    }
    else {
      blanks = 0
    }
    out.push(line)
  }
  return out
}

/**
 * 在单个文件上应用若干条规则
 */
export async function applyPatches(
  projectRoot: string,
  rules: PatchRule[],
  warn: (msg: string) => void,
): Promise<PatchOutcome[]> {
  const byFile = new Map<string, PatchRule[]>()
  for (const rule of rules) {
    const list = byFile.get(rule.file) ?? []
    list.push(rule)
    byFile.set(rule.file, list)
  }

  const outcomes: PatchOutcome[] = []

  for (const [file, fileRules] of byFile) {
    const abs = path.join(projectRoot, file)
    if (!existsSync(abs)) {
      const missing = fileRules.filter(r => !r.optional)
      if (missing.length > 0) {
        throw new PatchError(`目标文件不存在: ${file}`)
      }
      for (const rule of fileRules) {
        warn(`跳过（文件不存在）: ${file} ← ${rule.label ?? rule.start}`)
        outcomes.push({ file, label: rule.label ?? rule.start, removedLines: 0, skipped: true })
      }
      continue
    }

    const original = await fs.readFile(abs, 'utf-8')
    const eol = original.includes('\r\n') ? '\r\n' : '\n'
    let lines = original.split(/\r?\n/)

    const before = balanceSignature(original)
    // 每条规则的命中区间（行号），最后统一从后往前删
    const ranges: Array<{ from: number, to: number, rule: PatchRule }> = []

    for (const rule of fileRules) {
      const startHit = makeMatcher(rule.start, rule.startExact === true)
      const endHit = rule.end ? makeMatcher(rule.end, rule.endExact === true) : null

      const starts: number[] = []
      for (let i = 0; i < lines.length; i++) {
        if (startHit(lines[i]!)) {
          starts.push(i)
        }
      }

      if (starts.length === 0) {
        if (rule.optional) {
          warn(`跳过（锚点未命中）: ${file} ← ${rule.label ?? rule.start}`)
          outcomes.push({ file, label: rule.label ?? rule.start, removedLines: 0, skipped: true })
          continue
        }
        throw new PatchError(`锚点未命中: ${file} ← ${JSON.stringify(rule.start)}`)
      }

      const occurrence = rule.occurrence ?? 'once'
      if (occurrence === 'once' && starts.length > 1) {
        throw new PatchError(
          `锚点在 ${file} 中命中 ${starts.length} 次，规则要求唯一：${JSON.stringify(rule.start)}。`
          + `请改用 occurrence: 'many' 或换一个更精确的锚点。`,
        )
      }

      const offset = rule.startOffset ?? 0
      const targets = (occurrence === 'once' ? [starts[0]!] : starts)
        .map(i => i + offset)
        .filter(i => i >= 0 && i < lines.length)

      if (targets.length === 0) {
        warn(
          `跳过（startOffset 越界）: ${file} ← ${rule.label ?? rule.start}`
          + `（锚点命中第 ${starts[0]! + 1} 行，偏移 ${offset} 落到文件外，规则未生效）`,
        )
        outcomes.push({ file, label: rule.label ?? rule.start, removedLines: 0, skipped: true })
        continue
      }

      for (const from of targets) {
        if (!rule.end) {
          ranges.push({ from, to: from, rule })
          continue
        }
        let to = -1
        for (let j = from + 1; j < lines.length; j++) {
          if (endHit!(lines[j]!)) {
            to = j
            break
          }
        }
        if (to === -1) {
          if (rule.optional) {
            warn(`跳过（结束锚点未命中）: ${file} ← ${rule.label ?? rule.start}`)
            continue
          }
          throw new PatchError(
            `结束锚点未命中: ${file} ← ${JSON.stringify(rule.start)} .. ${JSON.stringify(rule.end)}`,
          )
        }
        ranges.push({ from, to, rule })
      }
    }

    if (ranges.length === 0) {
      for (const rule of fileRules) {
        const label = rule.label ?? rule.start
        if (!outcomes.some(o => o.file === file && o.label === label)) {
          outcomes.push({ file, label, removedLines: 0, skipped: true })
        }
      }
      continue
    }

    // 从后往前删，行号不漂移
    ranges.sort((a, b) => b.from - a.from)
    const removedPerRule = new Map<PatchRule, number>()
    for (const range of ranges) {
      removedPerRule.set(range.rule, (removedPerRule.get(range.rule) ?? 0) + (range.to - range.from + 1))
      lines.splice(range.from, range.to - range.from + 1)
    }

    lines = collapseBlankLines(lines)
    const next = lines.join(eol)
    const after = balanceSignature(next)
    if (after !== before) {
      warn(`结构计数变化（请人工复核）: ${file}\n  前: ${before}\n  后: ${after}`)
    }

    await fs.writeFile(abs, next, 'utf-8')

    for (const rule of fileRules) {
      const removed = removedPerRule.get(rule) ?? 0
      outcomes.push({
        file,
        label: rule.label ?? rule.start,
        removedLines: removed,
        skipped: removed === 0,
      })
    }
  }

  return outcomes
}

/** 精确文本替换的结果 */
export type ReplacementOutcome = {
  file: string
  label: string
  replaced: number
  skipped: boolean
}

/**
 * 精确文本替换
 */
export async function applyReplacements(
  projectRoot: string,
  rules: Replacement[],
  warn: (msg: string) => void,
): Promise<ReplacementOutcome[]> {
  const byFile = new Map<string, Replacement[]>()
  for (const rule of rules) {
    const list = byFile.get(rule.file) ?? []
    list.push(rule)
    byFile.set(rule.file, list)
  }

  const outcomes: ReplacementOutcome[] = []

  for (const [file, fileRules] of byFile) {
    const abs = path.join(projectRoot, file)
    if (!existsSync(abs)) {
      for (const rule of fileRules) {
        if (rule.optional) {
          warn(`跳过（文件不存在）: ${file} ← ${rule.label ?? rule.from}`)
          outcomes.push({ file, label: rule.label ?? rule.from, replaced: 0, skipped: true })
          continue
        }
        throw new PatchError(`目标文件不存在: ${file}`)
      }
      continue
    }

    const original = await fs.readFile(abs, 'utf-8')
    const before = balanceSignature(original)
    let next = original
    const counts = new Map<Replacement, number>()

    for (const rule of fileRules) {
      const hits = next.split(rule.from).length - 1
      counts.set(rule, hits)
      if (hits === 0) {
        if (rule.optional) {
          warn(`跳过（片段未命中）: ${file} ← ${rule.label ?? rule.from}`)
          continue
        }
        throw new PatchError(`替换片段未命中: ${file} ← ${JSON.stringify(rule.from)}`)
      }
      next = next.split(rule.from).join(rule.to)
    }

    if (next === original) {
      for (const rule of fileRules) {
        outcomes.push({
          file,
          label: rule.label ?? rule.from,
          replaced: 0,
          skipped: true,
        })
      }
      continue
    }

    const eol = next.includes('\r\n') ? '\r\n' : '\n'
    next = collapseBlankLines(next.split(/\r?\n/)).join(eol)

    const after = balanceSignature(next)
    if (after !== before) {
      warn(`结构计数变化（请人工复核）: ${file}\n  前: ${before}\n  后: ${after}`)
    }

    await fs.writeFile(abs, next, 'utf-8')

    for (const rule of fileRules) {
      const replaced = counts.get(rule) ?? 0
      outcomes.push({
        file,
        label: rule.label ?? rule.from,
        replaced,
        skipped: replaced === 0,
      })
    }
  }

  return outcomes
}
