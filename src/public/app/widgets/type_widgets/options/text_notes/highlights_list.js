import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section">
    <h4>Highlights List</h4>

    <p>You can customize the highlights list displayed in the right panel:</p>

    </div>
        <label><input type="checkbox" class="highlights-list-check" value="bold"> Bold font &nbsp;</label>
        <label><input type="checkbox" class="highlights-list-check" value="italic"> Italic font &nbsp;</label>
        <label><input type="checkbox" class="highlights-list-check" value="underline"> Underlined font &nbsp;</label>
        <label><input type="checkbox" class="highlights-list-check" value="color"> Font with color &nbsp;</label>
        <label><input type="checkbox" class="highlights-list-check" value="bgColor"> Font with background color &nbsp;</label>
    </div>

    <br/><br/>
    <h5>Highlights List visibility</h5>

    <p>You can hide the highlights widget per-note by adding a <code>#hideHighlightWidget</code> label.</p>
</div>`;

export default class HighlightsListOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$hlt = this.$widget.find("input.highlights-list-check");
        this.$hlt.on('change', () => {
            const hltVals = this.$widget.find('input.highlights-list-check[type="checkbox"]:checked').map(function () {
                return this.value;
            }).get();
            this.updateOption('highlightsList', JSON.stringify(hltVals));
        });
    }

    async optionsLoaded(options) {
        const hltVals = JSON.parse(options.highlightsList);
        this.$widget.find('input.highlights-list-check[type="checkbox"]').each(function () {
            if ($.inArray($(this).val(), hltVals) !== -1) {
                $(this).prop("checked", true);
            } else {
                $(this).prop("checked", false);
            }
        });
    }
}
