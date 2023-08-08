import treeService from '../../services/tree.js';
import noteAutocompleteService from "../../services/note_autocomplete.js";
import utils from "../../services/utils.js";
import BasicWidget from "../basic_widget.js";

const TPL = `
<div class="add-link-dialog modal mx-auto" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg" style="max-width: 1000px" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title mr-auto">Add link</h5>

                <button type="button" class="help-button" title="Help on links" data-help-page="Links">?</button>

                <button type="button" class="close" data-dismiss="modal" aria-label="Close" style="margin-left: 0 !important;">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <form class="add-link-form">
                <div class="modal-body">
                    <div class="form-group">
                        <label for="add-link-note-autocomplete">Note</label>

                        <div class="input-group">
                            <input class="add-link-note-autocomplete form-control" placeholder="search for note by its name">
                        </div>
                    </div>

                    <div class="add-link-title-settings">
                        <div class="add-link-title-radios form-check">
                            <label class="form-check-label">
                                <input class="form-check-input" type="radio" name="link-type" value="reference-link" checked>
                                link title mirrors the note's current title
                            </label>
                        </div>
                        <div class="add-link-title-radios form-check">
                            <label class="form-check-label">
                                <input class="form-check-input" type="radio" name="link-type" value="hyper-link">
                                link title can be changed arbitrarily
                            </label>
                        </div>

                        <div class="add-link-title-form-group form-group">
                            <br/>
                            <label>
                                Link title
                                
                                <input class="link-title form-control" style="width: 100%;">
                            </label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="submit" class="btn btn-primary">Add link <kbd>enter</kbd></button>
                </div>
            </form>
        </div>
    </div>
</div>`;

export default class AddLinkDialog extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$form = this.$widget.find(".add-link-form");
        this.$autoComplete = this.$widget.find(".add-link-note-autocomplete");
        this.$linkTitle = this.$widget.find(".link-title");
        this.$addLinkTitleSettings = this.$widget.find(".add-link-title-settings");
        this.$addLinkTitleRadios = this.$widget.find(".add-link-title-radios");
        this.$addLinkTitleFormGroup = this.$widget.find(".add-link-title-form-group");

        /** @var TextTypeWidget */
        this.textTypeWidget = null;

        this.$form.on('submit', () => {
            if (this.$autoComplete.getSelectedNotePath()) {
                this.$widget.modal('hide');

                const linkTitle = this.getLinkType() === 'reference-link' ? null : this.$linkTitle.val();

                this.textTypeWidget.addLink(this.$autoComplete.getSelectedNotePath(), linkTitle);
            }
            else if (this.$autoComplete.getSelectedExternalLink()) {
                this.$widget.modal('hide');

                this.textTypeWidget.addLink(this.$autoComplete.getSelectedExternalLink(), this.$linkTitle.val());
            }
            else {
                logError("No link to add.");
            }

            return false;
        });
    }

    async showAddLinkDialogEvent({textTypeWidget, text = ''}) {
        this.textTypeWidget = textTypeWidget;

        this.$addLinkTitleSettings.toggle(!this.textTypeWidget.hasSelection());

        this.$addLinkTitleSettings.find('input[type=radio]').on('change', e => this.updateTitleSettingsVisibility(e));

        // with selection hyperlink is implied
        if (this.textTypeWidget.hasSelection()) {
            this.$addLinkTitleSettings.find("input[value='hyper-link']").prop("checked", true);
        }
        else {
            this.$addLinkTitleSettings.find("input[value='reference-link']").prop("checked", true);
        }

        this.updateTitleSettingsVisibility();

        utils.openDialog(this.$widget);

        this.$autoComplete.val('');
        this.$linkTitle.val('');

        const setDefaultLinkTitle = async noteId => {
            const noteTitle = await treeService.getNoteTitle(noteId);

            this.$linkTitle.val(noteTitle);
        };

        noteAutocompleteService.initNoteAutocomplete(this.$autoComplete, {
            allowExternalLinks: true,
            allowCreatingNotes: true
        });

        this.$autoComplete.on('autocomplete:noteselected', (event, suggestion, dataset) => {
            if (!suggestion.notePath) {
                return false;
            }

            this.updateTitleSettingsVisibility();

            const noteId = treeService.getNoteIdFromUrl(suggestion.notePath);

            if (noteId) {
                setDefaultLinkTitle(noteId);
            }
        });

        this.$autoComplete.on('autocomplete:externallinkselected', (event, suggestion, dataset) => {
            if (!suggestion.externalLink) {
                return false;
            }

            this.updateTitleSettingsVisibility();

            this.$linkTitle.val(suggestion.externalLink);
        });

        this.$autoComplete.on('autocomplete:cursorchanged',  (event, suggestion, dataset) => {
            if (suggestion.externalLink) {
                this.$linkTitle.val(suggestion.externalLink)
            }
            else {
                const noteId = treeService.getNoteIdFromUrl(suggestion.notePath);

                if (noteId) {
                    setDefaultLinkTitle(noteId);
                }
            }
        });

        if (text && text.trim()) {
            noteAutocompleteService.setText(this.$autoComplete, text);
        }
        else {
            noteAutocompleteService.showRecentNotes(this.$autoComplete);
        }

        this.$autoComplete
            .trigger('focus')
            .trigger('select'); // to be able to quickly remove entered text
    }

    getLinkType() {
        if (this.$autoComplete.getSelectedExternalLink()) {
            return 'external-link';
        }

        return this.$addLinkTitleSettings.find('input[type=radio]:checked').val();
    }

    updateTitleSettingsVisibility() {
        const linkType = this.getLinkType();

        this.$addLinkTitleFormGroup.toggle(linkType !== 'reference-link');
        this.$addLinkTitleRadios.toggle(linkType !== 'external-link')
    }
}
