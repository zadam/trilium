import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section" style='max-width: 46em;'>
    <style>
        .highlighted-text-checkbox-label {
            display: inline-block;
            min-width: 8em;
        }
    </style>
    <h4>Highlighted Text</h4>
    
    Displays highlighted text in the right panel. You can customize the highlighted text displayed in the right panel:
    <br><strong>Text color:</strong><br>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-color" value="#000000"> Dark &nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-color" value="#4d4d4d"> Dim grey &nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-color" value="#999999"> Grey &nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-color" value="#e6e6e6"> Light grey &nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-color" value="#ffffff"> White &nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-color" value="#e64c4c"> Red &nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-color" value="#e6994c"> Orange &nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-color" value="#e6e64c"> Yellow &nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-color" value="#99e64c"> Light green &nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-color" value="#4ce64c"> Green &nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-color" value="#4ce699"> Aquamarine &nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-color" value="#4ce6e6"> Turquoise &nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-color" value="#4c99e6"> Light blue &nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-color" value="#4c4ce6"> Blue &nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-color" value="#994ce6"> Purple &nbsp;</label>
<br><strong>Background color:</strong><br>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-background-color" value="#000000"> Dark&nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-background-color" value="#4d4d4d"> Dim grey&nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-background-color" value="#999999"> Grey&nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-background-color" value="#e6e6e6"> Light grey&nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-background-color" value="#ffffff"> White&nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-background-color" value="#e64c4c"> Red &nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-background-color" value="#e6994c"> Orange&nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-background-color" value="#e6e64c"> Yellow&nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-background-color" value="#99e64c"> Light green&nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-background-color" value="#4ce64c"> Green&nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-background-color" value="#4ce699"> Aquamarine&nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-background-color" value="#4ce6e6"> Turquoise&nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-background-color" value="#4c99e6"> Light blue&nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-background-color" value="#4c4ce6"> Blue&nbsp;</label>
<label class='highlighted-text-checkbox-label'><input type="checkbox" class="highlighted-text-background-color" value="#994ce6"> Purple&nbsp;</label>  
</div>`;

export default class HighlightedTextOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$hltColors = this.$widget.find(".highlighted-text-color");
        this.$hltColors.on('change', () => {
            const hltColorVals=this.$widget.find('input.highlighted-text-color[type="checkbox"]:checked').map(function() {
                return this.value;
              }).get();
            this.updateOption('highlightedTextColors', JSON.stringify(hltColorVals));

            });
        this.$hltBgColors = this.$widget.find(".highlighted-text-background-color");
        this.$hltBgColors.on('change', () =>{
            const hltBgColorVals=this.$widget.find('input.highlighted-text-background-color[type="checkbox"]:checked').map(function() {
                return this.value;
              }).get();
            this.updateOption('highlightedTextBgColors', JSON.stringify(hltBgColorVals));
        });
        
    }

    async optionsLoaded(options) {
        const hltColorVals=JSON.parse(options.highlightedTextColors);
        const hltBgColorVals=JSON.parse(options.highlightedTextBgColors);
        this.$widget.find('input.highlighted-text-color[type="checkbox"]').each(function () {
            if ($.inArray($(this).val(), hltColorVals) !== -1) {
                    $(this).prop("checked", true);
            } else {
                    $(this).prop("checked", false);
            }
        });
        this.$widget.find('input.highlighted-text-background-color[type="checkbox"]').each(function () {
            if ($.inArray($(this).val(), hltBgColorVals) !== -1) {
                    $(this).prop("checked", true);
            } else {
                    $(this).prop("checked", false);
            }
        });
    }
}
