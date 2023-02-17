import utils from "../../services/utils.js";
import BasicWidget from "../basic_widget.js";

const TPL = `
<div class="help-dialog modal" tabindex="-1" role="dialog">
    <div class="modal-dialog" role="document" style="min-width: 100%; height: 100%; margin: 0;">
        <div class="modal-content" style="height: auto;">
            <div class="modal-header">
                <h5 class="modal-title mr-auto">Help (full documentation is available <a class="external" href="https://github.com/zadam/trilium/wiki">online</a>)</h5>

                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body" style="overflow: auto; height: calc(100vh - 70px);">
                <div class="card-columns help-cards">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">Note navigation</h5>

                            <p class="card-text">
                                <ul>
                                    <li><kbd>UP</kbd>, <kbd>DOWN</kbd> - go up/down in the list of notes</li>
                                    <li><kbd>LEFT</kbd>, <kbd>RIGHT</kbd> - collapse/expand node</li>
                                    <li><kbd data-command="backInNoteHistory">not set</kbd>, <kbd data-command="forwardInNoteHistory">not set</kbd> - go back / forwards in the history</li>
                                    <li><kbd data-command="jumpToNote">not set</kbd> - show <a class="external" href="https://github.com/zadam/trilium/wiki/Note-navigation#jump-to-note">"Jump to" dialog</a></li>
                                    <li><kbd data-command="scrollToActiveNote">not set</kbd> - scroll to active note</li>
                                    <li><kbd>Backspace</kbd> - jump to parent note</li>
                                    <li><kbd data-command="collapseTree">not set</kbd> - collapse whole note tree</li>
                                    <li><kbd data-command="collapseSubtree">not set</kbd> - collapse sub-tree</li>
                                </ul>
                            </p>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">Tab shortcuts</h5>

                            <p class="card-text">
                            <ul>
                                <li><kbd>CTRL+click</kbd> (or middle mouse click) on note link opens note in a new tab</li>
                            </ul>

                            Only in desktop (electron build):
                            <ul>
                                <li><kbd data-command="openNewTab">not set</kbd> open empty tab</li>
                                <li><kbd data-command="closeActiveTab">not set</kbd> close active tab</li>
                                <li><kbd data-command="activateNextTab">not set</kbd> activate next tab</li>
                                <li><kbd data-command="activatePreviousTab">not set</kbd> activate previous tab</li>
                            </ul>
                            </p>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">Creating notes</h5>

                            <p class="card-text">
                                <ul>
                                    <li><kbd data-command="createNoteAfter">not set</kbd> - create new note after the active note</li>
                                    <li><kbd data-command="createNoteInto">not set</kbd> - create new sub-note into active note</li>
                                    <li><kbd data-command="editBranchPrefix">not set</kbd> - edit <a class="external" href="https://github.com/zadam/trilium/wiki/Tree concepts#prefix">prefix</a> of active note clone</li>
                                </ul>
                            </p>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">Moving / cloning notes</h5>

                            <p class="card-text">
                                <ul>
                                    <li><kbd data-command="moveNoteUp">not set</kbd>, <kbd data-command="moveNoteDown">not set</kbd> - move note up/down in the note list</li>
                                    <li><kbd data-command="moveNoteUpInHierarchy">not set</kbd>, <kbd data-command="moveNoteDownInHierarchy">not set</kbd> - move note up in the hierarchy</li>
                                    <li><kbd data-command="addNoteAboveToSelection">not set</kbd>, <kbd data-command="addNoteBelowToSelection">not set</kbd> - multi-select note above/below</li>
                                    <li><kbd data-command="selectAllNotesInParent">not set</kbd> - select all notes in the current level</li>
                                    <li><kbd>Shift+click</kbd> - select note</li>
                                    <li><kbd data-command="copyNotesToClipboard">not set</kbd> - copy active note (or current selection) into clipboard (used for <a class="external" href="https://github.com/zadam/trilium/wiki/Cloning notes">cloning</a>)</li>
                                    <li><kbd data-command="cutNotesToClipboard">not set</kbd> - cut current (or current selection) note into clipboard (used for moving notes)</li>
                                    <li><kbd data-command="pasteNotesFromClipboard">not set</kbd> - paste note(s) as sub-note into active note (which is either move or clone depending on whether it was copied or cut into clipboard)</li>
                                    <li><kbd data-command="deleteNotes">not set</kbd> - delete note / sub-tree</li>
                                </ul>
                            </p>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">Editing notes</h5>

                            <p class="card-text">
                                <ul>
                                    <li><kbd data-command="editNoteTitle">not set</kbd> in tree pane will switch from tree pane into note title. Enter from note title will switch focus to text editor.
                                        <kbd data-command="scrollToActiveNote">not set</kbd> will switch back from editor to tree pane.</li>
                                    <li><kbd>Ctrl+K</kbd> - create / edit external link</li>
                                    <li><kbd data-command="addLinkToText">not set</kbd> - create internal link</li>
                                    <li><kbd data-command="followLinkUnderCursor">not set</kbd> - follow link under cursor</li>
                                    <li><kbd data-command="insertDateTimeToText">not set</kbd> - insert current date and time at caret position</li>
                                    <li><kbd data-command="scrollToActiveNote">not set</kbd> - jump away to the tree pane and scroll to active note</li>
                                </ul>
                            </p>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title"><a class="external" href="https://github.com/zadam/trilium/wiki/Text-notes#autoformat">Markdown-like autoformatting</a></h5>

                            <p class="card-text">
                                <ul>
                                    <li><kbd>##</kbd>, <kbd>###</kbd>, <kbd>####</kbd> etc. followed by space for headings</li>
                                    <li><kbd>*</kbd> or <kbd>-</kbd> followed by space for bullet list</li>
                                    <li><kbd>1.</kbd> or <kbd>1)</kbd> followed by space for numbered list</li>
                                    <li>start a line with <kbd>&gt;</kbd> followed by space for block quote</li>
                                </ul>
                            </p>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">Troubleshooting</h5>

                            <p class="card-text">
                                <ul>
                                    <li><kbd data-command="reloadFrontendApp">not set</kbd> - reload Trilium frontend</li>
                                    <li><kbd data-command="openDevTools">not set</kbd> - show developer tools</li>
                                    <li><kbd data-command="showSQLConsole">not set</kbd> - show SQL console</li>
                                </ul>
                            </p>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">Other</h5>

                            <p class="card-text">
                                <ul>
                                    <li><kbd data-command="quickSearch">not set</kbd> - focus on quick search input</li>
                                    <li><kbd data-command="findInText">not set</kbd> - in page search</li>
                                </ul>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>`;

export default class HelpDialog extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);
    }

    showHelpEvent() {
        utils.openDialog(this.$widget);
    }
}
