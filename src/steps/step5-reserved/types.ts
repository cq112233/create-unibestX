import type { PackageManager } from '../../types'

export type Step5Result = {
  packageManager: PackageManager
  install: boolean
  reservedConfig?: Record<string, any>
}
