#!/usr/bin/env node
import process from 'node:process'
import minimist from 'minimist'
import { createCommand } from './commands/create'
import { doctorCommand } from './commands/doctor'
import { printHelp } from './utils/help'
import { printVersion } from './utils/version'

async function main(): Promise<void> {
  const args = minimist(process.argv.slice(2), {
    boolean: [
      'help',
      'version',
      'yes',
      'keep-unused-modules',
      'keep-on-fail',
    ],
    string: [
      'features',
      'subs',
      'template',
      'package-manager',
      'ui',
      'local-repo',
    ],
    // 注意：`local` 刻意不放进 boolean。
    // 一旦声明为 boolean，minimist 在**没传 --no-local 时也会把它置为 false**，
    // 于是「用户显式关闭本地模式」和「用户没提这回事」变得无法区分。
    // 不声明时，--no-local 走 minimist 的取反分支得到 false，未传则是 undefined。
    alias: {
      h: 'help',
      v: 'version',
      y: 'yes',
      u: 'ui',
      f: 'features',
      t: 'template',
      m: 'package-manager',
      pm: 'package-manager',
    },
    // 注意：别名只保留真正被消费的那些。
    // `-p/-l/-i` 曾分别指向 platform/login/i18n，但这三个值全项目无人读取，
    // 属于「解析了但不生效」的装饰参数，已一并移除，避免 help 显得能用。
  })

  // 1. 版本与帮助信息
  if (args.v || args.version) {
    await printVersion()
    return
  }

  if (args.h || args.help) {
    printHelp()
    return
  }

  // 2. 位置参数处理
  const [first = 'create', ...rest] = args._
  const hasSubcommand = first === 'create' || first === 'new' || first === 'doctor'

  if (first === 'doctor') {
    await doctorCommand(rest[0])
    return
  }

  // 剥离子命令词，避免项目名被误认成 'create'
  args._ = hasSubcommand ? rest : [first, ...rest]

  await createCommand(args, {
    keepOnFail: Boolean(args['keep-on-fail']),
  })
}

main().catch((error) => {
  console.error('CLI 执行出错:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
