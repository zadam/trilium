import options from "./options.js";

export async function initSpellCheck() {return;
    const {SpellCheckHandler, ContextMenuListener, ContextMenuBuilder} = require('electron-spellchecker');
    const {remote, shell} = require('electron');

    const spellCheckHandler = new SpellCheckHandler();

    // not fully disabling the spellcheck since we want to preserve the context menu
    // this will just get rid of the "red squiggles"
    if (options.is('spellCheckEnabled')) {
        spellCheckHandler.attachToInput();
    }

    spellCheckHandler.switchLanguage(options.get('spellCheckLanguageCode'));

    spellCheckHandler.currentSpellcheckerChanged.subscribe(() => {
        console.debug(`Detected language is ${spellCheckHandler.currentSpellcheckerLanguage}`);

        spellCheckHandler.currentSpellchecker.add("trilium");
        spellCheckHandler.currentSpellchecker.add("https");
        spellCheckHandler.currentSpellchecker.add("github");
        spellCheckHandler.currentSpellchecker.add("unordered");
    });

    const contextMenuBuilder = new ContextMenuBuilder(spellCheckHandler, null, true, (menu, menuInfo) => {
        // There's no menu.remove(id) so this is a convoluted way of removing the 'Search with Google' menu item
        const oldItems = menu.items;
        menu.clear();
        oldItems.forEach(oldItem => {
            if (!oldItem.label.includes('Google')) {
                menu.append(oldItem);
            } else {
                menu.append(new remote.MenuItem({
                    label: 'Search with DuckDuckGo',
                    click: () => {
                        shell.openExternal(`https://duckduckgo.com/?q=${encodeURIComponent(menuInfo.selectionText)}`);
                    }
                }));
            }
        });
    });

    new ContextMenuListener(async (info) => {
        await contextMenuBuilder.showPopupMenu(info);
    });
}