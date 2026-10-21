import { ButtonView, Command, findAttributeRange, Plugin } from 'ckeditor5';
import type { Editor, ModelRange } from 'ckeditor5';
import internalLinkIcon from '../icons/trilium.svg?raw';
import ReferenceLink from './referencelink';

export const COMMAND_NAME = 'insertInternalLink';

export default class InternalLinkPlugin extends Plugin {

    static get requires() {
        return [ ReferenceLink ];
    }

	init() {
		const editor = this.editor;
		const t = editor.t;

        editor.commands.add(COMMAND_NAME, new InsertInternalLinkCommand(editor));

		editor.ui.componentFactory.add('internalLink', locale => {
			const view = new ButtonView( locale );

			// The shortcut is a `keystroke` rather than part of the label, so CKEditor appends it to
			// the tooltip itself — rendered as ⌘L on macOS, where the binding really is
			// `CommandOrControl+L`, and left out of the string translators see.
			view.set( {
				label: t('Internal link'),
				icon: internalLinkIcon,
				keystroke: 'CTRL+L',
				tooltip: true
			} );

            // enable internal link only if the editor is not read only
			const command = editor.commands.get(COMMAND_NAME)!;
            view.bind('isEnabled').to(command, 'isEnabled');
			view.on('execute', () => {
                editor.execute(COMMAND_NAME);
			} );

			return view;
		});
	}
}

class InsertInternalLinkCommand extends Command {

    refresh() {
        const selection = this.editor.model.document.selection;
        const position = selection.getFirstPosition();
        const isInCodeBlock = position?.findAncestor("codeBlock");

        this.isEnabled = !this.editor.isReadOnly && !isInCodeBlock;
    }

    execute() {
        const editor = this.editor;
        const editorEl = editor.editing.view.getDomRoot();
        const component = glob.getComponentByEl(editorEl);

        component.triggerCommand('addLinkToText');
    }
}

/** The address and the whole text of the link around the selection, or `null` outside one. */
export function getLinkAtSelection(editor: Editor): { href: string; text: string } | null {
    const found = findLinkAtSelection(editor);
    if (!found) {
        return null;
    }

    let text = '';
    for (const item of found.range.getItems()) {
        if (item.is('$textProxy')) {
            text += item.data;
        }
    }
    return { href: found.href, text };
}

/**
 * Replaces the link around the selection with `text` linking to `href`, keeping the formatting of
 * its start, or with a reference to the note at `href` when `text` is `null`.
 */
export function replaceLinkAtSelection(editor: Editor, href: string, text: string | null) {
    const found = findLinkAtSelection(editor);
    if (!found) {
        return;
    }

    const model = editor.model;
    model.change((writer) => {
        const start = found.range.start;
        const first = start.textNode ?? start.nodeAfter;
        const attributes = new Map(first?.getAttributes() ?? []);
        writer.remove(found.range);

        if (text === null) {
            writer.setSelection(start);
            return;
        }

        attributes.set('linkHref', href);
        writer.insertText(text, attributes, start);
        writer.setSelection(start.getShiftedBy(text.length));
    });

    if (text === null) {
        editor.execute('referenceLink', { href });
    }
}

function findLinkAtSelection(editor: Editor): { href: string; range: ModelRange } | null {
    const model = editor.model;
    const selection = model.document.selection;
    const href = selection.getAttribute('linkHref');
    const position = selection.getFirstPosition();
    if (typeof href !== 'string' || !position) {
        return null;
    }

    return { href, range: findAttributeRange(position, 'linkHref', href, model) };
}
