import OptionsWidget from "../options_widget.js";
import utils from "../../../../services/utils.js";

const TPL = `
<div class="options-section">


    <h4>Search Engine</h4>
    
    <p>Custom search engine requires both a name and a URL to be set. If either of these is not set, DuckDuckGo will be used as the default search engine.</p>
    
    <form class="sync-setup-form">
        <div class="form-group">
            <label>Predefined search engine templates</label>
            <select class="predefined-search-engine-select form-control">
                <option value="Bing">Bing</option>
                <option value="Baidu">Baidu</option>
                <option value="Duckduckgo">Duckduckgo</option>
                <option value="Google">Google</option>
            </select>
        </div>
        
        <div class="form-group">
            <label>Custom search engine name</label>
            <input type="text" class="custom-search-engine-name form-control" placeholder="Customize search engine name">
        </div>
        
        <div class="form-group">
            <label>Custom search engine URL should include <code>{keyword}</code> as a placeholder for the search term.</label>
            <input type="text" class="custom-search-engine-url form-control" placeholder="Customize search engine url">
        </div>
        
        <div style="display: flex; justify-content: space-between;">
            <button class="btn btn-primary">Save</button>
        </div>
    </form>
</div>`;

const SEARCH_ENGINES = {
    "Bing": "https://www.bing.com/search?q={keyword}",
    "Baidu": "https://www.baidu.com/s?wd={keyword}",
    "Duckduckgo": "https://duckduckgo.com/?q={keyword}",
    "Google": "https://www.google.com/search?q={keyword}",
}

export default class SearchEngineOptions extends OptionsWidget {
    isEnabled() {
        return super.isEnabled() && utils.isElectron();
    }

    doRender() {
        this.$widget = $(TPL);

        this.$form = this.$widget.find(".sync-setup-form");
        this.$predefinedSearchEngineSelect = this.$widget.find(".predefined-search-engine-select");
        this.$customSearchEngineName = this.$widget.find(".custom-search-engine-name");
        this.$customSearchEngineUrl = this.$widget.find(".custom-search-engine-url");

        this.$predefinedSearchEngineSelect.on('change', () => {
            const predefinedSearchEngine = this.$predefinedSearchEngineSelect.val();
            this.$customSearchEngineName[0].value = predefinedSearchEngine;
            this.$customSearchEngineUrl[0].value = SEARCH_ENGINES[predefinedSearchEngine];
        });

        this.$form.on('submit', () => {
            this.updateMultipleOptions({
                'customSearchEngineName': this.$customSearchEngineName.val(),
                'customSearchEngineUrl': this.$customSearchEngineUrl.val()
            });
        });
    }

    async optionsLoaded(options) {
        this.$predefinedSearchEngineSelect.val("");
        this.$customSearchEngineName[0].value = options.customSearchEngineName;
        this.$customSearchEngineUrl[0].value = options.customSearchEngineUrl;
    }
}
