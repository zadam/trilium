class ContextMenuItemsContainer {
    constructor(items) {
        // clone the item array and the items themselves
        this.items = items.map(item => Object.assign({}, item));
    }

    hideItem(cmd, hidden = true) {
        if (hidden) {
            this.items = this.items.filter(item => item.cmd !== cmd);
        }
    }

    enableItem(cmd, enabled) {
        const item = this.items.find(item => item.cmd === cmd);

        if (!item) {
            throw new Error(`Command ${cmd} has not been found!`);
        }

        item.enabled = enabled;
    }

    getItems() {
        return this.items;
    }
}

export default ContextMenuItemsContainer;
