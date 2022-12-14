import NoteContextAwareWidget from "./note_context_aware_widget.js";

const TPL = `
<div class="switch-widget">
    <style>    
    .switch-widget {
        display: flex;
        align-items: center;
    }
    
    /* The switch - the box around the slider */
    .switch-widget .switch {
        position: relative;
        display: block;
        width: 50px;
        height: 24px;
        margin: 0;
    }
    
    .switch-on, .switch-off {
        display: flex;
    }
    
    /* The slider */
    .switch-widget .slider {
        border-radius: 24px;
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--more-accented-background-color);
        transition: .4s;
    }
    
    .switch-widget .slider:before {
        border-radius: 50%;
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 4px;
        bottom: 4px;
        background-color: var(--main-background-color);
        -webkit-transition: .4s;
        transition: .4s;
    }
    
    .switch-widget .slider.checked {
        background-color: var(--main-text-color);
    }
    
    .switch-widget .slider.checked:before {
        transform: translateX(26px);
    }
    
    .switch-widget .switch-disabled {
        opacity: 70%;
        pointer-events: none;
    }
    
    .switch-widget .switch-help-button {
        font-weight: 900;
        border: 0;
        background: none;
        cursor: pointer;
        color: var(--main-text-color);
    }
    </style>

    <div class="switch-on">
        <span class="switch-on-name"></span>
    
        &nbsp;
    
        <span class="switch-on-button">
            <label class="switch">
            <span class="slider"></span>
        </span>
    </div>
    <div class="switch-off">
        <span class="switch-off-name"></span>
        
        &nbsp;
    
        <span class="switch-off-button">
            <label class="switch">
            <span class="slider checked"></span>
        </span>
    </div>
    
    <button class="switch-help-button" type="button" data-help-page="" title="Open help page" style="display: none;">?</button>
</div>`;

export default class SwitchWidget extends NoteContextAwareWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$switchOn = this.$widget.find(".switch-on");
        this.$switchOnName = this.$widget.find(".switch-on-name");
        this.$switchOnButton = this.$widget.find(".switch-on-button");

        this.$switchOnButton.on('click', () => this.toggle(true));

        this.$switchOff = this.$widget.find(".switch-off");
        this.$switchOffName = this.$widget.find(".switch-off-name");
        this.$switchOffButton = this.$widget.find(".switch-off-button");

        this.$switchOffButton.on('click', () => this.toggle(false));

        this.$helpButton = this.$widget.find(".switch-help-button");

    }

    toggle(state) {
        if (state) {
            this.switchOn();
        } else {
            this.switchOff();
        }
    }

    switchOff() {}
    switchOn() {}
}
