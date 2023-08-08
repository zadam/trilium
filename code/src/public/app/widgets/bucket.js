import NoteContextAwareWidget from "./note_context_aware_widget.js";
import AttributeDetailWidget from "./attribute_widgets/attribute_detail.js";
import froca from "../services/froca.js";
const TPL = `
<div class="bucket-details">
<style>
  .bucket-details {
    display: grid;
    grid-template-columns: 20em 150px;
    grid-template-rows: 45px 45px 45px 45px;
    font-family: var(--detail-font-family);
    align-items: center
  }

 </style>
<h5>Dashboard</h4>
<button class="dashboard-bucket-button">dashboard</button>
<h5>Default swimlane</h4>
<button class="default-bucket-button">default swimlane</button>
<h5 class="attr-detail-title">Done Bucket</h4>
<button class="done-bucket-button">done bucket</button>
<h5>De-prioritized Bucket</h4>
<button class="deprioritized-bucket-button">de-prioritized</button>
</div>`;

export default class BucketWidget extends NoteContextAwareWidget {
    constructor() {
        super();

        this.createDefaultAttrs();

        this.attributeDetailWidget = new AttributeDetailWidget()
        .contentSized()
        .setParent(this);
    }
    static getType() { return "bucket"; }

    doRender() {
        this.$widget = $(TPL);
        
        this.$buttons = {
            doneTasksParent:  this.$widget.find('.done-bucket-button'),
            deprioTasksParent:  this.$widget.find('.deprioritized-bucket-button'),
            dashboardParent: this.$widget.find('.dashboard-bucket-button'),
            defaultBucketParent: this.$widget.find('.default-bucket-button')
        };

        this.$widget.append(this.attributeDetailWidget.render());

        this.updateButtons((name, b) => {
            b.on('click', async (e) => {
                if (!this.$attrs[name]) {
                    return;
                }

                await this.attributeDetailWidget.refresh();

                const rect = e.target.getBoundingClientRect();
                await this.createRelation(name, (rect.left + rect.right) / 2, rect.bottom);
            });
        });

        super.doRender(); 
    }

    createDefaultAttrs() {

        const createDefaultAttr = (name) => {
            return {
                name,
                type: 'relation',
                value: '',
                noteId: this.noteId,
                isInheritable: false
            };
        };

        this.$attrs = {
            doneTasksParent: createDefaultAttr('doneTasksParent'),
            deprioTasksParent: createDefaultAttr('deprioTasksParent'),
            dashboardParent: createDefaultAttr('dashboardParent'),
            defaultBucketParent: createDefaultAttr('defaultBucketParent')
        };        
    }

    isEnabled() {
        return super.isEnabled()
            && this.noteContext && this.noteContext.note && (this.noteContext.note.type == "bucket");
    }

    async createRelation(relationName, x, y) {

        const attrs = [this.$attrs[relationName]];
        await this.attributeDetailWidget.showAttributeDetail({
            allAttributes: attrs,
            attribute: this.$attrs[relationName],
            isOwned: true,
            x,
            y,
            focus: 'name'
        });
    }

    async saveAttributesCommand() {
        const attr = this.attributeDetailWidget.attribute;
        await froca.createAttribute(this.noteId, attr);
        this.attributeDetailWidget.hide();        
    }

    updateButtons(callback) {
        for (const [name, btn] of Object.entries(this.$buttons)) {
            callback(name, btn);    
        }
    }

    enable_buttons() {
        this.updateButtons((_, b) => {
            b.html('Create');
            b.prop('disabled', false);
        });
    }

    disable_buttons() {
        this.$attrs = {
            doneTasksParent: {},
            deprioTasksParent: {},
            dashboardParent: {},
            defaultBucketParent: {}
        };  

        this.updateButtons((_, b) => {
            b.html('Create');
            b.prop('disabled', true);
        });
    }

    getAttr(note, attrName, callback) {
        froca.getAttributes(note.noteId).then(attrs =>{
            for(const i in attrs) {
                const attr = attrs[i];
                if (attr.name === attrName) {
                    callback(attr);
                }
            }
        });
    }

    async refreshWithNote(note) {
        if (note.type !== 'bucket') {
            this.disable_buttons();
            return;
        }

        const updateAttr = (attrName) => {
            this.getAttr(note, attrName, v => {
                this.$attrs[attrName] = {
                    attributeId: v.attributeId,
                    name: v.name,
                    type: v.type,
                    value: v.value,
                    noteId: v.noteId
                };
                this.$buttons[attrName].html('Edit');
            });
        };

        this.enable_buttons();
        this.createDefaultAttrs();
        
        this.$note = note;

        updateAttr('doneTasksParent');
        updateAttr('deprioTasksParent');
        updateAttr('dashboardParent');
        updateAttr('defaultBucketParent');
    }
}