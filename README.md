## Getting Started

Follow these instructions to run project locally.

### Prerequisites

Follow these commands to run project successfully.

-   npm

    ```sh
    npm install npm@latest -g
    ```

    -   or install yarn

### Installation

1. Clone the repo

    ```sh
    git clone https://github.com/magnusmage/magescribe.git
    ```

2. Install packages in root directory

    ```sh
    npm install
    npm run start-server
    ```

3. All done :smile::smile:

## 🎁 Features

-   Notes can be arranged into arbitrarily deep tree. Single note can be placed into multiple places in the tree (see [cloning](https://github.com/zadam/trilium/wiki/Cloning-notes))
-   Rich WYSIWYG note editing including e.g. tables, images and [math](https://github.com/zadam/trilium/wiki/Text-notes#math-support) with markdown [autoformat](https://github.com/zadam/trilium/wiki/Text-notes#autoformat)
-   Support for editing [notes with source code](https://github.com/zadam/trilium/wiki/Code-notes), including syntax highlighting
-   Fast and easy [navigation between notes](https://github.com/zadam/trilium/wiki/Note-navigation), full text search and [note hoisting](https://github.com/zadam/trilium/wiki/Note-hoisting)
-   Seamless [note versioning](https://github.com/zadam/trilium/wiki/Note-revisions)
-   Note [attributes](https://github.com/zadam/trilium/wiki/Attributes) can be used for note organization, querying and advanced [scripting](https://github.com/zadam/trilium/wiki/Scripts)
-   [Synchronization](https://github.com/zadam/trilium/wiki/Synchronization) with self-hosted sync server
    -   there's a [3rd party service for hosting synchronisation server](https://trilium.cc/paid-hosting)
-   [Sharing](https://github.com/zadam/trilium/wiki/Sharing) (publishing) notes to public internet
-   Strong [note encryption](https://github.com/zadam/trilium/wiki/Protected-notes) with per-note granularity
-   Sketching diagrams with built-in Excalidraw (note type "canvas")
-   [Relation maps](https://github.com/zadam/trilium/wiki/Relation-map) and [link maps](https://github.com/zadam/trilium/wiki/Link-map) for visualizing notes and their relations
-   [Scripting](https://github.com/zadam/trilium/wiki/Scripts) - see [Advanced showcases](https://github.com/zadam/trilium/wiki/Advanced-showcases)
-   [REST API](https://github.com/zadam/trilium/wiki/ETAPI) for automation
-   Scales well in both usability and performance upwards of 100 000 notes
-   Touch optimized [mobile frontend](https://github.com/zadam/trilium/wiki/Mobile-frontend) for smartphones and tablets
-   [Night theme](https://github.com/zadam/trilium/wiki/Themes)
-   [Evernote](https://github.com/zadam/trilium/wiki/Evernote-import) and [Markdown import & export](https://github.com/zadam/trilium/wiki/Markdown)
-   [Web Clipper](https://github.com/zadam/trilium/wiki/Web-clipper) for easy saving of web content

Check out [awesome-magescribe](https://github.com/Nriver/awesome-trilium) for 3rd party themes, scripts, plugins and more.

## 🏗 Builds

Magescribe is provided as either desktop application (Linux and Windows) or web application hosted on your server (Linux). Mac OS desktop build is available, but it is [unsupported](https://github.com/zadam/trilium/wiki/FAQ#mac-os-support).

-   If you want to use magescribe on the desktop, download binary release for your platform from [latest release](https://github.com/zadam/trilium/releases/latest), unzip the package and run `magescribe` executable.
-   If you want to install Magescribe on server, follow [this page](https://github.com/zadam/trilium/wiki/Server-installation).
    -   Currently only recent Chrome and Firefox are supported (tested) browsers.

Magescribe is also provided as a Flatpak:

[<img width="240" src="https://flathub.org/assets/badges/flathub-badge-en.png">](https://flathub.org/apps/details/com.github.zadam.trilium)

<!-- USAGE  -->

## Usage

For additional usage read docs.

## Contributing

For contributions **greatly appreciated**.

1. Clone the Project
2. Create your Feature Branch (`git checkout -b feature/NewFeature`)
3. Commit your Changes (`git commit -m 'Add: NewFeature'`)
4. Push to the Branch (`git push origin feature/NewFeature`)
5. Open a Pull Request

<!-- Commit -->

## How to commit

For commit use prefixes in commit messages to provide context and clarity about the changes made to the code. This convention involves using short, descriptive prefixes such as

-   `Add:` for new features
-   `Update:` for modifications to existing functionality
-   `Improvement:` for code improvements
-   `Fix:` for bug fixes
-   `Integration:` for integration
-   `Remove:` for deleting code or features
-   `Docs:` for documentation updates

By following a consistent commit message convention, developers can efficiently track changes to the code and easily understand the navigate of modifications made over time.

<!-- LICENSE -->

## License

Distributed under the MIT License. See `LICENSE` for more information.

<!-- CONTACT -->

## Contact

[https://magnusmage.com/](https://github.com/magnusmage/magescribe.git)

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

```
Copyright © 2023 — https://magnusmage.com/
```
