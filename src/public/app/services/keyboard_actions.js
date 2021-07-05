import server from "./server.js";
import utils from "./utils.js";
import appContext from "./app_context.js";

const keyboardActionRepo = {};

const keyboardActionsLoaded = server.get('keyboard-actions').then(actions => {
	actions = actions.filter(a => !!a.actionName); // filter out separators

	for (const action of actions) {
		action.effectiveShortcuts = action.effectiveShortcuts.filter(shortcut => !shortcut.startsWith("global:"));

		keyboardActionRepo[action.actionName] = action;
	}

	return actions;
});

async function getActions() {
	return await keyboardActionsLoaded;
}

async function getActionsForScope(scope) {
	const actions = await keyboardActionsLoaded;

	return actions.filter(action => action.scope === scope);
}

async function setupActionsForElement(scope, $el, component) {
	const actions = await getActionsForScope(scope);

	for (const action of actions) {
		for (const shortcut of action.effectiveShortcuts) {
			utils.bindElShortcut($el, shortcut, () => component.triggerCommand(action.actionName, {ntxId: appContext.tabManager.activeNtxId}));
		}
	}
}

getActionsForScope("window").then(actions => {
	for (const action of actions) {
		for (const shortcut of action.effectiveShortcuts) {
			utils.bindGlobalShortcut(shortcut, () => appContext.triggerCommand(action.actionName, {ntxId: appContext.tabManager.activeNtxId}));
		}
	}
});

server.get('keyboard-shortcuts-for-notes').then(shortcutForNotes => {
	for (const shortcut in shortcutForNotes) {
		utils.bindGlobalShortcut(shortcut, async () => {
			appContext.tabManager.getActiveContext().setNote(shortcutForNotes[shortcut]);
		});
	}
});

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
	$container.find('kbd[data-command]').each(async (i, el) => {
		const actionName = $(el).attr('data-command');
		const action = await getAction(actionName, true);

		if (action) {
			const keyboardActions = action.effectiveShortcuts.join(', ');

			if (keyboardActions || $(el).text() !== "not set") {
				$(el).text(keyboardActions);
			}
		}
	});

	$container.find('[data-trigger-command]').each(async (i, el) => {
		const actionName = $(el).attr('data-trigger-command');
		const action = await getAction(actionName, true);

		if (action) {
			const title = $(el).attr('title');
			const shortcuts = action.effectiveShortcuts.join(', ');
			const newTitle = !title || !title.trim() ? shortcuts : `${title} (${shortcuts})`;

			$(el).attr('title', newTitle);
		}
	});
}

export default {
	setElementActionHandler,
	updateDisplayedShortcuts,
	setupActionsForElement,
	getActions,
	getActionsForScope,
	getAction
};
