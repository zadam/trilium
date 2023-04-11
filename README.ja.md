# Trilium Notes

[English](https://github.com/zadam/trilium/blob/master/README.md) | [Chinese](https://github.com/zadam/trilium/blob/master/README-ZH_CN.md) | [Russian](https://github.com/zadam/trilium/blob/master/README.ru.md) | [Japanese](https://github.com/zadam/trilium/blob/master/README.ja.md)

Trilium Notes は、大規模な個人知識ベースの構築に焦点を当てた、階層型ノートアプリケーションです。概要は[スクリーンショット](https://github.com/zadam/trilium/wiki/Screenshot-tour)をご覧ください：

<a href="https://github.com/zadam/trilium/wiki/Screenshot-tour"><img src="https://raw.githubusercontent.com/wiki/zadam/trilium/images/screenshot.png" alt="Trilium Screenshot" width="1000"></a>

ウクライナは現在、ロシアの侵略から自国を守っています。[ウクライナ軍や人道的な慈善団体への寄付](https://standforukraine.com/)をご検討ください。

<p float="left">
  <img src="https://upload.wikimedia.org/wikipedia/commons/4/49/Flag_of_Ukraine.svg" alt="drawing" width="400"/>
  <img src="https://signmyrocket.com//uploads/2b2a523cd0c0e76cdbba95a89a9636b2_1676971281.jpg" alt="Trilium Notes supports Ukraine!" width="570"/>
</p>

## 🎁 特徴

* ノートは、任意の深さのツリーに配置できます。単一のノートをツリー内の複数の場所に配置できます ([cloning](https://github.com/zadam/trilium/wiki/Cloning-notes) を参照)
* マークダウン[オートフォーマット](https://github.com/zadam/trilium/wiki/Text-notes#autoformat)による、表、画像、[数学](https://github.com/zadam/trilium/wiki/Text-notes#math-support)などの豊富な WYSIWYG ノート編集機能
* シンタックスハイライトを含む[ソースコード付きノート](https://github.com/zadam/trilium/wiki/Code-notes)の編集をサポート
* [ノート間のナビゲーション](https://github.com/zadam/trilium/wiki/Note-navigation)、全文検索、[ノートホイスト](https://github.com/zadam/trilium/wiki/Note-hoisting)が高速かつ簡単に行えます
* シームレスな[ノートのバージョン管理](https://github.com/zadam/trilium/wiki/Note-revisions)
* ノート[属性](https://github.com/zadam/trilium/wiki/Attributes)は、ノート整理、クエリ、高度な[スクリプト](https://github.com/zadam/trilium/wiki/Scripts)に使用できます
* 自己ホスト型同期サーバーとの[同期](https://github.com/zadam/trilium/wiki/Synchronization)
  * [同期サーバーをホストするサードパーティ・サービス](https://trilium.cc/paid-hosting)があります
* 公開インターネットへのノートの[共有](https://github.com/zadam/trilium/wiki/Sharing)(公開)
* ノートごとの粒度を持つ強力な[ノート暗号化](https://github.com/zadam/trilium/wiki/Protected-notes)
* 組み込みの Excalidraw を使用した図のスケッチ (ノート タイプ"キャンバス")
* ノートとその関係を可視化するための[関係図](https://github.com/zadam/trilium/wiki/Relation-map)と[リンクマップ](https://github.com/zadam/trilium/wiki/Link-map)
* [スクリプティング](https://github.com/zadam/trilium/wiki/Scripts) - [高度なショーケース](https://github.com/zadam/trilium/wiki/Advanced-showcases)を参照
* 自動化のための [REST API](https://github.com/zadam/trilium/wiki/ETAPI)
* ユーザビリティとパフォーマンスの両方で 100 000 ノート以上に拡張可能
* スマートフォンとタブレット向けのタッチ最適化[モバイルフロントエンド](https://github.com/zadam/trilium/wiki/Mobile-frontend)
* [ナイトテーマ](https://github.com/zadam/trilium/wiki/Themes)
* [Evernote](https://github.com/zadam/trilium/wiki/Evernote-import) と [Markdown のインポートとエクスポート](https://github.com/zadam/trilium/wiki/Markdown)
* Web コンテンツを簡単に保存するための [Web クリッパー](https://github.com/zadam/trilium/wiki/Web-clipper)

サードパーティのテーマ、スクリプト、プラグインなどは、 [awesome-trilium](https://github.com/Nriver/awesome-trilium) をチェックしてください。

## 🏗 ビルド

Trilium は、デスクトップアプリケーション（Linux、Windows）またはサーバー上でホストされるウェブアプリケーション（Linux）として提供されます。 Mac OS のデスクトップビルドも利用可能ですが、 [unsupported](https://github.com/zadam/trilium/wiki/FAQ#mac-os-support) となっています。

* デスクトップで Trilium を使用したい場合は、 [latest release](https://github.com/zadam/trilium/releases/latest) からお使いのプラットフォームのバイナリリリースをダウンロードし、パッケージを解凍して ``trilium`` の実行ファイルを実行してください。
* サーバーに Trilium をインストールする場合は、[このページ](https://github.com/zadam/trilium/wiki/Server-installation)に従ってください。
  * 現在、対応（動作確認）しているブラウザは、最近の Chrome と Firefox のみです。

Trilium は Flatpak としても提供されます：

[<img width="240" src="https://flathub.org/assets/badges/flathub-badge-en.png">](https://flathub.org/apps/details/com.github.zadam.trilium)

## 📝 ドキュメント

[ドキュメントページの全リストはwikiをご覧ください。](https://github.com/zadam/trilium/wiki/)

また、[個人的な知識基盤のパターン](https://github.com/zadam/trilium/wiki/Patterns-of-personal-knowledge-base)を読むと、 Trilium の使い方のヒントを得ることができます。

## 💻 コントリビュート

ブラウザベースの開発環境を使用

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/zadam/trilium)

または、ローカルにクローンして実行
```
npm install
npm run start-server
```

## 📢 シャウトアウト

* [CKEditor 5](https://github.com/ckeditor/ckeditor5) - 市場で最高の WYSIWYG エディター、非常にインタラクティブで聞き上手なチーム
* [FancyTree](https://github.com/mar10/fancytree) - 真の競争相手がいない、非常に機能豊富なツリーライブラリです。 Trilium Notes は、これなしでは成り立たないでしょう。
* [CodeMirror](https://github.com/codemirror/CodeMirror) - 膨大な数の言語をサポートするコードエディタ
* [jsPlumb](https://github.com/jsplumb/jsplumb) - 競合のないビジュアルコネクティビティライブラリです。[関係図](https://github.com/zadam/trilium/wiki/Relation-map)、[リンク図](https://github.com/zadam/trilium/wiki/Link-map)で使用。

## 🤝 サポート

GitHub スポンサー、[PayPal](https://paypal.me/za4am)もしくは Bitcoin (bitcoin:bc1qv3svjn40v89mnkre5vyvs2xw6y8phaltl385d2) にて Trilium をサポートすることができます。

## 🔑 ライセンス

このプログラムはフリーソフトウェアです：フリーソフトウェア財団が発行した GNU Affero General Public License のバージョン3、またはそれ以降のバージョンのいずれかに従って、再配布および/または改変することができます。
