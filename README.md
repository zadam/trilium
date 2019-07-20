# Trilium Notes

[![Join the chat at https://gitter.im/trilium-notes/Lobby](https://badges.gitter.im/trilium-notes/Lobby.svg)](https://gitter.im/trilium-notes/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
Trilium Notes is a hierarchical note taking application with focus on building large personal knowledge bases. See [screenshots](https://github.com/zadam/trilium/wiki/Screenshot-tour) for quick overview:

![](https://raw.githubusercontent.com/wiki/zadam/trilium/images/screenshot.png)

## Features

* Notes can be arranged into arbitrarily deep tree. Single note can be placed into multiple places in the tree (see [cloning](https://github.com/zadam/trilium/wiki/Cloning-notes))
* Rich WYSIWYG note editing including e.g. tables and images with markdown [autoformat](https://github.com/zadam/trilium/wiki/Text-editor#autoformat)
* Support for editing [notes with source code](https://github.com/zadam/trilium/wiki/Code-notes), including syntax highlighting
* Fast and easy [navigation between notes](https://github.com/zadam/trilium/wiki/Note-navigation), full text search and [note hoisting](https://github.com/zadam/trilium/wiki/Note-hoisting)
* Seamless [note versioning](https://github.com/zadam/trilium/wiki/Note-revisions)
* Note [attributes](https://github.com/zadam/trilium/wiki/Attributes) can be used for note organization, querying and advanced [scripting](https://github.com/zadam/trilium/wiki/Scripts)
* [Synchronization](https://github.com/zadam/trilium/wiki/Synchronization) with self-hosted sync server
* Strong [note encryption](https://github.com/zadam/trilium/wiki/Protected-notes) with per-note granularity
* [Relation maps](https://github.com/zadam/trilium/wiki/Relation-map) and [link maps](https://github.com/zadam/trilium/wiki/Link-map) for visualizing notes and their relations
* [Scripting](https://github.com/zadam/trilium/wiki/Scripts) - see [Advanced showcases](https://github.com/zadam/trilium/wiki/Advanced-showcases)
* Scales well in both usability and performance upwards of 100 000 notes
* Touch optimized [mobile frontend](https://github.com/zadam/trilium/wiki/Mobile-frontend) for smartphones and tablets
* [Night theme](https://github.com/zadam/trilium/wiki/Themes)
* [Evernote](https://github.com/zadam/trilium/wiki/Evernote-import) and [Markdown import & export](https://github.com/zadam/trilium/wiki/Markdown)
* [Web Clipper](https://github.com/zadam/trilium/wiki/Web-clipper) for easy saving of web content

## Builds

Trilium is provided as either desktop application (Linux and Windows) or web application hosted on your server (Linux). Mac OS desktop build is available, but it is [unsupported](https://github.com/zadam/trilium/wiki/FAQ#mac-os-support).

* If you want to use Trilium on the desktop, download binary release for your platform from [latest release](https://github.com/zadam/trilium/releases/latest), unzip the package and run ```trilium``` executable.
* If you want to install Trilium on server, follow [this page](https://github.com/zadam/trilium/wiki/Server-installation).
  * Currently only recent Chrome and Firefox are supported (tested) browsers.

## Documentation

[See wiki for complete list of documentation pages.](https://github.com/zadam/trilium/wiki/)

You can also read [Patterns of personal knowledge base](https://github.com/zadam/trilium/wiki/Patterns-of-personal-knowledge-base) to get some inspiration on how you might use Trilium.

## Contribute

Use a browser based dev environment

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/zadam/trilium)

Or clone locally and run
```
npm install
npm run start
```