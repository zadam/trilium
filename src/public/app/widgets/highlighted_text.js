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
        const hltLabel = note.getLabel('hideHighlightWidget');

        if (hltLabel?.value=="" || hltLabel?.value=== "true") {
            this.toggleInt(false);
            this.triggerCommand("reEvaluateRightPaneVisibility");
            return;
        }

        let $hlt = "", hltColors = [], hltBgColors = [];

        let optionsHltColors = JSON.parse(options.get('highlightedTextColors'));
        let optionsHltBgColors = JSON.parse(options.get('highlightedTextBgColors'));
        const colorToValDic={"Dark": "#000000", "Dim grey": "#4d4d4d", "Grey": "#999999", "Light grey": "#e6e6e6", "White": "#ffffff", "Red": "#e64c4c", "Orange": "#e6994c", "Yellow": "#e6e64c", "Light green": "#99e64c", "Green": "#4ce64c", "Aquamarine": "#4ce699", "Turquoise": "#4ce6e6", "Light blue": "#4c99e6", "Blue": "#4c4ce6", "Purple": "#994ce6"}
        const optionsHltColorsVal = optionsHltColors.map(color => colorToValDic[color]);
        const optionsHltBgColorsVal = optionsHltBgColors.map(color => colorToValDic[color]);
        // Check for type text unconditionally in case alwaysShowWidget is set
        if (this.note.type === 'text') {
            const { content } = await note.getNoteComplement();
            //hltColors/hltBgColors are the colors/background-color that appear in notes and in options 
            ({ $hlt, hltColors, hltBgColors } = await this.getHlt(content, optionsHltColorsVal, optionsHltBgColorsVal));
        }
        this.$hlt.html($hlt);
        this.toggleInt(
            [undefined, "false"].includes(hltLabel?.value)
            || hltColors!="" 
            || hltBgColors!=""
        );

        this.triggerCommand("reEvaluateRightPaneVisibility");
    }
    //Converts color values in RGB, RGBA, or HSL format to hexadecimal format, removing transparency
    colorToHex(color) {
        function rgbToHex(rgb) {
            // Converts color values in RGB or RGBA format to hexadecimal format
            var rgba = rgb.match(/\d+/g);
            var r = parseInt(rgba[0]);
            var g = parseInt(rgba[1]);
            var b = parseInt(rgba[2]);
            var hex = "#";
            hex += (r < 16 ? "0" : "") + r.toString(16);
            hex += (g < 16 ? "0" : "") + g.toString(16);
            hex += (b < 16 ? "0" : "") + b.toString(16);
            return hex;
        }

        function hslToHex(hsl) {
            // Convert color values in HSL format to RGB format and then to hexadecimal format
            var hslValues = hsl.match(/\d+(\.\d+)?/g);
            var h = parseFloat(hslValues[0]) / 360;
            var s = parseFloat(hslValues[1]) / 100;
            var l = parseFloat(hslValues[2]) / 100;
            var r, g, b;

            if (s === 0) {
                r = g = b = l; // achromatic
            } else {
                function hueToRgb(p, q, t) {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1 / 6) return p + (q - p) * 6 * t;
                    if (t < 1 / 2) return q;
                    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                    return p;
                }

                var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                var p = 2 * l - q;
                r = hueToRgb(p, q, h + 1 / 3);
                g = hueToRgb(p, q, h);
                b = hueToRgb(p, q, h - 1 / 3);
            }

            var hex = "#";
            hex += (Math.round(r * 255) < 16 ? "0" : "") + Math.round(r * 255).toString(16);
            hex += (Math.round(g * 255) < 16 ? "0" : "") + Math.round(g * 255).toString(16);
            hex += (Math.round(b * 255) < 16 ? "0" : "") + Math.round(b * 255).toString(16);
            return hex;
        }
        if (color.indexOf("rgb") !== -1) {
            return rgbToHex(color);
        } else if (color.indexOf("hsl") !== -1) {
            return hslToHex(color);
        } else {
            return "";
        }
    }
    // Determine whether the highlighted color is in the options, avoid errors caused by errors in color conversion, 
    // and the error of each value is acceptable within 2
    hexIsInOptionHexs(targetColor, optionColors){
        for (let i = 0; i < optionColors.length; i++) {
            if (Math.abs(parseInt(optionColors[i].slice(1, 3), 16) - parseInt(targetColor.slice(1, 3), 16)) > 2) { continue; }
            if (Math.abs(parseInt(optionColors[i].slice(3, 5), 16) - parseInt(targetColor.slice(3, 5), 16)) > 2) { continue; }
            if (Math.abs(parseInt(optionColors[i].slice(5, 7), 16) - parseInt(targetColor.slice(5, 7), 16)) > 2) { continue; }
            return true;
        }
        return false;
    }
    /**
     * Builds a jquery table of helight text.      
     */
    getHlt(html, optionsHltColorsVal, optionsHltBgColorsVal) {
        const hltBCs = $(html).find(`span[style*="background-color"],span[style*="color"]`)
        const $hlt = $("<ol>");
        let hltColors = [];
        let hltBgColors = [];
        for (let hltIndex = 0; hltIndex<hltBCs.length; hltIndex++){
            const hltText = $(hltBCs[hltIndex]).clone();
            const color = $(hltBCs[hltIndex]).css("color");
            const bgColor =$(hltBCs[hltIndex]).css("background-color");
            let liDisplay = false;
            var $li = $('<li>');
            
            if (color != "") {
                var hexColor = this.colorToHex(color);
                if (this.hexIsInOptionHexs(hexColor,optionsHltColorsVal)) {                   
                    $li.html(hltText)
                    hltColors.push(hexColor);
                    liDisplay=true;
                }
            }
            if (bgColor != "") {
                var hexBgColor = this.colorToHex(bgColor);
                if (this.hexIsInOptionHexs(hexBgColor,optionsHltBgColorsVal)) {
                    //When you need to add a background color, in order to make the display more comfortable, change the background color to transparent
                    $li.html(hltText.css("background-color", hexBgColor+"80"))
                    hltBgColors.push(hexBgColor);
                    liDisplay=true;
                }              
            }
            if(!liDisplay){
                $li.css("display","none");
            }
            //The font color and background color may be nested or adjacent to each other. At this time, connect the front and back li to avoid interruption
            if(hltIndex!=0 && hltBCs[hltIndex-1].nextSibling === hltBCs[hltIndex] && $hlt.children().last().css("display")!="none"){
                $hlt.children().last().append($li.html());
            }else{
                $li.on("click", () => this.jumpToHlt(hltIndex));
                $hlt.append($li);
            }
            
        };
        return {
            $hlt,
            hltColors,
            hltBgColors
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
            && (attr.name.toLowerCase().includes('readonly') || attr.name === 'hlt')
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
