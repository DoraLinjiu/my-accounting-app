# Dora 记账（PWA 版）

大学生多账户记账 App：零依赖、纯离线、可「添加到主屏幕」，也可一键打包成 APK。

## 功能清单

| 模块 | 功能 |
|------|------|
| 多账户 | 微信零钱 / 微信零钱通 / 支付宝零钱 / 余额宝 / 工商银行 / 建设银行，显示实时余额，支持账户互转、添加账户、改名、校准余额 |
| 快速记账 | 支出/收入/转账/AA 四种类型，账户 + 分类 + 金额 + 备注 + 日期；预设 餐饮/桶装水/交通/购物/娱乐/房租/其他 |
| AA 分账 | 输入总金额和人数，自动算每人份额，只把自己那份记进账本；内置「桶装水」「聚餐」一键场景 |
| 统计视图 | 按日/周/月/年切换，环形图（支出构成）+ 柱状图（收支趋势）+ 收支结余汇总 |
| 内置计算器 | 记账时点金额框弹出，支持 + - × ÷ %，实时预览结果 |
| 拖拽排序 | 账户列表、分类列表按住 ≡ 拖拽调整顺序（触屏/鼠标通用） |
| 本地存储 | localStorage 持久化，离线可用；支持 JSON 导出/导入备份 |
| 外观 | 马卡龙四色 #FFB3BA #BAE1FF #BAFFC9 #FFFFBA，卡片圆角 18px，深色模式 |

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
- 如需云同步（Supabase），在 store.js 的 save() 里追加推送逻辑即可，数据结构已经是纯 JSON。
- 若以后要 Flutter 原生版，数据模型（store.js）和页面划分可 1:1 映射成 Dart 类。
