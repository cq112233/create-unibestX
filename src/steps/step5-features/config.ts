import type { Feature } from '../../types'

/**
 * 第五步：业务扩展功能定义与裁剪配置（对齐 FunctionView 业务演示列表）
 * 注意：
 * - z-paging-x（原生分页与嵌套滚动）为项目核心底座，永久保留，不提供取消勾选项；
 * - RxJS 响应式流（UTS 自研 rxjs-lite，被 src/http/stream/stream.uts 依赖）同样内置恒留，
 *   其演示分包 src/sub/rxjsFunctionDemo 永不裁剪；
 * - 图表选型已单独提炼为第四步（XTF-Charts 原生图表 / ECharts 跨端图表）。
 *
 * 供用户自由选配的可选扩展能力：
 * 包含：time, limeShared, limeUse, limeColor, bignumber, crypto, webview
 * 其中 time（lime-dayuts 时间日期处理）为日期时间高频底座，默认勾选；
 * 其余默认都不选中。
 *
 * 跨分支注意：uniX-uview-ultra 分支的 uni_modules/uview-ultra/package.json 声明了
 * uni_modules.dependencies: ['lime-dayuts']，取消勾选 time 时 resolveModuleClosure
 * 会自动保护插件本体（只清演示分包），不会产生悬空引用。
 *
 * 不进选项列表、永远裁剪的演示资产见 ALWAYS_PRUNE_FEATURE_ASSETS（signature / device / nestedScroll）。
 */
export const EXTRA_FEATURE_ITEMS: Feature[] = [
  {
    key: 'time',
    label: 'lime-dayuts 时间日期处理',
    hint: 'dayjs 的 UTS 移植版：日期解析与格式化、增减计算、相对时间与时间戳转换，内置中英双语 locale',
    default: true,
    removePaths: [
      'uni_modules/lime-dayuts',
      'src/sub/timeFunctionDemo',
    ],
  },
  {
    key: 'limeShared',
    label: 'lime-shared 工具函数',
    hint: '浮点精度、序列生成、唯一标识、数组去重切片、路径取值、命名转换与深比较',
    default: false,
    removePaths: [
      'src/sub/limeSharedFunctionDemo',
    ],
  },
  {
    key: 'limeUse',
    label: 'lime-use 组合式函数',
    hint: 'useCountDown、useCodeTimer、useTimeout 与 useZIndex 四个常用组合式函数',
    default: false,
    removePaths: [
      'uni_modules/lime-use',
      'src/sub/limeUseFunctionDemo',
    ],
  },
  {
    key: 'limeColor',
    label: 'lime-color 颜色工具',
    hint: '颜色格式互转、亮度饱和度调整、配色方案生成与 Ant Design 主题色阶',
    default: false,
    removePaths: [
      'src/sub/limeColorFunctionDemo',
    ],
  },
  {
    key: 'bignumber',
    label: 'BigNumber 大数据运算',
    hint: '任意精度十进制运算：加减乘除、浮点误差对照、除法精度、幂与开方、进制转换与九种舍入模式 (bignumber-bestX)',
    default: false,
    removePaths: [
      'uni_modules/bignumber-bestX',
      'src/sub/bignumberFunctionDemo',
      // 模板的单元测试直接 import 插件本体，不跟着删会悬空、生成后被自检回滚
      'tests/unit/modules/bignumber.test.ts',
    ],
  },
  {
    key: 'crypto',
    label: 'Crypto 加密解密',
    hint: 'Base64、MD5、SHA-256、HMAC、AES 与 DES 常用加解密套件 (crypto-bestX)',
    default: false,
    removePaths: [
      'uni_modules/crypto-bestX',
      'src/sub/cryptoFunctionDemo',
    ],
  },
  {
    key: 'webview',
    label: 'WebView 双向通讯',
    hint: '网页容器内嵌、postMessage 跨端消息收发与 evalJS 动态交互',
    default: false,
    removePaths: [
      'src/sub/webviewFunctionDemo',
      'static/webview',
      'hybrid',
    ],
  },
]
