import type { PackageManager } from '../../types'
import type { Step5Result } from './types'

/**
 * 第五步：可以预留
 * 预留配置位，用于包管理器、依赖自动安装或未来扩展卡槽
 */
export async function promptStep5Reserved(
  defaultPackageManager: PackageManager = 'pnpm',
  defaultInstall: boolean = true,
): Promise<Step5Result> {
  // 第五步当前为预留扩展位，直接返回默认高可用配置
  return {
    packageManager: defaultPackageManager,
    install: defaultInstall,
    reservedConfig: {},
  }
}
