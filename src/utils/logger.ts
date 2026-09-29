import { log, spinner } from '@clack/prompts'
import { bold, red } from 'kolorist'

/** 日志工具，统一走 @clack/prompts 的视觉风格 */
export const logger = {
  info: (message: string): void => {
    log.info(bold(message))
  },

  success: (message: string): void => {
    log.success(bold(message))
  },

  error: (message: string): void => {
    log.error(bold(message))
  },

  warn: (message: string): void => {
    log.warn(bold(message))
  },

  step: (message: string): void => {
    log.step(bold(message))
  },

  /** 开始一个带 spinner 的任务 */
  start: (message: string): { stop: (msg?: string) => void, fail: (msg?: string) => void } => {
    const s = spinner()
    s.start(bold(message))
    return {
      stop: (msg?: string) => s.stop(msg ? bold(msg) : undefined),
      fail: (msg?: string) => s.stop(msg ? bold(red(msg)) : undefined),
    }
  },
}
