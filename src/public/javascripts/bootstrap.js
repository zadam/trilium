import searchTree from './search_tree.js';

const $toggleSearchButton = $("#toggle-search-button");

$toggleSearchButton.click(searchTree.toggleSearch);
bindShortcut('ctrl+s', searchTree.toggleSearch);

function bindShortcut(keyboardShortcut, handler) {
    $(document).bind('keydown', keyboardShortcut, e => {
        handler();

        e.preventDefault();
    });
}