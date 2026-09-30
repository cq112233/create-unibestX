import type { PatchRule, SubPackage } from '../types'

/**
 * 「入口卡片」分组
 *
 * 演示分包都不是从 tab 直接进入的，而是经由 src/pages/<页>/components/ 下的一张卡片跳转。
 * 有的卡片只服务一个分包（如 HttpDemoCard → httpDemo），有的服务多个（如 UtilsNavCard
 * 一次性提供 device / lodash / crypto / time 四个入口）。
 *
 * 规则：当某张卡片服务的分包全部被裁掉时，整张卡片连同它在视图里的 import 与标签一并删除；
 * 否则只做按钮级断链（由分包自身的 patches 负责）。
 */
export type CardGroup = {
  /** 卡片文件（相对项目根） */
  card: string
  /** 该卡片服务的分包目录名 */
  serves: string[]
  /** 引用该卡片的视图文件及其中的 import / 标签锚点 */
  importer: {
    file: string
    importAnchor: string
    tagAnchor: string
  }
}

export const CARD_GROUPS: CardGroup[] = [
  {
    card: 'src/pages/basic/components/HttpDemoCard.uvue',
    serves: ['httpDemo'],
    importer: {
      file: 'src/pages/basic/views/BasicView.uvue',
      importAnchor: 'import HttpDemoCard from \'../components/HttpDemoCard.uvue\';',
      tagAnchor: '<HttpDemoCard />',
    },
  },
  {
    card: 'src/pages/basic/components/RxjsDemoCard.uvue',
    serves: ['rxjsDemo'],
    importer: {
      file: 'src/pages/basic/views/BasicView.uvue',
      importAnchor: 'import RxjsDemoCard from \'../components/RxjsDemoCard.uvue\';',
      tagAnchor: '<RxjsDemoCard />',
    },
  },
  {
    card: 'src/pages/basic/components/LayoutDemoCard.uvue',
    serves: ['layoutDemo'],
    importer: {
      file: 'src/pages/basic/views/BasicView.uvue',
      importAnchor: 'import LayoutDemoCard from \'../components/LayoutDemoCard.uvue\';',
      tagAnchor: '<LayoutDemoCard />',
    },
  },
  {
    card: 'src/pages/basic/components/TailwindcssDemoCard.uvue',
    serves: ['tailwindcss'],
    importer: {
      file: 'src/pages/basic/views/BasicView.uvue',
      importAnchor: 'import TailwindcssDemoCard from \'../components/TailwindcssDemoCard.uvue\';',
      tagAnchor: '<TailwindcssDemoCard />',
    },
  },
  {
    card: 'src/pages/function/components/ZPagingDemoCard.uvue',
    serves: ['zpaging', 'nested-scroll'],
    importer: {
      file: 'src/pages/function/views/FunctionView.uvue',
      importAnchor: 'import ZPagingDemoCard from \'../components/ZPagingDemoCard.uvue\';',
      tagAnchor: '<ZPagingDemoCard />',
    },
  },
  {
    card: 'src/pages/function/components/UtilsNavCard.uvue',
    serves: ['device', 'lodash', 'crypto', 'time'],
    importer: {
      file: 'src/pages/function/views/FunctionView.uvue',
      importAnchor: 'import UtilsNavCard from \'../components/UtilsNavCard.uvue\';',
      tagAnchor: '<UtilsNavCard />',
    },
  },
]

/** 按钮级断链的公共锚点：函数定义体（起始行 → 列 0 的 `}`） */
function fnBlock(name: string): PatchRule[] {
  return [{
    file: 'src/pages/function/components/UtilsNavCard.uvue',
    start: `function ${name}() {`,
    end: '}',
    endExact: true,
    label: `删除 ${name} 函数`,
  }]
}

/** 按钮级断链的公共锚点：卡片内的单个入口块 */
function cardBlock(comment: string, accent: string): PatchRule {
  return {
    file: 'src/pages/function/components/UtilsNavCard.uvue',
    start: `<!-- ${comment} -->`,
    end: '    </view>',
    endExact: true,
    label: `删除「${comment}」入口块（${accent}）`,
  }
}

/**
 * 12 个演示分包
 *
 * auth 不在此列 —— 它由 auth 功能开关统一管理（同时涉及路由守卫等跨文件改动）。
 */
export const SUB_PACKAGES: SubPackage[] = [
  {
    dir: 'crypto',
    label: 'Crypto 加密解密',
    hint: 'Base64 / MD5 / SHA-256 / HMAC / AES / DES',
    modules: ['unix-crypto'],
    default: true,
    patches: [
      cardBlock('Crypto 加解密工具入口', 'unix-crypto'),
      ...fnBlock('navigateToCrypto'),
    ],
  },
  {
    dir: 'device',
    label: '原生设备能力',
    hint: '拨号分享、文件预览、触感震动、键盘避让、相机扫码',
    default: true,
    patches: [
      cardBlock('原生设备能力入口', 'device'),
      ...fnBlock('navigateToDevice'),
    ],
  },
  {
    dir: 'httpDemo',
    label: 'HTTP 请求 Demo',
    hint: '基于 src/http/request.uts 的完整请求示例',
    extraRemovePaths: ['src/api'],
    default: true,
  },
  {
    dir: 'layoutDemo',
    label: '布局页面示例',
    hint: '系统安全区尺寸与布局计算演示',
    default: true,
  },
  {
    dir: 'lodash',
    label: 'Lodash 工具库',
    hint: '数组切片去重、深拷贝、驼峰转换、防抖（依赖 iRainna-lodash）',
    modules: ['iRainna-lodash'],
    default: true,
    patches: [
      cardBlock('Lodash 工具库入口', 'iRainna-lodash'),
      ...fnBlock('navigateToLodash'),
    ],
  },
  {
    dir: 'nested-scroll',
    label: 'NestedScroll 嵌套滚动',
    hint: '自研嵌套滚动容器组件（含 src/components/NestedScroll）',
    extraRemovePaths: ['src/components/NestedScroll'],
    default: true,
    patches: [
      {
        file: 'src/pages/function/components/ZPagingDemoCard.uvue',
        start: '@click="navigateToNestedScroll"',
        startOffset: -2,
        end: '      </view>',
        endExact: true,
        label: '删除 ZPagingDemoCard 中的 NestedScroll 按钮',
      },
      {
        file: 'src/pages/function/components/ZPagingDemoCard.uvue',
        start: 'function navigateToNestedScroll(): void {',
        end: '}',
        endExact: true,
        label: '删除 navigateToNestedScroll 函数',
      },
    ],
  },
  {
    dir: 'rxjsDemo',
    label: 'RxJS 流式渲染',
    hint: 'SSE / Chunk 流式传输演示（依赖 mp-html 渲染 Markdown）',
    modules: ['mp-html'],
    extraRemovePaths: ['src/http/stream.uts'],
    default: true,
  },
  {
    dir: 'tailwindcss',
    label: 'weapp-tailwindcss 示例',
    hint: '仅删示例页面；Tailwind 构建链属项目基础能力，不受影响',
    default: true,
  },
  {
    dir: 'test',
    label: 'URL 参数测试',
    hint: '路由传参演示；路由黑名单里引用了它，会一并清理',
    default: true,
    patches: [{
      file: 'src/router/config.uts',
      start: '\'/src/sub/test/test\' // 示例值',
      optional: true,
      label: '清理路由黑名单中的 test 引用',
    }],
  },
  {
    dir: 'time',
    label: '时间日期操作',
    hint: '格式化、增减计算、差异比较、时间戳',
    modules: [],
    default: true,
    patches: [
      cardBlock('Time 时间日期操作入口', 'lime-dayuts'),
      ...fnBlock('navigateToTime'),
    ],
  },
  {
    dir: 'uiTest',
    label: 'UI 测试',
    hint: '通用 UI 回归测试页，无外部依赖',
    default: true,
  },
  {
    dir: 'zpaging',
    label: 'z-paging-x 原生分页',
    hint: '高性能原生分页（依赖 z-paging-x）',
    modules: ['z-paging-x'],
    default: true,
    patches: [
      {
        file: 'src/pages/function/components/ZPagingDemoCard.uvue',
        start: '@click="navigateToZPaging"',
        startOffset: -2,
        end: '      </view>',
        endExact: true,
        label: '删除 ZPagingDemoCard 中的 z-paging 按钮',
      },
      {
        file: 'src/pages/function/components/ZPagingDemoCard.uvue',
        start: 'function navigateToZPaging(): void {',
        end: '}',
        endExact: true,
        label: '删除 navigateToZPaging 函数',
      },
    ],
  },
]

export function getSubPackage(dir: string): SubPackage | undefined {
  return SUB_PACKAGES.find(s => s.dir === dir)
}

export function getCardGroupByCard(card: string): CardGroup | undefined {
  return CARD_GROUPS.find(g => g.card === card)
}
