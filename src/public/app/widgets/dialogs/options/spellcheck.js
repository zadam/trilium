import utils from "../../../services/utils.js";
import OptionsTab from "./options_tab.js";

const TPL = `
<div class="options-section">
    <h4>Spell check</h4>

    <p>These options apply only for desktop builds, browsers will use their own native spell check. App restart is required after change.</p>

    <div class="custom-control custom-checkbox">
        <input type="checkbox" class="custom-control-input" id="spell-check-enabled">
        <label class="custom-control-label" for="spell-check-enabled">Enable spellcheck</label>
    </div>

    <br/>

    <div class="form-group">
        <label for="spell-check-language-code">Language code(s)</label>
        <input type="text" class="form-control" id="spell-check-language-code" placeholder="for example &quot;en-US&quot;, &quot;de-AT&quot;">
    </div>

    <p>Multiple languages can be separated by comma, e.g. <code>en-US, de-DE, cs</code>. Changes to the spell check options will take effect after application restart.</p>
    
    <p><strong>Available language codes: </strong> <span id="available-language-codes"></span></p>
</div>`;

export default class SpellcheckOptions extends OptionsTab {
    get tabTitle() { return "Spellcheck" }

    lazyRender() {
        this.$widget = $(TPL);

        this.$spellCheckEnabled = this.$widget.find("#spell-check-enabled");
        this.$spellCheckLanguageCode = this.$widget.find("#spell-check-language-code");

        this.$spellCheckEnabled.on('change', () =>
            this.updateCheckboxOption('spellCheckEnabled', this.$spellCheckEnabled));

        this.$spellCheckLanguageCode.on('change', () =>
            this.updateOption('spellCheckLanguageCode', this.$spellCheckLanguageCode.val()));

        this.$availableLanguageCodes = this.$widget.find("#available-language-codes");

        if (utils.isElectron()) {
            const { webContents } = utils.dynamicRequire('@electron/remote').getCurrentWindow();

            this.$availableLanguageCodes.text(webContents.session.availableSpellCheckerLanguages.join(', '));
        }
    }

    optionsLoaded(options) {
        this.setCheckboxState(this.$spellCheckEnabled, options.spellCheckEnabled);
        this.$spellCheckLanguageCode.val(options.spellCheckLanguageCode);
    }
}
