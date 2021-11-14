import BasicWidget from "../basic_widget.js";

const TPL = `
<div style="display: none;">
    <style>
        .global-menu-button-update-available-button {
            width: 21px !important;
            height: 21px !important;
            padding: 0 !important;
            
            border-radius: 8px;
            transform: scale(0.9);
            border: none;
            opacity: 0.8;
            
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .global-menu-button-wrapper:hover .global-menu-button-update-available-button {
            opacity: 1;
        }
    </style>
    
    <span class="bx bx-sync global-menu-button-update-available-button" title="Update available"></span>
</div>
`;

export default class UpdateAvailableWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);
    }

    updateVersionStatus(latestVersion) {
        this.$widget.toggle(latestVersion > glob.triliumVersion);
    }
}
