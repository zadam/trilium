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

function setActionHandler(actionName, handler) {
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

function updateKbdElements($container) {
	$container.find('kbd[data-kb-action]').each(async (i, el) => {
		const actionName = $(el).attr('data-kb-action');
		const action = await getAction(actionName, true);

		if (action) {
			$(el).text(action.effectiveShortcuts.join(', '));
		}
	});
}

$(() => updateKbdElements($(document)));

export default {
	setActionHandler,
	triggerAction,
	getAction,
	updateKbdElements
};