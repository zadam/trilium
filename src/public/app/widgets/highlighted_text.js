/**
 * Widget: Show highlighted text in the right pane
 *
 * By design there's no support for nonsensical or malformed constructs:
 * - For example, if there is a formula in the middle of the highlighted text, the two ends of the formula will be regarded as two entries
 */

import attributeService from "../services/attributes.js";
import RightPanelWidget from "./right_panel_widget.js";
import options from "../services/options.js";
import OnClickButtonWidget from "./buttons/onclick_button.js";

const TPL = `<div class="highlighted-text-widget">
    <style>
        .highlighted-text-widget {
            padding: 10px;
            contain: none; 
            overflow: auto;
            position: relative;
        }
        
        .highlighted-text > ol {
            padding-left: 20px;
        }
        
        .highlighted-text li {
            cursor: pointer;
            margin-bottom: 3px;
            text-align: justify;
            text-justify: distribute;
        }
        
        .highlighted-text li:hover {
            font-weight: bold;
        }
        
        .close-highlighted-text {
            position: absolute;
            top: 2px;
            right: 2px;
        }
    </style>

    <span class="highlighted-text"></span>
</div>`;

export default class HighlightTextWidget extends RightPanelWidget {
    constructor() {
        super();

        this.closeHltButton = new CloseHltButton();
        this.child(this.closeHltButton);
    }

    get widgetTitle() {
        return "Highlighted Text";
    }

    isEnabled() {
        return super.isEnabled()
            && this.note.type === 'text'
            && !this.noteContext.viewScope.highlightedTextTemporarilyHidden
            && this.noteContext.viewScope.viewMode === 'default';
    }

    async doRenderBody() {
        this.$body.empty().append($(TPL));
        this.$hlt = this.$body.find('.highlighted-text');
        this.$body.find('.highlighted-text-widget').append(this.closeHltButton.render());
    }

    async refreshWithNote(note) {
        /*The reason for adding highlightedTextTemporarilyHiddenPrevious is to record whether the previous state of the highlightedText is hidden or displayed, 
        * and then let it be displayed/hidden at the initial time. 
        * If there is no such value, when the right panel needs to display toc but not highlighttext, every time the note content is changed, 
        * highlighttext Widget will appear and then close immediately, because getHlt function will consume time*/
        if (this.noteContext.viewScope.highlightedTextTemporarilyHiddenPrevious == true) {
            this.toggleInt(true);
        } else {
            this.toggleInt(false);
        }
        const hltLabel = note.getLabel('hideHighlightWidget');

        if (hltLabel?.value == "" || hltLabel?.value === "true") {
            this.toggleInt(false);
            this.triggerCommand("reEvaluateRightPaneVisibility");
            return;
        }

        let $hlt = "", hltLiCount = -1;

        let optionsHltColors = JSON.parse(options.get('highlightedTextColors'));
        let optionsHltBgColors = JSON.parse(options.get('highlightedTextBgColors'));
        //Obtained by `textEditor.config.get('fontColor.colors'), but this command can only be used in edit mode, so it is directly saved here
        const colorToValDic = { "Black": "hsl(0,0%,0%)", "Dim grey": "hsl(0,0%,30%)", "Grey": "hsl(0,0%,60%)", "Light grey": "hsl(0,0%,90%)", "White": "hsl(0,0%,100%)", "Red": "hsl(0,75%,60%)", "Orange": "hsl(30,75%,60%)", "Yellow": "hsl(60,75%,60%)", "Light green": "hsl(90,75%,60%)", "Green": "hsl(120,75%,60%)", "Aquamarine": "hsl(150,75%,60%)", "Turquoise": "hsl(180,75%,60%)", "Light blue": "hsl(210,75%,60%)", "Blue": "hsl(240,75%,60%)", "Purple": "hsl(270,75%,60%)" }
        const optionsHltColorsVal = optionsHltColors.map(color => colorToValDic[color]);
        const optionsHltBgColorsVal = optionsHltBgColors.map(color => colorToValDic[color]);
        // Check for type text unconditionally in case alwaysShowWidget is set
        if (this.note.type === 'text') {
            const { content } = await note.getNoteComplement();
            //hltColors/hltBgColors are the colors/background-color that appear in notes and in options 
            ({ $hlt, hltLiCount } = await this.getHlt(content, optionsHltColorsVal, optionsHltBgColorsVal));
        }
        this.$hlt.html($hlt);
        if ([undefined, "false"].includes(hltLabel?.value) && hltLiCount > 0) {
            this.toggleInt(true);
            this.noteContext.viewScope.highlightedTextTemporarilyHiddenPrevious = true;
        } else {
            this.toggleInt(false);
            this.noteContext.viewScope.highlightedTextTemporarilyHiddenPrevious = false;
        }


        this.triggerCommand("reEvaluateRightPaneVisibility");
    }

    /**
     * Builds a jquery table of helight text.      
     */
    getHlt(html, optionsHltColorsVal, optionsHltBgColorsVal) {
        const hltTagsRegex = /<span[^>]*(?:background-color|color):[^;>]+;[^>]*>(.*?)<\/span>/gi;
        let prevEndIndex = -1;
        let prevLiDisplay = false;
        const $hlt = $("<ol>");
        let hltLiCount = 0;
        for (let match = null, hltIndex = 0; ((match = hltTagsRegex.exec(html)) !== null); hltIndex++) {
            var spanHtml = match[0];
            const styleString = match[0].match(/style="(.*?)"/)[1];
            const text = match[1];
            const startIndex = match.index;
            const endIndex = hltTagsRegex.lastIndex - 1;
            var $li = $('<li>');

            const styles = styleString
                .split(';')
                .filter(item => item.includes('background-color') || item.includes('color'))
                .map(item => item.trim());

            for (let stylesIndex = 0; stylesIndex < styles.length; stylesIndex++) {
                var [color, colorVal] = styles[stylesIndex].split(':');
                colorVal = colorVal.replace(/\s+/g, '');
                if (color == "color" && optionsHltColorsVal.indexOf(colorVal) >= 0) {
                    $li.html(spanHtml)
                    hltLiCount++;

                }
                else if (color == "background-color" && optionsHltBgColorsVal.indexOf(colorVal) >= 0) {

                    //When you need to add a background color, in order to make the display more comfortable, change the background color to Translucent
                    const spanHtmlRegex = /background-color:\s*(hsl|rgb)\((\d{1,3}),(\d{1,3}%?),(\d{1,3}%?)\)/i;
                    let spanHtmlMatch = spanHtml.match(spanHtmlRegex);
                    if (spanHtmlMatch && spanHtmlMatch.length > 4) {
                        let newColorValue = `${spanHtmlMatch[1]}a(${spanHtmlMatch[2]},${spanHtmlMatch[3]},${spanHtmlMatch[4]},0.5)`;
                        spanHtml = spanHtml.replace(spanHtmlRegex, `background-color: ${newColorValue}`);
                    }
                    $li.html(spanHtml)
                    hltLiCount++;

                } else {
                    $li.css("display", "none");
                }
            }
            if ($li.css("display")!="none"){
                if (prevEndIndex != -1 && startIndex === prevEndIndex + 1 && prevLiDisplay == true) {
                    $hlt.children().last().append($li.html());
                } else {
                    if ($li.text().trim() == "") { $li.css("display", "none"); }
                    $li.on("click", () => this.jumpToHlt(hltIndex));
                    $hlt.append($li);
                }
            }

            prevEndIndex = endIndex;
            prevLiDisplay = $li.css("display")!="none";
        }
        return {
            $hlt,
            hltLiCount
        };
    }

    async jumpToHlt(hltIndex) {
        const isReadOnly = await this.noteContext.isReadOnly();
        if (isReadOnly) {
            const $container = await this.noteContext.getContentElement();
            const hltElement = $container.find(`span[style*="background-color"],span[style*="color"]`)[hltIndex];

            if (hltElement != null) {
                hltElement.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        } else {
            const textEditor = await this.noteContext.getTextEditor();
            $(textEditor.editing.view.domRoots.values().next().value).find(`span[style*="background-color"],span[style*="color"]`)[hltIndex].scrollIntoView({
                behavior: "smooth", block: "center"
            });
        }
    }

    async closeHltCommand() {
        this.noteContext.viewScope.highlightedTextTemporarilyHidden = true;
        await this.refresh();
        this.triggerCommand('reEvaluateRightPaneVisibility');
    }

    async entitiesReloadedEvent({ loadResults }) {
        if (loadResults.isNoteContentReloaded(this.noteId)) {
            await this.refresh();
        } else if (loadResults.getAttributes().find(attr => attr.type === 'label'
            && (attr.name.toLowerCase().includes('readonly') || attr.name === 'hideHighlightWidget')
            && attributeService.isAffecting(attr, this.note))) {
            await this.refresh();
        }
    }
}


class CloseHltButton extends OnClickButtonWidget {
    constructor() {
        super();

        this.icon("bx-x")
            .title("Close HighlightTextWidget")
            .titlePlacement("bottom")
            .onClick((widget, e) => {
                e.stopPropagation();

                widget.triggerCommand("closeHlt");
            })
            .class("icon-action close-highlighted-text");
    }
}
