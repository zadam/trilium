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

        .options-dialog .options-section:first-of-type h4 {
            margin-top: 0;
        }
        
        .options-dialog .options-section h4 {
            margin-top: 15px;
            margin-bottom: 15px;
        }
        
        .options-dialog .options-section h5 {
            margin-top: 10px;
            margin-bottom: 10px;
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
                    <ul class="nav nav-tabs flex-column"></ul>
                    <br/>
                    <div class="tab-content"></div>
                </div>
            </div>
        </div>
    </div>
</div>`;


export default class OptionsDialog extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$navTabs = this.$widget.find(".nav-tabs");
        this.$tabContent = this.$widget.find(".tab-content");

        for (const child of this.children) {
            this.$navTabs.append(
                $('<li class="nav-item">')
                    .append(
                        $('<a class="nav-link" data-toggle="tab">')
                            .attr("href", '#options-' + child.constructor.name)
                            .text(child.tabTitle)
                    )
            );

            this.$tabContent.append(
                $('<div class="tab-pane">')
                    .attr("id", "options-" + child.constructor.name)
            );
        }
    }

    async showOptionsEvent({openTab}) {
        const optionPromise = server.get('options');

        for (const child of this.children) {
            child.lazyRender();

            this.$widget.find("#options-" + child.constructor.name)
                .empty()
                .append(child.$widget);
        }

        const options = await optionPromise;

        for (const child of this.children) {
            if (child.optionsLoaded) {
                child.optionsLoaded(options)
            }
        }

        await utils.openDialog(this.$widget);

        if (!openTab) {
            openTab = "AppearanceOptions";
        }

        this.$widget.find(`.nav-link[href='#options-${openTab}']`).trigger("click");
    }
}
