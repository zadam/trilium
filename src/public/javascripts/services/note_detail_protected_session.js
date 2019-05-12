import protectedSessionService from './protected_session.js';

class NoteDetailProtectedSession {
    /**
     * @param {TabContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.$component = ctx.$tabContent.find(".protected-session-password-component");
        this.$passwordForm = ctx.$tabContent.find(".protected-session-password-form");
        this.$passwordInput = ctx.$tabContent.find(".protected-session-password");

        this.$passwordForm.submit(() => {
            const password = this.$passwordInput.val();
            this.$passwordInput.val("");

            protectedSessionService.setupProtectedSession(password);

            return false;
        });
    }

    render() {
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