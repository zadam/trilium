import libraryLoader from "../../services/library_loader.js";
import server from "../../services/server.js";
import optionsService from "../../services/options.js";

const TPL = `
<h4>Widgets</h4>

<div id="widgets-configuration" class="row">
    <h5 class="col-6">Enabled widgets</h5>

    <h5 class="col-6">Disabled widgets</h5>

    <div id="widgets-enabled" class="list-group col"></div>

    <div id="widgets-disabled" class="list-group col"></div>
</div>`;

export default class SidebarOptions {
    constructor() {
        $("#options-sidebar").html(TPL);

        this.$widgetsConfiguration = $("#widgets-configuration");
        this.$widgetsEnabled = $("#widgets-enabled");
        this.$widgetsDisabled = $("#widgets-disabled");
    }

    async optionsLoaded(options) {
        this.$widgetsEnabled.empty();
        this.$widgetsDisabled.empty();

        const widgets = [
            {name: 'attributes', title: 'Attributes'},
            {name: 'linkMap', title: 'Link map'},
            {name: 'noteInfo', title: 'Note info'},
            {name: 'noteRevisions', title: 'Note revisions'},
            {name: 'whatLinksHere', title: 'What links here'},
            {name: 'similarNotes', title: 'Similar notes'},
            {name: 'editedNotes', title: 'Edited notes (only on day note)'},
            {name: 'calendar', title: 'Calendar (only on day note)'}
        ].map(widget => {
            widget.option = this.parseJsonSafely(options[widget.name + 'Widget']) || {
                enabled: true,
                expanded: true,
                position: 1000
            };

            return widget;
        });

        widgets.sort((a, b) => a.option.position - b.option.position);

        for (const {name, title, option} of widgets) {
            const $widgetTitle = $('<div class="widget-title">')
                .attr('data-widget-name', name)
                .append($("<span>").addClass("handle bx bx-move"))
                .append($("<span>").text(title));

            const $expandedCheckbox = $('<div class="expansion-conf">')
                .attr("title", "If checked, the widget will be by default expanded (opened)")
                .append($(`<input type="checkbox"${option.expanded ? ' checked' : ''}>`)
                    .attr('id', 'widget-exp-' + name)
                    .on('change', () => this.save()))
                .append("&nbsp;")
                .append($("<label>")
                    .attr("for", 'widget-exp-' + name)
                    .text(" expanded"));

            const $el = $('<div>')
                .addClass("list-group-item")
                .append($widgetTitle)
                .append($expandedCheckbox);

            (option.enabled ? this.$widgetsEnabled : this.$widgetsDisabled).append($el);
        }

        await libraryLoader.requireLibrary(libraryLoader.SORTABLE);

        new Sortable(this.$widgetsEnabled[0], {
            group: 'widgets',
            handle: '.handle',
            animation: 150,
            onSort: evt => this.save()
        });

        new Sortable(this.$widgetsDisabled[0], {
            group: 'widgets',
            handle: '.handle',
            animation: 150,
            onSort: evt => this.save()
        });
    }

    async save() {
        const opts = {};

        this.$widgetsConfiguration.find('.list-group-item').each((i, el) => {
            const widgetName = $(el).find('div[data-widget-name]').attr('data-widget-name');

            opts[widgetName + 'Widget'] = JSON.stringify({
                enabled: $.contains(this.$widgetsEnabled[0], el),
                expanded: $(el).find("input[type=checkbox]").is(":checked"),
                position: (i + 1) * 100
            });
        });

        await server.put('options', opts);

        optionsService.reloadOptions();
    }

    parseJsonSafely(str) {
        try {
            return JSON.parse(str);
        }
        catch (e) {
            return null;
        }
    }
}