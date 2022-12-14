import AbstractLauncher from "./abstract_launcher.js";

export default class ScriptLauncher extends AbstractLauncher {
    constructor(launcherNote) {
        super(launcherNote);

        this.title(this.launcherNote.title)
            .icon(this.launcherNote.getIcon())
            .onClick(this.handler);
    }

    async launch() {
        const script = await this.launcherNote.getRelationTarget('script');

        await script.executeScript();
    }
}