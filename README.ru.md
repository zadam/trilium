# Trilium Notes

[English](https://github.com/zadam/trilium/blob/master/README.md) | [Chinese](https://github.com/zadam/trilium/blob/master/README-ZH_CN.md) | [Russian](https://github.com/zadam/trilium/blob/master/README.ru.md)

[![Join the chat at https://gitter.im/trilium-notes/Lobby](https://badges.gitter.im/trilium-notes/Lobby.svg)](https://gitter.im/trilium-notes/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
Trilium Notes – это приложение для заметок с иерархической структурой, ориентированное на создание больших персональных баз знаний. Для быстрого ознакомления посмотрите [скриншот-тур](https://github.com/zadam/trilium/wiki/Screenshot-tour):

![](https://raw.githubusercontent.com/wiki/zadam/trilium/images/screenshot.png)

Ukraine is currently suffering from Russian aggression, please consider donating to [one of these charities](https://old.reddit.com/r/ukraine/comments/s6g5un/want_to_support_ukraine_heres_a_list_of_charities/).

<img src="https://upload.wikimedia.org/wikipedia/commons/4/49/Flag_of_Ukraine.svg" alt="drawing" width="600"/>
<img src="https://signmyrocket.com//uploads/2b2a523cd0c0e76cdbba95a89a9636b2_1676971281.jpg" alt="Trilium Notes supports Ukraine!" width="600"/>

## Возможности

* Заметки можно расположить в виде дерева произвольной глубины. Отдельную заметку можно разместить в нескольких местах дерева (см. [клонирование](https://github.com/zadam/trilium/wiki/Cloning-notes))
* Продвинутый визуальный редактор (WYSIWYG) позволяет работать с таблицами, изображениями, [формулами](https://github.com/zadam/trilium/wiki/Text-notes#math-support) и разметкой markdown, имеет [автоформатирование](https://github.com/zadam/trilium/wiki/Text-notes#autoformat)
* Редактирование [заметок с исходным кодом](https://github.com/zadam/trilium/wiki/Code-notes), включая подсветку синтаксиса
* Быстрая и простая [навигация между заметками](https://github.com/zadam/trilium/wiki/Note-navigation), полнотекстовый поиск и [выделение заметок](https://github.com/zadam/trilium/wiki/Note-hoisting) в отдельный блок
* Бесшовное [версионирование заметки](https://github.com/zadam/trilium/wiki/Note-revisions)
* Специальные [атрибуты](https://github.com/zadam/trilium/wiki/Attributes) позволяют гибко организовать структуру, используются для поиска и продвинутого [скриптинга](https://github.com/zadam/trilium/wiki/Scripts)
* [Синхронизация](https://github.com/zadam/trilium/wiki/Synchronization) заметок со своим сервером
* Надёжное [шифрование](https://github.com/zadam/trilium/wiki/Protected-notes) с детализацией по каждой заметке
* [Карты связей](https://github.com/zadam/trilium/wiki/Relation-map) и [карты ссылок](https://github.com/zadam/trilium/wiki/Link-map) для визуализации их взяимосвязей
* [Скрипты](https://github.com/zadam/trilium/wiki/Scripts) - см. [продвинутые примеры](https://github.com/zadam/trilium/wiki/Advanced-showcases)
* Хорошо масштабируется, как по удобству использования, так и по производительности до 100000 заметок
* Оптимизированный [мобильный фронтенд](https://github.com/zadam/trilium/wiki/Mobile-frontend) смартфонов и планшетов
* [Темная тема](https://github.com/zadam/trilium/wiki/Themes)
* Импорт и экпорт [Evernote](https://github.com/zadam/trilium/wiki/Evernote-import) и данных в [markdown](https://github.com/zadam/trilium/wiki/Markdown) формате
* [Web Clipper](https://github.com/zadam/trilium/wiki/Web-clipper) для удобного сохранения веб-контента

## Сборки

Trilium предоставляется в виде десктопного приложения (Linux и Windows) или веб-приложения, размещенного на вашем сервере (Linux). Доступна сборка Mac OS, но она [не поддерживается](https://github.com/zadam/trilium/wiki/FAQ#mac-os-support).

* Если вы хотите использовать Trilium на десктопе, скачайте архив для своей платформы со страницы [релизов](https://github.com/zadam/trilium/releases/latest), распакуйте и запустите исполняемый файл ```trilium```.
* Если вы хотите установить Trilium на сервере, следуйте этой [инструкции](https://github.com/zadam/trilium/wiki/Server-installation).
  * В данный момент поддерживаются (протестированы) последние версии браузеров Chrome и Firefox.

## Документация

[Полный список страниц документации доступен в Wiki.](https://github.com/zadam/trilium/wiki/)

Вы также можете ознакомиться с [шаблонами персональных баз знаний](https://github.com/zadam/trilium/wiki/Patterns-of-personal-knowledge-base), чтобы получить представление о том, как можно использовать Trilium.

## Участвуйте в разработке

Используйте онлайн среду разработки в браузере

[![Открыть в Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/zadam/trilium)

Или склонируйте на своё устройство и запустите
```
npm install
npm run start-server
```

## Благодарности

* [CKEditor 5](https://github.com/ckeditor/ckeditor5) - лучший WYSIWYG редактор, очень активная и внимательная команда.
* [FancyTree](https://github.com/mar10/fancytree) - многофункциональная библиотека для создания древовидных структур. Вне конкуренции. Без него Trilium Notes не были бы таким.
* [CodeMirror](https://github.com/codemirror/CodeMirror) - редактор кода с поддержкой огромного количество языков.
* [jsPlumb](https://github.com/jsplumb/jsplumb) - библиотека для визуализации связей. Вне конкуренции. Используется в [картах связей](https://github.com/zadam/trilium/wiki/Relation-map) и [картах ссылок](https://github.com/zadam/trilium/wiki/Link-map).

## Лицензия

Эта программа является бесплатным программным обеспечением: вы можете распространять и/или изменять ее в соответствии с условиями GNU Affero General Public License, опубликованной Free Software Foundation, либо версии 3 Лицензии, либо (по вашему выбору) любой более поздней версии.
