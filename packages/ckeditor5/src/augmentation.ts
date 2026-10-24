import "ckeditor5";

import type { InlineEmbedSource } from "./plugins/content_embed/inline_source.js";

declare global {
    interface Component {
        componentId: string;
        triggerCommand(command: string): void;
    }

    interface LinkEmbedMetadata {
        url: string;
        embedType: string;
        title?: string;
        description?: string;
        favicon?: string;
        siteName?: string;
        image?: string;
        /**
         * True when the host could not read the page (network error, bot challenge, non-HTML
         * response, or a page with no title of its own) and the fields above hold nothing but a
         * hostname-derived placeholder. Mirrors `LinkEmbedMetadata.unresolved` in
         * `@triliumnext/commons`, which is what the host actually returns.
         */
        unresolved?: boolean;
    }

    interface IconPickerRequest {
        /** The element to paint the picker into, which the editor owns and places. */
        container: HTMLElement;
        /** Receives the class of the icon picked, e.g. `bx bx-star`. */
        onSelect(iconClass: string): void;
    }

    /** A button that the content of an embed adds to the toolbar of the embed. */
    interface ContentEmbedTool {
        id: string;
        /** The name of what the button does, shown as its tooltip. */
        label: string;
        /** The text of a button without an icon. */
        text?: string;
        /** The SVG of the icon of the button. */
        icon?: string;
        /** Whether a button that toggles is on. A command leaves it out. */
        isOn?: boolean;
        /** `true` when left out. */
        isEnabled?: boolean;
        /** A separator goes between buttons, or items of a menu, of different groups. */
        group?: string;
        /**
         * The keystroke shown beside the label of an item of a menu: CKEditor's notation, such as
         * `Ctrl+F`, or a single character, such as `?`.
         */
        keystroke?: string;
        /** The tools of the menu that the button opens. */
        children?: ContentEmbedTool[];
        /**
         * Whether the button opens a menu that the content draws, with
         * `ContentEmbedToolProvider.openMenu()`, instead of running the tool.
         */
        opensMenu?: boolean;
        /** A class of the button, for the content to style it. */
        class?: string;
    }

    /** An item of the embed toolbar that the content of an embed can hide. */
    type ContentEmbedToolbarItem =
        "contentEmbedBoxSizeDropdown" | "toggleContentEmbedTitle" | "convertEmbedToLink";

    /** The buttons that the content of an embed, such as a canvas drawing, adds to its toolbar. */
    interface ContentEmbedToolProvider {
        getTools(): ContentEmbedTool[];
        execute(id: string): void;
        /** Opens the menu of the tool `id`, which sets `opensMenu`, below `anchor`. */
        openMenu?(id: string, anchor: HTMLElement): void;
        /** Calls `callback` when `getTools()` changes, until the returned function is called. */
        subscribe(callback: () => void): () => void;
        /** The items of the embed toolbar to hide. The menu of the embed still offers them. */
        hiddenToolbarItems?: readonly ContentEmbedToolbarItem[];
        /**
         * An SVG icon that the box size dropdown of the embed toolbar shows in place of the name of
         * the box size, which its tooltip then names.
         */
        boxSizeIcon?: string;
        /**
         * Whether the content has an editable mode, which the toolbar and the menu of the embed
         * then turn on and off. The embed carries `data-editable="true"` while it is on.
         */
        hasEditableFlag?: boolean;
        /**
         * Whether the content shows its source, its rendering or both, which the toolbar and the
         * menu of the embed then switch. The embed carries the mode as `data-display-mode`.
         */
        hasDisplayModes?: boolean;
    }

    interface EditorComponent extends Component {
        /**
         * Paints the host's icon picker into `container`, and answers with the way to take it down
         * again. A host that shows the picker somewhere of its own — a phone, which has no room for
         * a balloon — leaves `container` alone and answers `null`.
         */
        showIconPicker(request: IconPickerRequest): (() => void) | null;
        loadReferenceLinkTitle(
            $el: JQuery<HTMLElement>, href: string, storedTitle?: string
        ): Promise<void>;
        /**
         * Lets the user pick the note a reference link to a missing note should point at instead,
         * starting from `storedTitle`, and calls `fix()` with the new href.
         */
        fixReferenceLink?(storedTitle: string, fix: (href: string) => void): void;
        /**
         * Fills an embed with the note, or with the `block` of it, a `block` link parameter. An
         * editor of those blocks calls `onBlockChange()` once the blocks at its edges change.
         */
        loadEmbeddedNote(
            noteId: string,
            $el: JQuery<HTMLElement>,
            boxSize?: string,
            block?: string,
            onBlockChange?: (block: string) => void
        ): void;
        loadEmbeddedAttachment(
            attachmentId: string,
            $el: JQuery<HTMLElement>,
            boxSize?: string
        ): void;
        /**
         * Fills an embed box with what `source` shows, for an embed that keeps its content in the
         * note. Hosts without such embeds leave it out.
         */
        loadInlineEmbed?(
            source: InlineEmbedSource,
            $el: JQuery<HTMLElement>,
            boxSize: string | undefined,
            options: { isFocused: boolean }
        ): void;
        /** The href of a reference link to the attachment, or `null` once it is deleted. */
        getAttachmentHref(attachmentId: string): Promise<string | null>;
        /** The note the editor holds. Hosts without a note of their own leave it out. */
        getNoteId?(): string | undefined;
        /**
         * Opens the context menu of what `embed` shows, below `anchor`. Hosts without embeds
         * leave it out.
         */
        openContentEmbedMenu?(embed: HTMLElement, anchor: HTMLElement): void;
        /**
         * Opens the menu of the block handle at `event`, for `count` selected blocks. Hosts
         * without block references leave it out.
         */
        openBlockHandleMenu?(event: MouseEvent, count: number): void;
        /**
         * Copies a link to the tab that holds the selection. Hosts without block references leave
         * it out.
         */
        copyTabReference?(): void;
        /**
         * The buttons that what `embed` shows adds to the toolbar of the embed, or `null`. Hosts
         * without embeds leave it out.
         */
        getContentEmbedTools?(embed: HTMLElement): ContentEmbedToolProvider | null;
        /**
         * Focuses the editor that `embed` shows, with the caret at `edge` of its content, and
         * returns whether it did. Hosts without embeds leave it out.
         */
        enterContentEmbed?(embed: HTMLElement, edge: "start" | "end"): boolean;
        /**
         * Gives the focus to what the embed of the attachment shows, once it renders. Hosts
         * without embeds leave it out.
         */
        focusContentEmbed?(attachmentId: string): void;
        /**
         * Attaches a drawing canvas that shows the image at `src`, and answers with the ID of its
         * attachment, or `null` when that fails. Hosts without drawings leave it out.
         */
        convertImageToDrawing?(src: string): Promise<string | null>;
    }

    var glob: {
        getComponentByEl<T extends Component>(el: unknown): T;
        getActiveContextNote(): {
            noteId: string;
        };
    };
}

