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
    ],
    alias: {
      h: 'help',
      v: 'version',
      y: 'yes',
      u: 'ui',
      p: 'platform',
      l: 'login',
      i: 'i18n',
      f: 'features',
      t: 'template',
      m: 'package-manager',
      pm: 'package-manager',
    },
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
