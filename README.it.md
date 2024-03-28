# Trilium Notes

## Trilium è in manutenzione - vedi i dettagli in https://github.com/zadam/trilium/issues/4620

Le discussioni preliminari sull'organizzazione si stanno svolgendo in [Trilium Next discussions](https://github.com/orgs/TriliumNext/discussions). 

[![Join the chat at https://gitter.im/trilium-notes/Lobby](https://badges.gitter.im/trilium-notes/Lobby.svg)](https://gitter.im/trilium-notes/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) [English](https://github.com/zadam/trilium/blob/master/README.md) | [Chinese](https://github.com/zadam/trilium/blob/master/README-ZH_CN.md) | [Russian](https://github.com/zadam/trilium/blob/master/README.ru.md) | [Japanese](https://github.com/zadam/trilium/blob/master/README.ja.md) | [Italian](https://github.com/zadam/trilium/blob/master/README.it.md)


Trilium Notes è un'applicazione per appunti ad organizzazione gerarchica, studiata per la costruzione di archivi di conoscenza personali di grandi dimensioni.

Vedi [fotografie](https://github.com/zadam/trilium/wiki/Screenshot-tour) per una panoramica veloce:

<a href="https://github.com/zadam/trilium/wiki/Screenshot-tour"><img src="https://raw.githubusercontent.com/wiki/zadam/trilium/images/screenshot.png" alt="Trilium Screenshot" width="1000"></a>

L'Ucraina si sta difendendo dall'aggressione russa, considera [donare all'esercito ucraino o a organizzazioni umanitarie](https://standforukraine.com/).

<p float="left">
  <img src="https://upload.wikimedia.org/wikipedia/commons/4/49/Flag_of_Ukraine.svg" alt="drawing" width="400"/>
  <img src="https://signmyrocket.com//uploads/2b2a523cd0c0e76cdbba95a89a9636b2_1676971281.jpg" alt="Trilium Notes supports Ukraine!" width="570"/>
</p>

## 🎁 Funzionalità


* Gli appunti possono essere organizzati in un albero di profondità arbitraria. Un singolo appunto può essere collocato in più posti nell'albero (vedi [clonazione](https://github.com/zadam/trilium/wiki/Cloning-notes))
* Ricco editor visuale (WYSIWYG), con supporto -tra l'altro- per tabelle, immagini ed [espressioni matematiche](https://github.com/zadam/trilium/wiki/Text-notes#math-support) e con [formattazione automatica](https://github.com/zadam/trilium/wiki/Text-notes#autoformat) per markdown
* Supporto per la modifica di [appunti con codice sorgente](https://github.com/zadam/trilium/wiki/Code-notes), con evidenziazione della sintassi
* [Navigazione veloce](https://github.com/zadam/trilium/wiki/Note-navigation) tra gli appunti, ricerca testuale completa e [fissaggio degli appunti](https://github.com/zadam/trilium/wiki/Note-hoisting)
* Supporto integrato ed automatico per le [revisioni degli appunti](https://github.com/zadam/trilium/wiki/Note-revisions)
* Gli [attributi](https://github.com/zadam/trilium/wiki/Attributes) degli appunti possono essere utilizzati per l'organizzazione, per l'interrogazione e per lo scripting avanzato (prorgrammazione).
* [Sincronizzazione](https://github.com/zadam/trilium/wiki/Synchronization) con un server di sincronizzazione auto-ospitato
  * c'è un [servizio di terze parti per ospitare server di sincronizzazione](https://trilium.cc/paid-hosting)
* [Condivisione](https://github.com/zadam/trilium/wiki/Sharing)  (pubblicazione) di appunti sull'internet pubblico
* Robusta [crittografia](https://github.com/zadam/trilium/wiki/Protected-notes) configurabile singolarmente per ogni appunto
* Disegno di diagrammi con Excalidraw (tipo di appunto "canvas")
* [Mappe relazionali](https://github.com/zadam/trilium/wiki/Relation-map) e [mappe di collegamenti](https://github.com/zadam/trilium/wiki/Link-map) per visualizzare gli appunti e le loro relazioni
* [Scripting](https://github.com/zadam/trilium/wiki/Scripts) - vedi [Esempi avanzati](https://github.com/zadam/trilium/wiki/Advanced-showcases)
* [API REST](https://github.com/zadam/trilium/wiki/ETAPI) per l'automazione
* Si adatta bene sia in termini di usabilità che di prestazioni fino ad oltre 100 000 appunti
* Interfaccia utente ottimizzata per il [mobile](https://github.com/zadam/trilium/wiki/Mobile-frontend) (smartphone e tablet)
* [Tema Notturno](https://github.com/zadam/trilium/wiki/Themes)
* Supporto per importazione ed esportazione da e per [Evernote](https://github.com/zadam/trilium/wiki/Evernote-import) e [Markdown import](https://github.com/zadam/trilium/wiki/Markdown)
* [Web Clipper](https://github.com/zadam/trilium/wiki/Web-clipper) per il salvataggio facile di contenuti web


Dai un'occhiata a [awesome-trilium](https://github.com/Nriver/awesome-trilium) per temi, script, plugin e altro di terze parti.

## 🏗 Rilasci


Trilium è fornito come applicazione desktop (Linux e Windows) o come applicazione web ospitata sul tuo server (Linux). La versione desktop per Mac OS è disponibile, ma [non è supportata](https://github.com/zadam/trilium/wiki/FAQ#mac-os-support).

* Se vuoi usare Trilium sul tuo desktop, scarica il rilascio binario per la tua piattaforma dall'[ultimo rilascio](https://github.com/zadam/trilium/releases/latest), decomprimi l'archivio e avvia l'eseguibile ```trilium```.
* Se vuoi installare Trilium su un server, segui [questa pagina](https://github.com/zadam/trilium/wiki/Server-installation).
  * Per ora solo Chrome e Firefox sono i browser supportati (testati).

Trilium è anche disponibile su Flatpak:

[<img width="240" src="https://flathub.org/assets/badges/flathub-badge-en.png">](https://flathub.org/apps/details/com.github.zadam.trilium)

## 📝 Documentazione

[Vedi la wiki per una lista completa delle pagine di documentazione.](https://github.com/zadam/trilium/wiki/)

Puoi anche leggere ["Patterns of personal knowledge base"](https://github.com/zadam/trilium/wiki/Patterns-of-personal-knowledge-base) per avere un'ispirazione su come potresti utilizzare Trilium.

## 💻 Contribuire

Usa un ambiente di sviluppo basato su browser

[![Apri in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/zadam/trilium)

O clona localmente ed esegui
```
npm install
npm run start-server
```

## 📢 Riconoscimenti

* [CKEditor 5](https://github.com/ckeditor/ckeditor5) - miglior editor visuale (WYSIWYG) sul mercato, squadra di sviluppo attenta e reattiva
* [FancyTree](https://github.com/mar10/fancytree) -  libreria per alberi molto ricca di funzionalità, senza pari. Trilium Notes non sarebbe lo stesso senza di essa.
* [CodeMirror](https://github.com/codemirror/CodeMirror) - editor di codice con supporto per un'enorme quantità di linguaggi.
* [jsPlumb](https://github.com/jsplumb/jsplumb) - libreria per la  connettività visuale senza pari. Utilizzata per [mappe relazionali](https://github.com/zadam/trilium/wiki/Relation-map) e [mappe di collegamenti](https://github.com/zadam/trilium/wiki/Link-map).

## 🤝 Supporto

È possibile supportare Trilium attraverso Github Sponsors, [PayPal](https://paypal.me/za4am) o Bitcoin (bitcoin:bc1qv3svjn40v89mnkre5vyvs2xw6y8phaltl385d2).

## 🔑 Licenza

Questo programma è software libero: è possibile redistribuirlo e/o modificarlo nei termini della GNU Affero General Public License come pubblicata dalla Free Software Foundation, sia la versione 3 della Licenza, o (a propria scelta) qualsiasi versione successiva.
