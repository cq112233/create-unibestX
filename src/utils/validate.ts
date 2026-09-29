import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { yellow } from 'kolorist'

/**
 * 校验项目名：既是合法目录名，也是合法 npm 包名
 */
export function validateProjectName(value: string): string | undefined {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return '项目名不能为空'
  }
  if (!/^[a-z\d][\w.-]*$/i.test(trimmed)) {
    return '项目名称只能包含英文字母、数字、点(.)、下划线(_)和短横线(-)，且不能以点或连字符开头'
  }
  if (trimmed.length > 214) {
    return '项目名过长（npm 包名上限 214 字符）'
  }
  return undefined
}

/**
 * 检查目录是否已存在且非空，并校验名称格式
 */
export function checkProjectNameExistAndValidate(projectName: string, cwd = process.cwd()): string | undefined {
  const problem = validateProjectName(projectName)
  if (problem) {
    return problem
  }

  const targetDir = path.resolve(cwd, projectName.trim())
  if (existsSync(targetDir)) {
    return `目录 ${yellow(projectName.trim())} 已存在，请选择其他名称或删除已有目录`
  }

  return undefined
}

/**
 * 从位置参数推出项目名（取 basename 并校验）
 */
export function deriveProjectName(raw: string): string {
  const name = path.basename(path.resolve(process.cwd(), raw))
  const problem = validateProjectName(name)
  if (problem) {
    throw new Error(
      `项目名不合法: ${problem}（从 ${JSON.stringify(raw)} 推出 ${JSON.stringify(name)}）。`
      + '项目名取路径最后一段，且必须是合法的 npm 包名。',
    )
  }
  return name
}
