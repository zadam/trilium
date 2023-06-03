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
            word-wrap: break-word;
            hyphens: auto;
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

        const optionsHlt = JSON.parse(options.get('highlightedText'));

        if (hltLabel?.value == "" || hltLabel?.value === "true" || optionsHlt == "") {
            this.toggleInt(false);
            this.triggerCommand("reEvaluateRightPaneVisibility");
            return;
        }

        let $hlt = "", hltLiCount = -1;
        // Check for type text unconditionally in case alwaysShowWidget is set
        if (this.note.type === 'text') {
            const { content } = await note.getNoteComplement();
            //hltColors/hltBgColors are the colors/background-color that appear in notes and in options 
            ({ $hlt, hltLiCount } = await this.getHlt(content, optionsHlt));
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
    getHlt(html, optionsHlt) {
        // element priority： span>i>strong>u
        // matches a span containing background-color
        const regex1 = /<span[^>]*style\s*=\s*[^>]*background-color:[^>]*?>[\s\S]*?<\/span>/gi; 
        // matches a span containing color
        const regex2 = /<span[^>]*style\s*=\s*[^>]*[^-]color:[^>]*?>[\s\S]*?<\/span>/gi;
        // match italics
        const regex3 = /<i>[\s\S]*?<\/i>/gi;
        // match bold
        const regex4 = /<strong>[\s\S]*?<\/strong>/gi;
        // match underline
        const regex5 = /<u>[\s\S]*?<\/u>/g;
        // Possible values in optionsHlt： '["bold","italic","underline","color","bgColor"]'
        let findSubStr="", combinedRegexStr = "";
        if (optionsHlt.indexOf("bgColor") >= 0){
            findSubStr+=`,span[style*="background-color"]`;
            combinedRegexStr+=`|${regex1.source}`;
        }
        if (optionsHlt.indexOf("color") >= 0){
            findSubStr+=`,span[style*="color"]`;
            combinedRegexStr+=`|${regex2.source}`;
        }
        if (optionsHlt.indexOf("italic") >= 0){
            findSubStr+=`,i`;
            combinedRegexStr+=`|${regex3.source}`;
        }
        if (optionsHlt.indexOf("bold") >= 0){
            findSubStr+=`,strong`;
            combinedRegexStr+=`|${regex4.source}`;
        }
        if (optionsHlt.indexOf("underline") >= 0){
            findSubStr+=`,u`;
            combinedRegexStr+=`|${regex5.source}`;
        }

        findSubStr = findSubStr.substring(1)
        combinedRegexStr = `(` + combinedRegexStr.substring(1) + `)`;
        const combinedRegex = new RegExp(combinedRegexStr, 'gi');
        let $hlt = $("<ol>");
        let prevEndIndex = -1, hltLiCount = 0;
        for (let match = null, hltIndex=0; ((match = combinedRegex.exec(html)) !== null); hltIndex++) {
            var subHtml = match[0];
            const startIndex = match.index;
            const endIndex = combinedRegex.lastIndex;
            if (prevEndIndex != -1 && startIndex === prevEndIndex) {
                $hlt.children().last().append(subHtml);
            } else {
                if ([...subHtml.matchAll(/(?<=^|>)[^><]+?(?=<|$)/g)].map(matchTmp => matchTmp[0]).join('').trim() != ""){
                    var $li = $('<li>');
                    $li.html(subHtml);
                    $li.on("click", () => this.jumpToHlt(findSubStr,hltIndex));
                    $hlt.append($li);
                    hltLiCount++;
                }else{
                    continue
                }
            }
            prevEndIndex = endIndex;
        }
        return {
            $hlt,
            hltLiCount
        };
    }
    async jumpToHlt(findSubStr,hltIndex) {
        const isReadOnly = await this.noteContext.isReadOnly();
        let targetElement;
        if (isReadOnly) {
            const $container = await this.noteContext.getContentElement();
            targetElement=$container.find(findSubStr).filter(function() {
                if (findSubStr.indexOf("color")>=0 &&  findSubStr.indexOf("background-color")<0){
                    let color = this.style.color;
                    return $(this).prop('tagName')=="SPAN" && color==""?false:true;
                }else{
                    return true;
                }                
            }).filter(function() {
                return $(this).parent(findSubStr).length === 0 
                && $(this).parent().parent(findSubStr).length === 0
                && $(this).parent().parent().parent(findSubStr).length === 0
                && $(this).parent().parent().parent().parent(findSubStr).length === 0;
            })
        } else {
            const textEditor = await this.noteContext.getTextEditor();
            targetElement=$(textEditor.editing.view.domRoots.values().next().value).find(findSubStr).filter(function() {
                // When finding span[style*="color"] but not looking for span[style*="background-color"], 
                // the background-color error will be regarded as color, so it needs to be filtered
                if (findSubStr.indexOf("color")>=0 &&  findSubStr.indexOf("background-color")<0){
                    let color = this.style.color;
                    return $(this).prop('tagName')=="SPAN" && color==""?false:true;
                }else{
                    return true;
                }                
            }).filter(function() {
                //Need to filter out the child elements of the element that has been found
                return $(this).parent(findSubStr).length === 0 
                && $(this).parent().parent(findSubStr).length === 0
                && $(this).parent().parent().parent(findSubStr).length === 0
                && $(this).parent().parent().parent().parent(findSubStr).length === 0;
            })
        }
        targetElement[hltIndex].scrollIntoView({
            behavior: "smooth", block: "center"
        });
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
