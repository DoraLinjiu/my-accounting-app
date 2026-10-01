# 记账本（PWA 版）v1.1.0

大学生多账户记账 App：零依赖、纯离线、可「添加到主屏幕」，也可一键打包成 APK。

## v1.1 更新内容

- **图标全面升级 Font Awesome 6.5.0**：全站 Emoji（分类/账户/导航/按钮/弹层）替换为 FA 图标；马卡龙配色适配——白底用马卡龙粉、彩底气泡自动用「同色系深一度」、渐变底用白色；旧存档里的 emoji 图标自动迁移
- **图标选择器**：新增账户 / 新增分类时点选 32 个预设 FA 图标（替代原来的 emoji 输入框）
- **记录可编辑**：点流水任意一条 → 编辑面板，可改类型（支出⇄收入）、分类（下拉）、备注；金额只读；转账记录类型不可改（涉及两个账户）
- **删除二次确认**：删除记录前弹窗确认，防止误触
- **本月汇总卡片**：首页新增 总支出 / 总收入 / 结余 三栏汇总
- **顶部昵称自定义**：设置 → 个人 → 输入昵称保存，顶栏实时更新（默认 Dora）
- **备注不限字数**：记账和编辑均为多行文本框
- 应用名统一为「记账本」；缓存版本号 v1.1.0（SW + 静态资源 ?v=1.1）

## 功能清单

| 模块 | 功能 |
|------|------|
| 多账户 | 微信零钱 / 微信零钱通 / 支付宝零钱 / 余额宝 / 工商银行 / 建设银行，显示实时余额，支持账户互转、添加账户、改名、校准余额 |
| 快速记账 | 支出/收入/转账/AA 四种类型，账户 + 分类 + 金额 + 备注 + 日期；预设 餐饮/桶装水/交通/购物/娱乐/房租/其他 |
| AA 分账 | 输入总金额和人数，自动算每人份额，只把自己那份记进账本；内置「桶装水」「聚餐」一键场景 |
| 统计视图 | 按日/周/月/年切换，环形图（支出构成）+ 柱状图（收支趋势）+ 收支结余汇总 |
| 内置计算器 | 记账时点金额框弹出，支持 + - × ÷ %，实时预览结果 |
| 拖拽排序 | 账户列表、分类列表按住右侧手柄拖拽调整顺序（触屏/鼠标通用） |
| 本地存储 | localStorage 持久化，离线可用；支持 JSON 导出/导入备份 |
| 外观 | 马卡龙四色 #FFB3BA #BAE1FF #BAFFC9 #FFFFBA，卡片圆角 18px，深色模式，Font Awesome 图标 |

## 目录结构

```
accounting-app/
├── index.html            # 应用外壳（5 个页面 + 底部导航 + 弹层）
├── manifest.webmanifest  # PWA 清单
├── sw.js                 # Service Worker（离线缓存）
├── css/styles.css        # 马卡龙主题 + 深色模式
├── js/
│   ├── store.js          # 数据层：账户/分类/交易 CRUD + 余额计算 + 导入导出
│   ├── charts.js         # 纯 SVG 环形图/柱状图（零依赖）
│   └── app.js            # 主逻辑：路由、五个页面、记账流程、计算器、拖拽排序
└── icons/                # PWA 图标（含 make_icons.py 可重新生成）
```

## 本地运行

PWA 需要 http 环境（Service Worker 不支持 file:// 直开）：

```bash
cd accounting-app
python -m http.server 8765
# 浏览器打开 http://127.0.0.1:8765
```

## 添加到主屏幕（当 App 用）

- **安卓**：Chrome 打开页面 → 右上角菜单 →「添加到主屏幕」
- **iPhone**：Safari 打开页面 → 分享 →「添加到主屏幕」

> 手机上访问需要把文件部署到网上（见下），或在同一 WiFi 下用电脑 IP 访问。

## 免费部署（手机访问的前提）

任选其一，全部免费：

1. **GitHub Pages**：新建仓库 → 上传本文件夹全部文件 → Settings → Pages → 选 main 分支 → 得到 `https://用户名.github.io/仓库名/`
2. **Vercel / Netlify**：拖拽本文件夹到 vercel.com 或 netlify.com → 秒得网址

## 打包成 APK

**方式一：PWABuilder（推荐，零安装）**

1. 先按上文部署得到 https 网址
2. 打开 [pwabuilder.com](https://www.pwabuilder.com) → 输入网址 → Start
3. 进入「Android」→「Download Package」→ 得到 APK/AAB
4. APK 传到手机直接安装（AAB 用于上架应用商店）

**方式二：Bubblewrap（命令行，需 JDK 17 + Android SDK）**

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://你的网址/manifest.webmanifest
bubblewrap build   # 产出 app-release-signed.apk
```

## 说明

- 数据只存在本机浏览器里，卸载 App 或清浏览器数据前请先在「设置 → 导出备份」。
- **图标来自 Font Awesome 6.5.0 CDN（cdnjs.cloudflare.com）**：首次联网访问后 Service Worker 会把图标 CSS 和字体一起缓存，之后离线也能正常显示；若完全无网状态下首次打开，图标会暂时缺失，联网刷新一次即恢复。
- 如需云同步（Supabase），在 store.js 的 save() 里追加推送逻辑即可，数据结构已经是纯 JSON。
- 若以后要 Flutter 原生版，数据模型（store.js）和页面划分可 1:1 映射成 Dart 类。
