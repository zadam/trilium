import server from "./server.js";
import utils from "./utils.js";

class KeyboardAction {
	constructor(params) {
		/** @property {string} */
		this.actionName = params.actionName;
		/** @property {string[]} */
		this.defaultShortcuts = params.defaultShortcuts;
		/** @property {string[]} */
		this.effectiveShortcuts = params.effectiveShortcuts;
		/** @property {string} */
		this.description = params.description;
	}

	addShortcut(shortcut) {
		this.effectiveShortcuts.push(shortcut);
	}

	/**
	 * @param {string|string[]} shortcuts
	 */
	replaceShortcuts(shortcuts) {
		this.effectiveShortcuts = Array.isArray(shortcuts) ? shortcuts : [shortcuts];
	}
}

const keyboardActionRepo = {};

const keyboardActionsLoaded = server.get('keyboard-actions').then(actions => {
	for (const action of actions) {
		keyboardActionRepo[action.actionName] = new KeyboardAction(action);
	}
});

server.get('keyboard-shortcuts-for-notes').then(shortcutForNotes => {
	for (const shortcut in shortcutForNotes) {
		utils.bindGlobalShortcut(shortcut, async () => {
			const treeService = (await import("./tree.js")).default;

			treeService.activateNote(shortcutForNotes[shortcut]);
		});
	}
});

function setGlobalActionHandler(actionName, handler) {
	keyboardActionsLoaded.then(() => {
		const action = keyboardActionRepo[actionName];

		if (!action) {
			throw new Error(`Cannot find keyboard action '${actionName}'`);
		}

		action.handler = handler;

		for (const shortcut of action.effectiveShortcuts) {
			if (shortcut) {
				utils.bindGlobalShortcut(shortcut, handler);
			}
		}
	});
}

function setElementActionHandler($el, actionName, handler) {
	keyboardActionsLoaded.then(() => {
		const action = keyboardActionRepo[actionName];

		if (!action) {
			throw new Error(`Cannot find keyboard action '${actionName}'`);
		}

		// not setting action.handler since this is not global

		for (const shortcut of action.effectiveShortcuts) {
			if (shortcut) {
				utils.bindElShortcut($el, shortcut, handler);
			}
		}
	});
}

async function triggerAction(actionName) {
	const action = getAction(actionName);

	if (!action.handler) {
		throw new Error(`Action ${actionName} has no handler`);
	}

	await action.handler();
}

async function getAction(actionName, silent = false) {
	await keyboardActionsLoaded;

	const action = keyboardActionRepo[actionName];

	if (!action) {
		if (silent) {
			console.log(`Cannot find action ${actionName}`);
		}
		else {
			throw new Error(`Cannot find action ${actionName}`);
		}
	}

	return action;
}

function updateDisplayedShortcuts($container) {
	$container.find('kbd[data-kb-action]').each(async (i, el) => {
		const actionName = $(el).attr('data-kb-action');
		const action = await getAction(actionName, true);

		if (action) {
			$(el).text(action.effectiveShortcuts.join(', '));
		}
	});

	$container.find('button[data-kb-action],a.icon-action[data-kb-action]').each(async (i, el) => {
		const actionName = $(el).attr('data-kb-action');
		const action = await getAction(actionName, true);

		if (action) {
			const title = $(el).attr('title');
			const shortcuts = action.effectiveShortcuts.join(', ');
			const newTitle = !title || !title.trim() ? shortcuts : `${title} (${shortcuts})`;

			$(el).attr('title', newTitle);
		}
	});
}

$(() => updateDisplayedShortcuts($(document)));

export default {
	setGlobalActionHandler,
	setElementActionHandler,
	triggerAction,
	getAction,
	updateDisplayedShortcuts
};