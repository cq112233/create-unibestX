import type { Feature } from '../../types'

/**
 * 第四步：扩展功能定义与裁剪配置（对齐 FunctionView 业务演示列表）
 * 注意：
 * - z-paging-x（原生分页与嵌套滚动）为项目核心底座，永久保留，不提供取消勾选项；
 * - lime-dayuts（Time 时间日期处理）为核心依赖底座，永久保留，不提供取消勾选项。
 *
 * 供用户自由选配的可选扩展能力：
 * 包含：echarts, signature, rxjs, device, lodash, crypto, webview
 * 默认都不选中
 */
export const EXTRA_FEATURE_ITEMS: Feature[] = [
  {
    key: 'echarts',
    label: 'ECharts 跨端图表',
    hint: '基于 e-chart 组件，折线图、柱状图、饼图跨端渲染',
    default: false,
    removePaths: [
      'uni_modules/e-chart',
      'src/sub/echartsFunctionDemo',
    ],
  },
  {
    key: 'signature',
    label: 'lime-signature 签名板',
    hint: '平滑笔迹书写、画笔粗细与颜色调节、撤销重做与图片保存',
    default: false,
    removePaths: [
      'uni_modules/lime-signature',
      'src/sub/signatureFunctionDemo',
    ],
  },
  {
    key: 'rxjs',
    label: 'RxJS 响应式流',
    hint: 'UTS 自研 rxjs-lite，防抖节流、流式接收与订阅管理',
    default: false,
    removePaths: [
      'src/sub/rxjsFunctionDemo',
    ],
  },
  {
    key: 'device',
    label: '原生设备与系统能力',
    hint: '拨号分享、文件文档预览、触感震动、键盘避让与相机扫码',
    default: false,
    removePaths: [
      'src/sub/deviceFunctionDemo',
    ],
  },
  {
    key: 'lodash',
    label: 'Lodash 工具库',
    hint: '数组切片去重、对象深拷贝、驼峰转换与函数防抖节流 (iRainna-lodash)',
    default: false,
    removePaths: [
      'uni_modules/iRainna-lodash',
      'src/sub/lodashFunctionDemo',
    ],
  },
  {
    key: 'crypto',
    label: 'Crypto 加密解密',
    hint: 'Base64、MD5、SHA-256、HMAC、AES 与 DES 常用加解密套件 (unix-crypto)',
    default: false,
    removePaths: [
      'uni_modules/unix-crypto',
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
  {
    key: 'nestedScroll',
    label: 'NestedScroll 自研嵌套滚动',
    hint: '自研原生手势联通与平滑衔接，彻底消除双重滚动冲突',
    default: false,
    removePaths: [
      'src/components/NestedScroll',
      'src/sub/nestedScrollFunctionDemo',
    ],
  },
]

