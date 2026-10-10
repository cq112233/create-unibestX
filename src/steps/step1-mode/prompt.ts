import process from 'node:process'
import * as p from '@clack/prompts'
import { green } from 'kolorist'
import type { Step1Result, TemplateMode } from './types'

/**
 * 第一步：单选模板模式
 * 极简模式：直接拉取 base 分支，跳过后续步骤
 * 复杂模式：走第二步（选择 UI、底座与扩展功能）
 * 默认：复杂模式
 */
export async function promptStep1Mode(): Promise<Step1Result> {
  const choice = await p.select({
    message: '第一步: 请选择模板模式',
    options: [
      {
        value: 'complex',
        label: `${green('复杂模式')}（推荐）`,
        hint: '自定义配置 UI 组件库、系统底座与丰富扩展功能',
      },
      {
        value: 'minimal',
        label: '极简模式',
        hint: '直接拉取 base 分支，零冗余纯净基线，仅保留框架核心',
      },
    ],
    initialValue: 'complex',
  })

  if (p.isCancel(choice)) {
    p.cancel('操作已取消')
    process.exit(0)
  }

  const mode = choice as TemplateMode
  return {
    mode,
    template: mode === 'minimal' ? 'base' : undefined,
  }
}
