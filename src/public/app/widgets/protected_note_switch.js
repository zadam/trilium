import NoteContextAwareWidget from "./note_context_aware_widget.js";
import protectedSessionService from "../services/protected_session.js";

const TPL = `
<div class="protected-note-switch">
    <style>    
    /* The switch - the box around the slider */
    .protected-note-switch .switch {
        position: relative;
        display: inline-block;
        width: 50px;
        height: 24px;
        float: right;
    }
    
    /* The slider */
    .protected-note-switch .slider {
        border-radius: 24px;
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--more-accented-background-color);
        transition: .4s;
    }
    
    .protected-note-switch .slider:before {
        border-radius: 50%;
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 4px;
        bottom: 4px;
        background-color: var(--main-background-color);
        -webkit-transition: .4s;
        transition: .4s;
    }
    
    .protected-note-switch .slider.checked {
        background-color: var(--main-text-color);
    }
    
    .protected-note-switch .slider.checked:before {
        transform: translateX(26px);
    }
    </style>

    <div class="protect-button">
        Protect the note
    
        &nbsp;
    
        <span title="Note is not protected, click to make it protected">
            <label class="switch">
            <span class="slider"></span>
        </span>
    </div>
    <div class="unprotect-button">
        Unprotect the note
        
        &nbsp;
    
        <span title="Note is protected, click to make it unprotected">
            <label class="switch">
            <span class="slider checked"></span>
        </span>
    </div>
</div>`;

export default class ProtectedNoteSwitchWidget extends NoteContextAwareWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$protectButton = this.$widget.find(".protect-button");
        this.$protectButton.on('click', () => protectedSessionService.protectNote(this.noteId, true, false));

        this.$unprotectButton = this.$widget.find(".unprotect-button");
        this.$unprotectButton.on('click', () => protectedSessionService.protectNote(this.noteId, false, false));
    }

    refreshWithNote(note) {
        this.$protectButton.toggle(!note.isProtected);
        this.$unprotectButton.toggle(!!note.isProtected);
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId)) {
            this.refresh();
        }
    }
}
