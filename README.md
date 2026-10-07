# 记账本（PWA 版）v1.5.3

一款简洁的多账户记账 PWA，采用纯 HTML、CSS 和 JavaScript 开发。支持离线使用，可安装到手机或电脑桌面，所有账目默认保存在本机。

## 主要功能

- 记录支出、收入、转账和 AA 分账
- 管理微信、支付宝、银行卡等多个账户
- 修改记录的账户、分类、日期和备注
- 查看全部账单，并搜索分类、账户、备注、金额或日期
- 按类型、月份和账户组合筛选账单
- 查看月度汇总、支出构成和收支趋势
- 添加、编辑、排序和归档账户
- 添加、编辑、排序和删除分类
- 使用内置计算器快速计算金额
- 支持深色模式和自定义昵称
- 支持 JSON 数据导入与导出
- 支持离线访问和桌面安装

## 数据说明

账目使用浏览器 `localStorage` 保存在当前设备，不会自动上传到服务器。

请注意：

- 清除浏览器数据可能会删除全部账目。
- 卸载应用或更换设备前，请先到“设置 → 导出备份”。
- 导入备份前会校验数据，并自动保留当前账本备份。
- 有历史记录的账户会被安全归档，不会直接删除。

## 本地运行

PWA 必须通过 HTTP 或 HTTPS 打开，不能直接双击 `index.html`。

### Windows 快速启动

双击 `启动记账本.bat`，浏览器会自动打开本地记账本。关闭命令窗口即可停止服务。

### 手动启动

如果电脑安装了 Python，可在项目目录运行：

```bash
python -m http.server 8765
```

然后访问 `http://localhost:8765/`。

## 部署到 GitHub Pages

1. 在 GitHub 新建一个仓库。
2. 上传项目运行所需文件。
3. 打开仓库的 `Settings → Pages`。
4. 在 `Build and deployment` 中选择从 `main` 分支部署。
5. 等待 GitHub 生成 HTTPS 地址。

需要上传：

```text
index.html
manifest.webmanifest
sw.js
README.md
css/
js/
icons/
vendor/
```

以下内容不影响线上运行，可以不上传：

```text
tests/
启动记账本.bat
改版本号.bat
bump.js
icons/make_icons.py
CHANGELOG.md
```

不要上传 `.edge-icon-profile`。

## 安装到桌面

- **安卓**：使用 Chrome 打开部署后的 HTTPS 地址，点击右上角菜单中的“安装应用”。
- **iPhone 或 iPad**：使用 Safari 打开网站，点击“分享 → 添加到主屏幕”。
- **Windows 或 macOS**：使用 Chrome 或 Edge 打开网站，通过地址栏安装图标或浏览器菜单安装。

> 如果只能看到“创建快捷方式”，通常是因为页面通过 `file://` 或普通局域网 HTTP 地址打开。请使用 HTTPS 网站或本机 `localhost`。

## 项目结构

```text
account-app/
├─ index.html                 应用入口
├─ manifest.webmanifest       PWA 配置
├─ sw.js                      离线缓存
├─ css/
│  └─ styles.css              页面样式与主题
├─ js/
│  ├─ app.js                  页面与交互逻辑
│  ├─ store.js                数据存储与账务计算
│  └─ charts.js               统计图表
├─ icons/                     应用及红包 SVG 图标
├─ vendor/fontawesome/        本地图标字体
└─ tests/                     自动检查
```

## 离线资源

Font Awesome Free 6.5.0 已保存在 `vendor/fontawesome/` 中，因此首次加载完成后，无网时仍可正常显示图标。许可证位于 `vendor/fontawesome/LICENSE.txt`。

## 更新版本

修改代码后，可运行：

```bash
node bump.js 1.5.4
```

Windows 用户也可以双击 `改版本号.bat`。该工具会同步更新应用版本、静态资源版本和 Service Worker 缓存名。

完整版本记录请查看 [CHANGELOG.md](CHANGELOG.md)。

## 打包为 APK

最简单的方法是使用 [PWABuilder](https://www.pwabuilder.com/)：

1. 先将项目部署为 HTTPS 网站。
2. 在 PWABuilder 输入网站地址。
3. 选择 Android。
4. 下载生成的 APK 或 AAB。

## 技术特点

- 零前端框架和运行时依赖
- 响应式移动端界面
- Service Worker 离线缓存
- PWA 安装支持
- 本地 JSON 数据结构
- 本地化 Font Awesome 图标资源
