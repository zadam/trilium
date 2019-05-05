class NoteDetailImage {
    /**
     * @param {NoteContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.$component = ctx.$noteTabContent.find(".protected-session-password-component");
        const $passwordForms = ctx.$noteTabContent.find(".protected-session-password-form");
        const $passwordInputs = ctx.$noteTabContent.find(".protected-session-password");
        const $passwordInModal = ctx.$noteTabContent.find(".protected-session-password-in-modal");
        const $protectButton = ctx.$noteTabContent.find(".protect-button");
        const $unprotectButton = ctx.$noteTabContent.find(".unprotect-button");
    }

    show() {
        this.$component.show();
    }
}