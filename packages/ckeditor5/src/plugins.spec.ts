import {
    AutoLink, BalloonToolbar, BlockToolbar, Bold, CKFinderUploadAdapter, Code, GeneralHtmlSupport,
    ImageUpload, Italic, Link, MentionEditing, Strikethrough
} from "ckeditor5";
import { describe, expect, it } from "vitest";

import { createTestEditor, createTestEditorOf } from "../test/editor-kit.js";
import { AttributeEditor, GuestEditor } from "./index.js";
import TriliumAiAssistant from "./plugins/ai_assistant/ai_assistant.js";
import ClipboardBareImage from "./plugins/clipboard_bare_image.js";
import ClipboardImageEmbed from "./plugins/clipboard_image_embed.js";
import CollabCursors from "./plugins/collab_cursors.js";
import InsertDateTimePlugin from "./plugins/insert_date_time.js";
import MarkdownImportPlugin from "./plugins/markdownimport.js";
import Math from "./plugins/math/math.js";
import TriliumMentionUI from "./plugins/mention/trilium_mention_ui.js";
import Mermaid from "./plugins/mermaid/mermaid.js";
import UploadimagePlugin from "./plugins/uploadimage.js";
import Admonition from "./plugins/admonition/admonition.js";
import ItalicAsEmPlugin from "./plugins/italic_as_em.js";
import StrikethroughAsDel from "./plugins/strikethrough_as_del.js";
import {
    CHAT_INPUT_PLUGINS, COMMON_PLUGINS, CORE_PLUGINS, GUEST_PLUGINS, MEMO_PLUGINS,
    POPUP_EDITOR_PLUGINS
} from "./plugins.js";
import CutToNotePlugin from "./plugins/cuttonote.js";
import Uploadfileplugin from "./plugins/file_upload/uploadfileplugin.js";
import FindInLinkWidgets from "./plugins/find_in_link_widgets.js";
import TriliumFormatPainter from "./plugins/format_painter/format_painter.js";
import IncludeNote from "./plugins/includenote.js";
import InternalLinkPlugin from "./plugins/internallink.js";
import LinkEmbed from "./plugins/link_embed/link_embed.js";
import TriliumSlashCommands from "./plugins/mention/slash_commands.js";
import MentionCustomization from "./plugins/mention_customization.js";
import ReferenceLink from "./plugins/referencelink.js";
import TriliumSnippets from "./plugins/snippets/snippets.js";

describe("plugin lists", () => {
    it("CORE_PLUGINS is a non-empty array", () => {
        expect(Array.isArray(CORE_PLUGINS)).toBe(true);
        expect(CORE_PLUGINS.length).toBeGreaterThan(0);
    });

    it("COMMON_PLUGINS is a non-empty array", () => {
        expect(Array.isArray(COMMON_PLUGINS)).toBe(true);
        expect(COMMON_PLUGINS.length).toBeGreaterThan(0);
    });

    it("POPUP_EDITOR_PLUGINS is a non-empty array", () => {
        expect(Array.isArray(POPUP_EDITOR_PLUGINS)).toBe(true);
        expect(POPUP_EDITOR_PLUGINS.length).toBeGreaterThan(0);
    });

    it("COMMON_PLUGINS includes all CORE_PLUGINS", () => {
        for (const plugin of CORE_PLUGINS) {
            expect(COMMON_PLUGINS).toContain(plugin);
        }
    });

    it("POPUP_EDITOR_PLUGINS includes all COMMON_PLUGINS", () => {
        for (const plugin of COMMON_PLUGINS) {
            expect(POPUP_EDITOR_PLUGINS).toContain(plugin);
        }
    });

    it("all entries in CORE_PLUGINS are functions (plugin constructors)", () => {
        for (const plugin of CORE_PLUGINS) {
            expect(typeof plugin).toBe("function");
        }
    });

    it("all entries in COMMON_PLUGINS are functions (plugin constructors)", () => {
        for (const plugin of COMMON_PLUGINS) {
            expect(typeof plugin).toBe("function");
        }
    });

    it("all entries in POPUP_EDITOR_PLUGINS are functions (plugin constructors)", () => {
        for (const plugin of POPUP_EDITOR_PLUGINS) {
            expect(typeof plugin).toBe("function");
        }
    });

    // The shape checks above are tautological for catching a *dropped* registration: because
    // COMMON_PLUGINS is built by spreading CORE_PLUGINS (and POPUP by spreading COMMON), removing
    // a plugin shrinks both lists and the superset loops still pass. These presence assertions pin
    // specific load-bearing plugins so deleting a registration line in plugins.ts turns the suite red.

    it("CORE_PLUGINS includes the Trilium-specific core plugins", () => {
        expect(CORE_PLUGINS).toContain(MentionCustomization);
        expect(CORE_PLUGINS).toContain(ReferenceLink);
    });

    it("COMMON_PLUGINS includes the in-tree Trilium feature plugins", () => {
        expect(COMMON_PLUGINS).toContain(CutToNotePlugin);
        expect(COMMON_PLUGINS).toContain(InternalLinkPlugin);
        expect(COMMON_PLUGINS).toContain(IncludeNote);
        expect(COMMON_PLUGINS).toContain(LinkEmbed);
        expect(COMMON_PLUGINS).toContain(FindInLinkWidgets);
        expect(COMMON_PLUGINS).toContain(Uploadfileplugin);
        expect(COMMON_PLUGINS).toContain(CollabCursors);
    });

    it("COMMON_PLUGINS includes the external widget plugins", () => {
        expect(COMMON_PLUGINS).toContain(Admonition);
    });

    it("POPUP_EDITOR_PLUGINS adds BlockToolbar on top of COMMON_PLUGINS", () => {
        expect(POPUP_EDITOR_PLUGINS).toContain(BlockToolbar);
        expect(COMMON_PLUGINS).not.toContain(BlockToolbar);
    });

    // Each of these replaced a premium plugin, which is why `ckeditor5-premium-features` is no
    // longer a dependency at all. Dropping one of the registrations silently would put the editor
    // back to missing the feature outright, so pin them here.
    it("COMMON_PLUGINS includes the GPL replacements for the former premium plugins", () => {
        expect(COMMON_PLUGINS).toContain(TriliumSlashCommands);
        expect(COMMON_PLUGINS).toContain(TriliumFormatPainter);
        expect(COMMON_PLUGINS).toContain(TriliumSnippets);
    });

    it("MEMO_PLUGINS marks up a sentence, which the chat input deliberately goes without", () => {
        for (const plugin of CHAT_INPUT_PLUGINS) {
            expect(MEMO_PLUGINS).toContain(plugin);
        }
        for (const plugin of [ Bold, Italic, Strikethrough, Code ]) {
            expect(MEMO_PLUGINS).toContain(plugin);
            // Not added to the set the memo builds on: what is typed in the chat box is turned into
            // markdown before it is sent, and that pass keeps the text of an inline wrapper and
            // drops the wrapper. Bold offered there would be bold lost on its way to the model.
            expect(CHAT_INPUT_PLUGINS).not.toContain(plugin);
        }
        // What writes italics as `<em>` and a strikethrough as `<del>`, as the rest of Trilium
        // stores both; they are downcast converters and do nothing without the marks above.
        expect(MEMO_PLUGINS).toContain(ItalicAsEmPlugin);
        expect(MEMO_PLUGINS).toContain(StrikethroughAsDel);
    });
});

describe("GUEST_PLUGINS", () => {
    it("carries formatting and links, nothing that reaches the host or creates notes", () => {
        for (const plugin of [ Bold, Link, AutoLink, GeneralHtmlSupport, CollabCursors ]) {
            expect(GUEST_PLUGINS).toContain(plugin);
        }

        for (const plugin of [
            UploadimagePlugin, Uploadfileplugin, CKFinderUploadAdapter, ImageUpload,
            ClipboardImageEmbed, ClipboardBareImage, CutToNotePlugin, InternalLinkPlugin,
            IncludeNote, ReferenceLink, MentionEditing, TriliumMentionUI, TriliumSlashCommands,
            LinkEmbed, TriliumAiAssistant, TriliumSnippets, MarkdownImportPlugin, Mermaid, Math,
            InsertDateTimePlugin, FindInLinkWidgets
        ]) {
            expect(GUEST_PLUGINS).not.toContain(plugin);
        }
    });

    it("raises a GuestEditor that keeps the markup of the features it does not carry", async () => {
        const editor = await createTestEditorOf(GuestEditor, GUEST_PLUGINS, {
            htmlSupport: {
                allow: [ { name: /.*/, attributes: true, classes: true, styles: true } ]
            }
        });

        editor.setData([
            "<p>Hi <a href=\"https://example.com\">site</a></p>",
            "<section class=\"include-note\" data-note-id=\"abc\"><p>inner</p></section>"
        ].join(""));

        const data = editor.getData();
        expect(data).toContain("<a href=\"https://example.com\">site</a>");
        expect(data).toContain("include-note");
        expect(data).toContain("data-note-id=\"abc\"");
    });
});

describe("an editor raised on MEMO_PLUGINS", () => {
    /** As the memo is built: the plugins every minimal editor carries, and the memo's own upon them. */
    const memoEditor = () => createTestEditor([ ...CORE_PLUGINS, ...MEMO_PLUGINS ]);

    it("carries every button the memo's toolbar is built from", async () => {
        const editor = await memoEditor();

        // The toolbar of a `BalloonEditor` is raised from the names it is configured with, and a
        // name nothing answers to is dropped with a warning rather than reported. The memo's list
        // (see NodeMemo.tsx) is pinned here so that thinning this set turns the suite red instead.
        for (const item of [
            "bold", "italic", "strikethrough", "code",
            "link", "bulletedList", "numberedList", "blockQuote", "codeBlock"
        ]) {
            expect(editor.ui.componentFactory.has(item)).toBe(true);
        }
    });

    it("registers the markdown spellings of those marks, which follow from the commands", async () => {
        const editor = await memoEditor();

        // Autoformat adds `**bold**`, `_italic_`, `` `code` `` and `~~struck~~` only where the
        // matching command answers, so a set without the marks leaves those spellings inert too —
        // which is what the memo's field did before them.
        for (const command of [ "bold", "italic", "strikethrough", "code" ]) {
            expect(editor.commands.get(command)).toBeDefined();
        }
    });

    it("raises a toolbar over the selection out of the items it is configured with", async () => {
        // What the memo's field relies on, and the whole of how it gets a toolbar: an
        // `AttributeEditor` is a `BalloonEditor`, whose constructor loads `BalloonToolbar` itself
        // and defines `balloonToolbar` from `toolbar`. The field passed an empty list until now,
        // which is the only reason nothing was ever shown.
        const editorElement = document.createElement("div");
        document.body.appendChild(editorElement);
        const editor = await AttributeEditor.create(editorElement, {
            licenseKey: "GPL",
            extraPlugins: MEMO_PLUGINS,
            toolbar: { items: [ "bold", "italic" ] }
        });

        try {
            const balloonToolbar = editor.plugins.get("BalloonToolbar") as BalloonToolbar;
            expect(balloonToolbar.toolbarView.items.length).toBe(2);
        } finally {
            await editor.destroy();
            editorElement.remove();
        }
    });

    it("writes italics and strikethrough the way the rest of Trilium stores them", async () => {
        const editor = await memoEditor();

        editor.setData("<p><i>slanted</i> and <s>struck</s></p>");

        expect(editor.getData()).toBe("<p><em>slanted</em> and <del>struck</del></p>");
    });
});
