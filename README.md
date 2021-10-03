# DANGER
This is a **very experimental** fork of trilium with added syntax highlighting for code blocks.
Use at your own risk in a safe environment! It might corrupt your notes so be cautious.
---
The highlighting is done using `highlight.js` and is implemented using the [CKEditor5-CodeBlock-With-Syntax-Highlight](https://github.com/regischen/CKEditor5-CodeBlock-With-Syntax-Highlight) plugin (created by regischen).

## Usage:
The repository contains a `build.sh` script that automatically downloads the requirements and builds syntax highlighting into the latest trilium source. Every other file in the repo is part of an already integrated version that has some example languages enabled for code blocks. The included demo version can be ran from the `trilium` directory using the `npm run start-server` command. The other way of getting a working build is by running the `build.sh` .

### Install from source
- Clone this repository
- Run the `build.sh` script

### "Install" / Run the demo
- Clone this repository
- `cd trilium` && `npm run start-server`

## Adding new languages to the code-blocks dropdown
Adding a new language essentially consists of "fixing" the mime type definition within trilium's source code. This fix is needed because the mime type returned by the code-block function differs from the required ones from highlight.js.
Adding / fixing a language can be done fairly easily using `sed`. The following command is an example that will make the `python` language compatible with code-blocks:
- `grep -rl "text/x-python" ./trilium | xargs sed -i "s+text\/x-python+python+g"`

What this does is simply looks up every occurrence of `text/x-python` (the mime definition of python used by trilium) and replaces it with the string `python`. This allows the highlighter plugin to correcly receive the mime type when creating a code-block and as such does not crash the application.

# Included code-block languages in this demo repository
- plaintext, c, python and php

# Issues:
- Creating code-blocks with non-supported languages will kill Trilium.
- Opening notes with unsupported code-blocks will kill Trilium.
- In reading mode the highlighting is not applied correctly.

# Screenshot Example:
![Python Syntax Highlighting](/Untitled2.png)
![Python Syntax Highlighting dark theme](/dark_example.png)

# Overall description of how this thing works
The overall process of adding syntax highlighting to trilium is as follows:
- Download trilium-ckeditor5, trilium, and the ckeditor5-code-block plugin
- Combine ckeditor5-code-block and trilium-ckeditor5, replacing the original codeblock src
- Combine the new custom trilium-ckeditor5 with trilium (swap out the default ckeditor)
- Parse trough every file in the trilium source code and make the correct modifications for any language you want to use and replace `text/x-language` with the correct alias of the language from the [highlight.js supported languages](https://github.com/highlightjs/highlight.js/blob/main/SUPPORTED_LANGUAGES.md) list
# Trilium Notes

[English](https://github.com/zadam/trilium/blob/master/README.md) | [Chinese](https://github.com/zadam/trilium/blob/master/README-ZH_CN.md) | [Russian](https://github.com/zadam/trilium/blob/master/README.ru.md)

[![Join the chat at https://gitter.im/trilium-notes/Lobby](https://badges.gitter.im/trilium-notes/Lobby.svg)](https://gitter.im/trilium-notes/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
Trilium Notes is a hierarchical note taking application with focus on building large personal knowledge bases. See [screenshots](https://github.com/zadam/trilium/wiki/Screenshot-tour) for quick overview:

![](https://raw.githubusercontent.com/wiki/zadam/trilium/images/screenshot.png)

## Features

* Notes can be arranged into arbitrarily deep tree. Single note can be placed into multiple places in the tree (see [cloning](https://github.com/zadam/trilium/wiki/Cloning-notes))
* Rich WYSIWYG note editing including e.g. tables, images and [math](https://github.com/zadam/trilium/wiki/Text-notes#math-support) with markdown [autoformat](https://github.com/zadam/trilium/wiki/Text-notes#autoformat)
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
npm run start-server
```

## Shoutouts

* [CKEditor 5](https://github.com/ckeditor/ckeditor5) - best WYSIWYG editor on the market, very interactive and listening team
* [FancyTree](https://github.com/mar10/fancytree) - very feature rich tree library without real competition. Trilium Notes would not be the same without it.
* [CodeMirror](https://github.com/codemirror/CodeMirror) - code editor with support for huge amount of languages
* [jsPlumb](https://github.com/jsplumb/jsplumb) - visual connectivity library without competition. Used in [relation maps](https://github.com/zadam/trilium/wiki/Relation-map) and [link maps](https://github.com/zadam/trilium/wiki/Link-map)

## License

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
