"use strict";

import server from '../../services/server.js';
import utils from "../../services/utils.js";
import BasicWidget from "../basic_widget.js";

const TPL = `
<div class="options-dialog modal fade mx-auto" tabindex="-1" role="dialog">
    <style>
        .options-dialog .nav {
            margin-right: 20px;
        }
        
        .options-dialog .tab-content {
            overflow-y: auto;
            max-height: 85vh;
        }
    </style>

    <div class="modal-dialog modal-lg" style="min-width: 1000px;" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Options</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <div style="display: flex">
                    <ul class="nav nav-tabs flex-column">
                        <li class="nav-item">
                            <a class="nav-link active" data-toggle="tab" href="#options-appearance">Appearance</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" data-toggle="tab" href="#options-shortcuts">Shortcuts</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" data-toggle="tab" href="#options-text-notes">Text notes</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" data-toggle="tab" href="#options-code-notes">Code notes</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" data-toggle="tab" href="#options-password">Password</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" data-toggle="tab" href="#options-etapi">ETAPI</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" data-toggle="tab" href="#options-backup">Backup</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" data-toggle="tab" href="#options-sync-setup">Sync</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" data-toggle="tab" href="#options-other">Other</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" data-toggle="tab" href="#options-advanced">Advanced</a>
                        </li>
                    </ul>
                    <br/>
                    <div class="tab-content">
                        <div id="options-appearance" class="tab-pane active"></div>
                        <div id="options-shortcuts" class="tab-pane"></div>
                        <div id="options-text-notes" class="tab-pane"></div>
                        <div id="options-code-notes" class="tab-pane"></div>
                        <div id="options-password" class="tab-pane"></div>
                        <div id="options-etapi" class="tab-pane"></div>
                        <div id="options-backup" class="tab-pane"></div>
                        <div id="options-sync-setup" class="tab-pane"></div>
                        <div id="options-other" class="tab-pane"></div>
                        <div id="options-advanced" class="tab-pane"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>`;


export default class OptionsDialog extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);
    }

    async showOptionsEvent({openTab}) {
        const options = await server.get('options');

        utils.openDialog(this.$widget);

        (await Promise.all([
            import('./options/appearance.js'),
            import('./options/shortcuts.js'),
            import('./options/text_notes.js'),
            import('./options/code_notes.js'),
            import('./options/password.js'),
            import('./options/etapi.js'),
            import('./options/backup.js'),
            import('./options/sync.js'),
            import('./options/other.js'),
            import('./options/advanced.js')
        ]))
            .map(m => new m.default)
            .forEach(tab => {
                if (tab.optionsLoaded) {
                    tab.optionsLoaded(options)
                }
            });

        if (openTab) {
            $(`.nav-link[href='#options-${openTab}']`).trigger("click");
        }
    }
}
