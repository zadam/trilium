import optionsService from "./options.js";

export async function initSpellCheck() {
    const options = await optionsService.waitForOptions();

    if (!options.is('spellCheckEnabled')) {
        return;
    }

    const {SpellCheckHandler, ContextMenuListener, ContextMenuBuilder} = require('electron-spellchecker');
    const {remote, shell} = require('electron');

    const spellCheckHandler = new SpellCheckHandler();
    spellCheckHandler.attachToInput();

    spellCheckHandler.switchLanguage(options.get('spellCheckLanguageCode'));

    spellCheckHandler.currentSpellcheckerChanged.subscribe(() => {
        console.debug(`Detected language is ${spellCheckHandler.currentSpellcheckerLanguage}`);
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