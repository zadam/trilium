import server from "../../../services/server.js";
import toastService from "../../../services/toast.js";
import OptionsTab from "./options_tab.js";

const TPL = `
<p><strong>Settings on this options tab are saved automatically after each change.</strong></p>

<div class="options-section">
    <h4>Heading style</h4>
    <select class="form-control" id="heading-style">
        <option value="plain">Plain</option>
        <option value="underline">Underline</option>
        <option value="markdown">Markdown-style</option>
    </select>
</div>
    
<div class="options-section">
    <h4>Table of contents</h4>
    
    Table of contents will appear in text notes when the note has more than a defined number of headings. You can customize this number:
    
    <div class="form-group">
        <input type="number" class="form-control" id="min-toc-headings" min="0" max="9999999999999999" step="1" style="text-align: right;"/>
    </div>
    
    <p>You can also use this option to effectively disable TOC by setting a very high number.</p>
</div>
    
<div class="options-section">
    <h4>Automatic readonly size</h4>

    <p>Automatic readonly note size is the size after which notes will be displayed in a readonly mode (for performance reasons).</p>

    <div class="form-group">
        <label for="auto-readonly-size-text">Automatic readonly size (text notes)</label>
        <input class="form-control" id="auto-readonly-size-text" type="number" min="0" style="text-align: right;">
    </div>
</div>`;

export default class TextNotesOptions extends OptionsTab {
    get tabTitle() { return "Text notes" }

    lazyRender() {
        this.$widget = $(TPL);
        this.$body = $("body");

        this.$headingStyle = this.$widget.find("#heading-style");
        this.$headingStyle.on('change', () => {
            const newHeadingStyle = this.$headingStyle.val();

            this.toggleBodyClass("heading-style-", newHeadingStyle);

            this.updateOption('headingStyle', newHeadingStyle);
        });

        this.$minTocHeadings = this.$widget.find("#min-toc-headings");
        this.$minTocHeadings.on('change', () =>
            this.updateOption('minTocHeadings', this.$minTocHeadings.val()));

        this.$autoReadonlySizeText = this.$widget.find("#auto-readonly-size-text");
        this.$autoReadonlySizeText.on('change', () =>
            this.updateOption('autoReadonlySizeText', this.$autoReadonlySizeText.val()));
    }

    toggleBodyClass(prefix, value) {
        for (const clazz of Array.from(this.$body[0].classList)) { // create copy to safely iterate over while removing classes
            if (clazz.startsWith(prefix)) {
                this.$body.removeClass(clazz);
            }
        }

        this.$body.addClass(prefix + value);
    }

    optionsLoaded(options) {
        this.$headingStyle.val(options.headingStyle);
        this.$minTocHeadings.val(options.minTocHeadings);
        this.$autoReadonlySizeText.val(options.autoReadonlySizeText);
    }
}
