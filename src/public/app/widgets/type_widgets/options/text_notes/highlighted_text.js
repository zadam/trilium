import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section">
    <h4>Highlighted Text</h4>

    <p>You can customize the highlighted text displayed in the right panel:</p>

    </div>
    <label><input type="checkbox" class="highlighted-text-check" value="bold"> Bold font &nbsp;</label>
    <label><input type="checkbox" class="highlighted-text-check" value="italic"> Italic font &nbsp;</label>
    <label><input type="checkbox" class="highlighted-text-check" value="underline"> Underlined font &nbsp;</label>
    <label><input type="checkbox" class="highlighted-text-check" value="color"> Font with color &nbsp;</label>
    <label><input type="checkbox" class="highlighted-text-check" value="bgColor"> Font with background color &nbsp;</label>
    </div>
</div>`;

export default class HighlightedTextOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$hlt = this.$widget.find("input.highlighted-text-check");
        this.$hlt.on('change', () => {
            const hltVals = this.$widget.find('input.highlighted-text-check[type="checkbox"]:checked').map(function () {
                return this.value;
            }).get();
            this.updateOption('highlightedText', JSON.stringify(hltVals));
        });
    }

    async optionsLoaded(options) {
        const hltVals = JSON.parse(options.highlightedText);
        this.$widget.find('input.highlighted-text-check[type="checkbox"]').each(function () {
            if ($.inArray($(this).val(), hltVals) !== -1) {
                $(this).prop("checked", true);
            } else {
                $(this).prop("checked", false);
            }
        });
    }
}
