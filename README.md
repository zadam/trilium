# Trilium Notes

## Trilium is in maintenance mode - see details in https://github.com/zadam/trilium/issues/4620

Preliminary disccusions on the successor organization are taking place in [Trilium Next discussions](https://github.com/orgs/TriliumNext/discussions). 

[![Join the chat at https://gitter.im/trilium-notes/Lobby](https://badges.gitter.im/trilium-notes/Lobby.svg)](https://gitter.im/trilium-notes/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) [English](https://github.com/zadam/trilium/blob/master/README.md) | [Chinese](https://github.com/zadam/trilium/blob/master/README-ZH_CN.md) | [Russian](https://github.com/zadam/trilium/blob/master/README.ru.md) | [Japanese](https://github.com/zadam/trilium/blob/master/README.ja.md)

Trilium Notes is a hierarchical note taking application with focus on building large personal knowledge bases. 

See [screenshots](https://github.com/zadam/trilium/wiki/Screenshot-tour) for quick overview:

<a href="https://github.com/zadam/trilium/wiki/Screenshot-tour"><img src="https://raw.githubusercontent.com/wiki/zadam/trilium/images/screenshot.png" alt="Trilium Screenshot" width="1000"></a>

Ukraine is currently defending itself from Russian aggression, please consider [donating to Ukrainian Army or humanitarian charities](https://standforukraine.com/).

<p float="left">
  <img src="https://upload.wikimedia.org/wikipedia/commons/4/49/Flag_of_Ukraine.svg" alt="drawing" width="400"/>
  <img src="https://signmyrocket.com//uploads/2b2a523cd0c0e76cdbba95a89a9636b2_1676971281.jpg" alt="Trilium Notes supports Ukraine!" width="570"/>
</p>

## 🎁 Features

* Notes can be arranged into arbitrarily deep tree. Single note can be placed into multiple places in the tree (see [cloning](https://github.com/zadam/trilium/wiki/Cloning-notes))
* Rich WYSIWYG note editing including e.g. tables, images and [math](https://github.com/zadam/trilium/wiki/Text-notes#math-support) with markdown [autoformat](https://github.com/zadam/trilium/wiki/Text-notes#autoformat)
* Support for editing [notes with source code](https://github.com/zadam/trilium/wiki/Code-notes), including syntax highlighting
* Fast and easy [navigation between notes](https://github.com/zadam/trilium/wiki/Note-navigation), full text search and [note hoisting](https://github.com/zadam/trilium/wiki/Note-hoisting)
* Seamless [note versioning](https://github.com/zadam/trilium/wiki/Note-revisions)
* Note [attributes](https://github.com/zadam/trilium/wiki/Attributes) can be used for note organization, querying and advanced [scripting](https://github.com/zadam/trilium/wiki/Scripts)
* [Synchronization](https://github.com/zadam/trilium/wiki/Synchronization) with self-hosted sync server
  * there's a [3rd party service for hosting synchronisation server](https://trilium.cc/paid-hosting)
* [Sharing](https://github.com/zadam/trilium/wiki/Sharing) (publishing) notes to public internet
* Strong [note encryption](https://github.com/zadam/trilium/wiki/Protected-notes) with per-note granularity
* Sketching diagrams with built-in Excalidraw (note type "canvas")
* [Relation maps](https://github.com/zadam/trilium/wiki/Relation-map) and [link maps](https://github.com/zadam/trilium/wiki/Link-map) for visualizing notes and their relations
* [Scripting](https://github.com/zadam/trilium/wiki/Scripts) - see [Advanced showcases](https://github.com/zadam/trilium/wiki/Advanced-showcases)
* [REST API](https://github.com/zadam/trilium/wiki/ETAPI) for automation
* Scales well in both usability and performance upwards of 100 000 notes
* Touch optimized [mobile frontend](https://github.com/zadam/trilium/wiki/Mobile-frontend) for smartphones and tablets
* [Night theme](https://github.com/zadam/trilium/wiki/Themes)
* [Evernote](https://github.com/zadam/trilium/wiki/Evernote-import) and [Markdown import & export](https://github.com/zadam/trilium/wiki/Markdown)
* [Web Clipper](https://github.com/zadam/trilium/wiki/Web-clipper) for easy saving of web content

Check out [awesome-trilium](https://github.com/Nriver/awesome-trilium) for 3rd party themes, scripts, plugins and more.

## 🏗 Builds

Trilium is provided as either desktop application (Linux and Windows) or web application hosted on your server (Linux). Mac OS desktop build is available, but it is [unsupported](https://github.com/zadam/trilium/wiki/FAQ#mac-os-support).

* If you want to use Trilium on the desktop, download binary release for your platform from [latest release](https://github.com/zadam/trilium/releases/latest), unzip the package and run ```trilium``` executable.
* If you want to install Trilium on server, follow [this page](https://github.com/zadam/trilium/wiki/Server-installation).
  * Currently only recent Chrome and Firefox are supported (tested) browsers.

Trilium is also provided as a Flatpak:

[<img width="240" src="https://flathub.org/assets/badges/flathub-badge-en.png">](https://flathub.org/apps/details/com.github.zadam.trilium)

## 📝 Documentation

[See wiki for complete list of documentation pages.](https://github.com/zadam/trilium/wiki/)

You can also read [Patterns of personal knowledge base](https://github.com/zadam/trilium/wiki/Patterns-of-personal-knowledge-base) to get some inspiration on how you might use Trilium.

## 💻 Contribute

Use a browser based dev environment

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/zadam/trilium)

Or clone locally and run
```
npm install
npm run start-server
```

## 📢 Shoutouts

* [CKEditor 5](https://github.com/ckeditor/ckeditor5) - best WYSIWYG editor on the market, very interactive and listening team
* [FancyTree](https://github.com/mar10/fancytree) - very feature rich tree library without real competition. Trilium Notes would not be the same without it.
* [CodeMirror](https://github.com/codemirror/CodeMirror) - code editor with support for huge amount of languages
* [jsPlumb](https://github.com/jsplumb/jsplumb) - visual connectivity library without competition. Used in [relation maps](https://github.com/zadam/trilium/wiki/Relation-map) and [link maps](https://github.com/zadam/trilium/wiki/Link-map)

## 🤝 Support

You can support Trilium using GitHub Sponsors, [PayPal](https://paypal.me/za4am) or Bitcoin (bitcoin:bc1qv3svjn40v89mnkre5vyvs2xw6y8phaltl385d2).

## 🔑 License

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
