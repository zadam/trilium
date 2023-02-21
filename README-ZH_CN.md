# Trilium Notes

[English](https://github.com/zadam/trilium/blob/master/README.md) | [Chinese](https://github.com/zadam/trilium/blob/master/README-ZH_CN.md) | [Russian](https://github.com/zadam/trilium/blob/master/README.ru.md)

[![Join the chat at https://gitter.im/trilium-notes/Lobby](https://badges.gitter.im/trilium-notes/Lobby.svg)](https://gitter.im/trilium-notes/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
Trilium Notes 是一个层次化的笔记应用程序，专注于建立大型个人知识库。请参阅[屏幕截图](https://github.com/zadam/trilium/wiki/Screenshot-tour)以快速了解：

![](https://raw.githubusercontent.com/wiki/zadam/trilium/images/screenshot.png)

Ukraine is currently suffering from Russian aggression, please consider donating to [one of these charities](https://old.reddit.com/r/ukraine/comments/s6g5un/want_to_support_ukraine_heres_a_list_of_charities/).

<img src="https://upload.wikimedia.org/wikipedia/commons/4/49/Flag_of_Ukraine.svg" alt="drawing" width="600"/>
<img src="https://signmyrocket.com//uploads/2b2a523cd0c0e76cdbba95a89a9636b2_1676971281.jpg" alt="Trilium Notes supports Ukraine!" width="600"/>

## 特性

* 笔记可以排列成任意深的树。单个笔记可以放在树中的多个位置（请参阅[克隆](https://github.com/zadam/trilium/wiki/Cloning-notes)）
* 丰富的所见即所得笔记编辑功能，包括带有 Markdown [自动格式化功能的](https://github.com/zadam/trilium/wiki/Text-notes#autoformat)表格，图像和[数学](https://github.com/zadam/trilium/wiki/Text-notes#math-support)
* 支持编辑[使用源代码的笔记](https://github.com/zadam/trilium/wiki/Code-notes)，包括语法高亮显示
* 笔记之间快速[导航](https://github.com/zadam/trilium/wiki/Note-navigation)，全文搜索和[笔记聚焦](https://github.com/zadam/trilium/wiki/Note-hoisting)
* 无缝[笔记版本控制](https://github.com/zadam/trilium/wiki/Note-revisions)
* 笔记[属性](https://github.com/zadam/trilium/wiki/Attributes)可用于笔记组织，查询和高级[脚本编写](https://github.com/zadam/trilium/wiki/Scripts)
* [同步](https://github.com/zadam/trilium/wiki/Synchronization)与自托管同步服务器
  * 有一个[第三方提供的同步服务器托管服务](https://trilium.cc/paid-hosting)
* 公开地[分享](https://github.com/zadam/trilium/wiki/Sharing)（发布）笔记到互联网
* 具有按笔记粒度的强大的[笔记加密](https://github.com/zadam/trilium/wiki/Protected-notes)
* 使用自带的 Excalidraw 来绘制图表（笔记类型“画布”）
* [关系图](https://github.com/zadam/trilium/wiki/Relation-map)和[链接图](https://github.com/zadam/trilium/wiki/Link-map)，用于可视化笔记及其关系
* [脚本](https://github.com/zadam/trilium/wiki/Scripts) - 请参阅[高级功能展示](https://github.com/zadam/trilium/wiki/Advanced-showcases)
* 在拥有超过 10 万条笔记时仍能保持良好的可用性和性能
* 针对智能手机和平板电脑进行优化的[用于移动设备的前端](https://github.com/zadam/trilium/wiki/Mobile-frontend)
* [夜间主题](https://github.com/zadam/trilium/wiki/Themes)
* [Evernote](https://github.com/zadam/trilium/wiki/Evernote-import) 和 [Markdown 导入导出](https://github.com/zadam/trilium/wiki/Markdown)功能
* 使用[网页剪藏](https://github.com/zadam/trilium/wiki/Web-clipper)轻松保存互联网上的内容

## 构建

Trilium 可以用作桌面应用程序（Linux 和 Windows）或服务器（Linux）上托管的 Web 应用程序。虽然有 macOS 版本的桌面应用程序，但它[不受支持](https://github.com/zadam/trilium/wiki/FAQ#mac-os-support)。

* 如果要在桌面上使用 Trilium，请从[最新版本](https://github.com/zadam/trilium/releases/latest)下载适用于您平台的二进制版本，解压缩该软件包并运行`trilium`可执行文件。
* 如果要在服务器上安装 Trilium，请参考[此页面](https://github.com/zadam/trilium/wiki/Server-installation)。
  * 当前仅支持（测试过）最近发布的 Chrome 和 Firefox 浏览器。

Trilium 也提供 Flatpak：

[<img width="240" src="https://flathub.org/assets/badges/flathub-badge-en.png">](https://flathub.org/apps/details/com.github.zadam.trilium)

## 文档

[有关文档页面的完整列表，请参见 Wiki。](https://github.com/zadam/trilium/wiki/)

* [Wiki 的中文翻译版本](https://github.com/baddate/trilium/wiki/)

您还可以阅读[个人知识库模式](https://github.com/zadam/trilium/wiki/Patterns-of-personal-knowledge-base)，以获取有关如何使用 Trilium 的灵感。

## 贡献

使用基于浏览器的开发环境

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/zadam/trilium)

或者克隆本仓库到本地，并运行

```
npm install
npm run start-server
```

## 致谢

* [CKEditor 5](https://github.com/ckeditor/ckeditor5) - 市面上最好的所见即所得编辑器，拥有互动性强且聆听能力强的团队
* [FancyTree](https://github.com/mar10/fancytree) - 一个非常丰富的关于树的库，强大到没有对手。没有它，Trilium Notes 将不会如此。
* [CodeMirror](https://github.com/codemirror/CodeMirror) - 支持大量语言的代码编辑器
* [jsPlumb](https://github.com/jsplumb/jsplumb) - 强大的可视化连接库。用于[关系图](https://github.com/zadam/trilium/wiki/Relation-map)和[链接图](https://github.com/zadam/trilium/wiki/Link-map)

## 捐赠

你可以通过 GitHub Sponsors，[PayPal](https://paypal.me/za4am) 或者比特币 (bitcoin:bc1qv3svjn40v89mnkre5vyvs2xw6y8phaltl385d2) 来捐赠。

## 许可证

本程序是自由软件：你可以再发布本软件和/或修改本软件，只要你遵循 Free Software Foundation 发布的 GNU Affero General Public License 的第三版或者任何（由你选择）更晚的版本。
