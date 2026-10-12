import { ButtonView, Command, ImageUtils, Plugin, type ModelElement } from "ckeditor5";
import bxsPen from "boxicons/svg/solid/bxs-pen.svg?raw";

/**
 * Adds the `convertImageToDrawing` button to the image toolbar. The host attaches a drawing canvas
 * that shows the selected block image, which an editable, untitled Medium embed of it replaces.
 */
export default class ImageToDrawing extends Plugin {

    static get requires() {
        return [ ImageUtils ] as const;
    }

    static get pluginName() {
        return "ImageToDrawing" as const;
    }

    init() {
        const editor = this.editor;
        const t = editor.t;
        const command = new ConvertImageToDrawingCommand(editor);
        editor.commands.add("convertImageToDrawing", command);

        editor.ui.componentFactory.add("convertImageToDrawing", (locale) => {
            const button = new ButtonView(locale);
            button.set({
                label: t("Convert image to a drawing canvas"),
                icon: bxsPen,
                tooltip: true
            });
            button.bind("isEnabled").to(command);
            this.listenTo(button, "execute", () => {
                void editor.execute("convertImageToDrawing");
                // `ContentEmbed` focuses the new drawing only while the editor has the focus.
                editor.editing.view.focus();
            });
            return button;
        });
    }

}

/**
 * Replaces the selected block image with an embed of a drawing canvas that shows it. Resolves once
 * the embed is in place, or once the host fails to attach the drawing.
 */
export class ConvertImageToDrawingCommand extends Command {

    override refresh() {
        const model = this.editor.model;
        const image = this.getSelectedBlockImage();

        this.isEnabled = !!image && typeof image.getAttribute("src") === "string"
            && model.schema.checkChild(model.createPositionBefore(image), "contentEmbed");
    }

    override async execute() {
        const editor = this.editor;
        const image = this.getSelectedBlockImage();
        const src = image?.getAttribute("src");
        if (!image || typeof src !== "string") return;

        const host = glob.getComponentByEl<EditorComponent>(editor.editing.view.getDomRoot());
        this.forceDisabled(CONVERTING);
        let attachmentId: string | null | undefined;
        try {
            attachmentId = await host.convertImageToDrawing?.(src);
        } finally {
            this.clearForceDisabled(CONVERTING);
        }
        if (!attachmentId || !isInDocument(image)) return;

        host.focusContentEmbed?.(attachmentId);
        // CKEditor's renderer draws a figure that replaces another in the same render twice, so
        // the embed goes in and the image out in two changes, of one batch for a single undo.
        const model = editor.model;
        const { embed, batch } = model.change((writer) => {
            const embed = writer.createElement("contentEmbed", {
                attachmentId,
                boxSize: "medium",
                hideTitle: true,
                editable: true
            });
            const caption = getCaption(image);
            if (caption && !caption.isEmpty) {
                writer.append(writer.cloneElement(caption), embed);
            }
            writer.insert(embed, writer.createPositionAfter(image));
            return { embed, batch: writer.batch };
        });
        model.enqueueChange(batch, (writer) => {
            writer.remove(image);
            writer.setSelection(embed, "on");
        });
    }

    private getSelectedBlockImage() {
        const selection = this.editor.model.document.selection;
        const image = this.editor.plugins.get(ImageUtils).getClosestSelectedImageElement(selection);
        return image?.is("element", "imageBlock") ? image : null;
    }

}

const CONVERTING = "converting";

function getCaption(image: ModelElement) {
    for (const child of image.getChildren()) {
        if (child.is("element", "caption")) return child;
    }
    return null;
}

/** Whether `element` is still in the document, rather than removed while the host worked. */
function isInDocument(element: ModelElement) {
    const root = element.root;
    return root.is("rootElement") && root.rootName !== "$graveyard";
}
