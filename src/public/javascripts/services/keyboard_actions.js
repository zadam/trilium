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

async function getAction(actionName) {
	await keyboardActionsLoaded;

	const action = keyboardActionRepo[actionName];

	if (!action) {
		throw new Error(`Cannot find action ${actionName}`);
	}

	return action;
}

export default {
	setActionHandler,
	triggerAction,
	getAction
};