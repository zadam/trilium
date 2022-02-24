# Trilium笔记

[English](https://github.com/zadam/trilium/blob/master/README.md) | [Chinese](https://github.com/zadam/trilium/blob/master/README-ZH_CN.md) | [Russian](https://github.com/zadam/trilium/blob/master/README.ru.md)

[![Join the chat at https://gitter.im/trilium-notes/Lobby](https://badges.gitter.im/trilium-notes/Lobby.svg)](https://gitter.im/trilium-notes/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
Trilium Notes是一个分层的笔记应用程序，专注于建立大型个人知识库。请参阅[屏幕截图](https://github.com/zadam/trilium/wiki/Screenshot-tour)以快速了解：

![](https://raw.githubusercontent.com/wiki/zadam/trilium/images/screenshot.png)

Ukraine is currently suffering from Russian aggression, please consider donating to [one of these charities](https://old.reddit.com/r/ukraine/comments/s6g5un/want_to_support_ukraine_heres_a_list_of_charities/).

<img src="https://upload.wikimedia.org/wikipedia/commons/4/49/Flag_of_Ukraine.svg" alt="drawing" width="600"/>

## 特性

* 笔记可以排列成任意深的树。单个笔记可以放在树中的多个位置（请参阅[克隆](https://github.com/zadam/trilium/wiki/Cloning-notes)）
* 丰富的所见即所得笔记编辑功能，包括带有markdown[自动格式化功能的](https://github.com/zadam/trilium/wiki/Text-notes#autoformat)表格，图像和[数学](https://github.com/zadam/trilium/wiki/Text-notes#math-support)
* 支持编辑[使用源代码的笔记](https://github.com/zadam/trilium/wiki/Code-notes)，包括语法高亮显示
* 笔记之间快速[导航](https://github.com/zadam/trilium/wiki/Note-navigation)，全文搜索和[笔记挂起](https://github.com/zadam/trilium/wiki/Note-hoisting)
* 无缝[笔记版本控制](https://github.com/zadam/trilium/wiki/Note-revisions)
* 笔记[属性](https://github.com/zadam/trilium/wiki/Attributes)可用于笔记组织，查询和高级[脚本编写](https://github.com/zadam/trilium/wiki/Scripts)
* [同步](https://github.com/zadam/trilium/wiki/Synchronization)与自托管同步服务器
* 具有按笔记粒度的强大的[笔记加密](https://github.com/zadam/trilium/wiki/Protected-notes)
* [关系图](https://github.com/zadam/trilium/wiki/Relation-map)和[链接图](https://github.com/zadam/trilium/wiki/Link-map)，用于可视化笔记及其关系
* [脚本](https://github.com/zadam/trilium/wiki/Scripts)-请参阅[高级展示](https://github.com/zadam/trilium/wiki/Advanced-showcases)
* 可用性和性能均能很好地扩展至超过10万个笔记
* 针对智能手机和平板电脑进行触摸优化的[移动前端](https://github.com/zadam/trilium/wiki/Mobile-frontend)
* [夜间主题](https://github.com/zadam/trilium/wiki/Themes)
* [Evernote](https://github.com/zadam/trilium/wiki/Evernote-import)和[Markdown导入导出](https://github.com/zadam/trilium/wiki/Markdown)
* [Web Clipper](https://github.com/zadam/trilium/wiki/Web-clipper)可轻松保存Web内容

## 构建

Trilium是作为桌面应用程序（Linux和Windows）或服务器上托管的Web应用程序（Linux）提供的。Mac OS桌面版本可用，但[不受支持](https://github.com/zadam/trilium/wiki/FAQ#mac-os-support)。

* 如果要在桌面上使用Trilium，请从[最新版本](https://github.com/zadam/trilium/releases/latest)下载适用于您平台的二进制[版本](https://github.com/zadam/trilium/releases/latest)，解压缩该软件包并运行`trilium`可执行文件。
* 如果要在服务器上安装Trilium，请遵循[此页面](https://github.com/zadam/trilium/wiki/Server-installation)。
    * 当前仅支持（经过测试）最新的Chrome和Firefox浏览器。

## 文档

[有关文档页面的完整列表，请参见Wiki。](https://github.com/zadam/trilium/wiki/)

[中文Wiki在这里](https://github.com/baddate/trilium/wiki/)

您还可以阅读[个人知识库模式](https://github.com/zadam/trilium/wiki/Patterns-of-personal-knowledge-base)，以获取有关如何使用Trilium的灵感。

## 贡献

使用基于浏览器的开发环境

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/zadam/trilium)

或在本地克隆并运行

```
npm install
npm run start-server
```

## 致谢

* [CKEditor 5](https://github.com/ckeditor/ckeditor5) - 市场上最好的所见即所得编辑器，互动性强且聆听能力强的团队
* [FancyTree](https://github.com/mar10/fancytree) - 一个非常丰富的关于树的库，强大的没有对手。没有它，Trilium Notes将不会如此。
* [CodeMirror](https://github.com/codemirror/CodeMirror) - 支持大量语言的代码编辑器
* [jsPlumb](https://github.com/jsplumb/jsplumb)强大的可视化连接库。- 用于[关系图](https://github.com/zadam/trilium/wiki/Relation-map)和[链接图](https://github.com/zadam/trilium/wiki/Link-map)
