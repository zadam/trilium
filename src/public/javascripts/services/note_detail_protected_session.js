import protectedSessionService from './protected_session.js';

class NoteDetailProtectedSession {
    /**
     * @param {NoteContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.$component = ctx.$noteTabContent.find(".protected-session-password-component");
        this.$passwordForm = ctx.$noteTabContent.find(".protected-session-password-form");
        this.$passwordInput = ctx.$noteTabContent.find(".protected-session-password");

        this.$protectButton = ctx.$noteTabContent.find(".protect-button");
        this.$protectButton.click(protectedSessionService.protectNoteAndSendToServer);

        this.$unprotectButton = ctx.$noteTabContent.find(".unprotect-button");
        this.$unprotectButton.click(protectedSessionService.unprotectNoteAndSendToServer);

        this.$passwordForm.submit(() => {
            const password = this.$passwordInput.val();
            this.$passwordInput.val("");

            protectedSessionService.setupProtectedSession(password);

            return false;
        });
    }

    show() {
        this.$component.show();
    }

    getContent() {}

    focus() {}

    onNoteChange() {}

    cleanup() {}

    scrollToTop() {
        this.$component.scrollTop(0);
    }
}

export default NoteDetailProtectedSession;