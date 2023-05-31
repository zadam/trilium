import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section" style='max-width: 46em;'>
    <style>
        .highlighted-text-label {
            display: inline-block;
            min-width: 8em;
        }
    </style>
    <h4>Highlighted Text</h4>
    
    Displays highlighted text in the right panel. You can customize the highlighted text displayed in the right panel:
    <br><strong>Text color:</strong><br>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-color" value="Dark"> Dark &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-color" value="Dim grey"> Dim grey &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-color" value="Grey"> Grey &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-color" value="Light grey"> Light grey &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-color" value="White"> White &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-color" value="Red"> Red &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-color" value="Orange"> Orange &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-color" value="Yellow"> Yellow &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-color" value="Light green"> Light green &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-color" value="Green"> Green &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-color" value="Aquamarine"> Aquamarine &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-color" value="Turquoise"> Turquoise &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-color" value="Light blue"> Light blue &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-color" value="Blue"> Blue &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-color" value="Purple"> Purple &nbsp;</label>
<br><strong>Background color:</strong><br>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-background-color" value="Dark"> Dark &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-background-color" value="Dim grey"> Dim grey &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-background-color" value="Grey"> Grey &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-background-color" value="Light grey"> Light grey &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-background-color" value="White"> White &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-background-color" value="Red"> Red &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-background-color" value="Orange"> Orange &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-background-color" value="Yellow"> Yellow &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-background-color" value="Light green"> Light green &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-background-color" value="Green"> Green &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-background-color" value="Aquamarine"> Aquamarine &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-background-color" value="Turquoise"> Turquoise &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-background-color" value="Light blue"> Light blue &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-background-color" value="Blue"> Blue &nbsp;</label>
<label class='highlighted-text-label'><input type="checkbox" class="highlighted-text-background-color" value="Purple"> Purple &nbsp;</label>  
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
