import utils from "../../services/utils.js";
import server from "../../services/server.js";
import toastService from "../../services/toast.js";

const TPL = `
<style>
.disabled-field {
    opacity: 0.5;
    pointer-events: none;
}
</style>

<div>
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
</div>

<div>
    <h4>Images</h4>
    
    <div class="form-group">
        <input id="download-images-automatically" type="checkbox" name="download-images-automatically">
        <label for="download-images-automatically">Download images automatically for offline use.</label>
        <p>(pasted HTML can contain references to online images, Trilium will find those references and download the images so that they are available offline)</p>
    </div>
    
    <div class="form-group">
        <input id="image-compresion-enabled" type="checkbox" name="image-compression-enabled">
        <label for="image-compresion-enabled">Enable image compression</label>
    </div>

    <div id="image-compression-enabled-wraper">
        <div class="form-group">
            <label for="image-max-width-height">Max width / height of an image in pixels (image will be resized if it exceeds this setting).</label>
            <input class="form-control" id="image-max-width-height" type="number" min="1">
        </div>
    
        <div class="form-group">
            <label for="image-jpeg-quality">JPEG quality (10 - worst quality, 100 best quality, 50 - 85 is recommended)</label>
            <input class="form-control" id="image-jpeg-quality" min="10" max="100" type="number">
        </div>
    </div>
</div>

<div>
    <h4>Note erasure timeout</h4>

    <p>Deleted notes (and attributes, revisions...) are at first only marked as deleted and it is possible to recover them 
    from Recent Notes dialog. After a period of time, deleted notes are "erased" which means 
    their content is not recoverable anymore. This setting allows you to configure the length 
    of the period between deleting and erasing the note.</p>

    <div class="form-group">
        <label for="erase-entities-after-time-in-seconds">Erase notes after X seconds</label>
        <input class="form-control" id="erase-entities-after-time-in-seconds" type="number" min="0">
    </div>
    
    <p>You can also trigger erasing manually:</p>
    
    <button id="erase-deleted-notes-now-button" class="btn">Erase deleted notes now</button>
    
    <br/><br/>
</div>

<div>
    <h4>Protected session timeout</h4>

    <p>Protected session timeout is a time period after which the protected session is wiped from
        the browser's memory. This is measured from the last interaction with protected notes. See <a href="https://github.com/zadam/trilium/wiki/Protected-notes" class="external">wiki</a> for more info.</p>

    <div class="form-group">
        <label for="protected-session-timeout-in-seconds">Protected session timeout (in seconds)</label>
        <input class="form-control" id="protected-session-timeout-in-seconds" type="number" min="60">
    </div>
</div>

<div>
    <h4>Note revisions snapshot interval</h4>

    <p>Note revision snapshot time interval is time in seconds after which a new note revision will be created for the note. See <a href="https://github.com/zadam/trilium/wiki/Note-revisions" class="external">wiki</a> for more info.</p>

    <div class="form-group">
        <label for="note-revision-snapshot-time-interval-in-seconds">Note revision snapshot time interval (in seconds)</label>
        <input class="form-control" id="note-revision-snapshot-time-interval-in-seconds" type="number" min="10">
    </div>
</div>

<div>
    <h4>Automatic readonly size</h4>

    <p>Automatic readonly note size is the size after which notes will be displayed in a readonly mode (for performance reasons).</p>

    <div class="form-group">
        <label for="auto-readonly-size-text">Automatic readonly size (text notes)</label>
        <input class="form-control" id="auto-readonly-size-text" type="number" min="0">
    </div>

    <div class="form-group">
        <label for="auto-readonly-size-code">Automatic readonly size (code notes)</label>
        <input class="form-control" id="auto-readonly-size-code" type="number" min="0">
    </div>
</div>`;

export default class ProtectedSessionOptions {
    constructor() {
        $("#options-other").html(TPL);

        this.$spellCheckEnabled = $("#spell-check-enabled");
        this.$spellCheckLanguageCode = $("#spell-check-language-code");

        this.$spellCheckEnabled.on('change', () => {
            const opts = { 'spellCheckEnabled': this.$spellCheckEnabled.is(":checked") ? "true" : "false" };
            server.put('options', opts).then(() => toastService.showMessage("Options changed have been saved."));

            return false;
        });

        this.$spellCheckLanguageCode.on('change', () => {
            const opts = { 'spellCheckLanguageCode': this.$spellCheckLanguageCode.val() };
            server.put('options', opts).then(() => toastService.showMessage("Options changed have been saved."));

            return false;
        });

        this.$availableLanguageCodes = $("#available-language-codes");

        if (utils.isElectron()) {
            const {webContents} = utils.dynamicRequire('@electron/remote').getCurrentWindow();

            this.$availableLanguageCodes.text(webContents.session.availableSpellCheckerLanguages.join(', '));
        }

        this.$eraseEntitiesAfterTimeInSeconds = $("#erase-entities-after-time-in-seconds");

        this.$eraseEntitiesAfterTimeInSeconds.on('change', () => {
            const eraseEntitiesAfterTimeInSeconds = this.$eraseEntitiesAfterTimeInSeconds.val();

            server.put('options', { 'eraseEntitiesAfterTimeInSeconds': eraseEntitiesAfterTimeInSeconds }).then(() => {
                toastService.showMessage("Options changed have been saved.");
            });

            return false;
        });

        this.$eraseDeletedNotesButton = $("#erase-deleted-notes-now-button");
        this.$eraseDeletedNotesButton.on('click', () => {
            server.post('notes/erase-deleted-notes-now').then(() => {
                toastService.showMessage("Deleted notes have been erased.");
            });
        });

        this.$protectedSessionTimeout = $("#protected-session-timeout-in-seconds");

        this.$protectedSessionTimeout.on('change', () => {
            const protectedSessionTimeout = this.$protectedSessionTimeout.val();

            server.put('options', { 'protectedSessionTimeout': protectedSessionTimeout }).then(() => {
                toastService.showMessage("Options changed have been saved.");
            });

            return false;
        });

        this.$noteRevisionsTimeInterval = $("#note-revision-snapshot-time-interval-in-seconds");

        this.$noteRevisionsTimeInterval.on('change', () => {
            const opts = { 'noteRevisionSnapshotTimeInterval': this.$noteRevisionsTimeInterval.val() };
            server.put('options', opts).then(() => toastService.showMessage("Options changed have been saved."));

            return false;
        });

        this.$imageMaxWidthHeight = $("#image-max-width-height");
        this.$imageJpegQuality = $("#image-jpeg-quality");

        this.$imageMaxWidthHeight.on('change', () => {
            const opts = { 'imageMaxWidthHeight': this.$imageMaxWidthHeight.val() };
            server.put('options', opts).then(() => toastService.showMessage("Options changed have been saved."));

            return false;
        });

        this.$imageJpegQuality.on('change', () => {
            const opts = { 'imageJpegQuality': this.$imageJpegQuality.val() };
            server.put('options', opts).then(() => toastService.showMessage("Options changed have been saved."));

            return false;
        });

        this.$autoReadonlySizeText = $("#auto-readonly-size-text");

        this.$autoReadonlySizeText.on('change', () => {
            const opts = { 'autoReadonlySizeText': this.$autoReadonlySizeText.val() };
            server.put('options', opts).then(() => toastService.showMessage("Options changed have been saved."));

            return false;
        });

        this.$autoReadonlySizeCode = $("#auto-readonly-size-code");

        this.$autoReadonlySizeCode.on('change', () => {
            const opts = { 'autoReadonlySizeCode': this.$autoReadonlySizeText.val() };
            server.put('options', opts).then(() => toastService.showMessage("Options changed have been saved."));

            return false;
        });

        this.$downloadImagesAutomatically = $("#download-images-automatically");

        this.$downloadImagesAutomatically.on("change", () => {
            const isChecked = this.$downloadImagesAutomatically.prop("checked");
            const opts = { 'downloadImagesAutomatically': isChecked ? 'true' : 'false' };

            server.put('options', opts).then(() => toastService.showMessage("Options changed have been saved."));
        });

        this.$enableImageCompression = $("#image-compresion-enabled");
        this.$imageCompressionWrapper = $("#image-compression-enabled-wraper");

        this.setImageCompression = (isChecked) => {
            if (isChecked) {
                this.$imageCompressionWrapper.removeClass("disabled-field");
            } else {
                this.$imageCompressionWrapper.addClass("disabled-field");
            }
        };

        this.$enableImageCompression.on("change", () => {
            const isChecked = this.$enableImageCompression.prop("checked");
            const opts = { 'compressImages': isChecked ? 'true' : 'false' };

            server.put('options', opts).then(() => toastService.showMessage("Options changed have been saved."));

            this.setImageCompression(isChecked);
        });
    }

    optionsLoaded(options) {
        this.$spellCheckEnabled.prop("checked", options['spellCheckEnabled'] === 'true');
        this.$spellCheckLanguageCode.val(options['spellCheckLanguageCode']);

        this.$eraseEntitiesAfterTimeInSeconds.val(options['eraseEntitiesAfterTimeInSeconds']);
        this.$protectedSessionTimeout.val(options['protectedSessionTimeout']);
        this.$noteRevisionsTimeInterval.val(options['noteRevisionSnapshotTimeInterval']);

        this.$imageMaxWidthHeight.val(options['imageMaxWidthHeight']);
        this.$imageJpegQuality.val(options['imageJpegQuality']);

        this.$autoReadonlySizeText.val(options['autoReadonlySizeText']);
        this.$autoReadonlySizeCode.val(options['autoReadonlySizeCode']);

        const downloadImagesAutomatically = options['downloadImagesAutomatically'] === 'true';
        this.$downloadImagesAutomatically.prop('checked', downloadImagesAutomatically);

        const compressImages = options['compressImages'] === 'true';
        this.$enableImageCompression.prop('checked', compressImages);
        this.setImageCompression(compressImages);
    }
}
