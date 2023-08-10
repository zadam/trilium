import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section">
    <h4>Ribbon widgets</h4>
    <label>
        <input type="checkbox" class="promoted-attributes-open-in-ribbon">
        Promoted Attributes ribbon tab will automatically open if promoted attributes are present on the note
    </label>
    
    <label>
        <input type="checkbox" class="edited-notes-open-in-ribbon">
        Edited Notes ribbon tab will automatically open on day notes
    </label>
</div>`;

export default class RibbonOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$promotedAttributesOpenInRibbon = this.$widget.find(".promoted-attributes-open-in-ribbon");
        this.$promotedAttributesOpenInRibbon.on('change', () =>
            this.updateCheckboxOption('promotedAttributesOpenInRibbon', this.$promotedAttributesOpenInRibbon));

        this.$editedNotesOpenInRibbon = this.$widget.find(".edited-notes-open-in-ribbon");
        this.$editedNotesOpenInRibbon.on('change', () =>
            this.updateCheckboxOption('editedNotesOpenInRibbon', this.$editedNotesOpenInRibbon));
    }

    async optionsLoaded(options) {
        this.setCheckboxState(this.$promotedAttributesOpenInRibbon, options.promotedAttributesOpenInRibbon);
        this.setCheckboxState(this.$editedNotesOpenInRibbon, options.editedNotesOpenInRibbon);
    }
}
