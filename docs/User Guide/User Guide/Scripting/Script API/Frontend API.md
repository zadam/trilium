# Frontend API
## `FrontendApi`

The `api` global available inside **frontend** script notes (`application/javascript;env=frontend`).

<table>
    <thead>
        <tr>
            <th>Member</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>$container</code></td>
            <td><p><code>unknown</code><br>Container of all the rendered script content</p></td>
        </tr>
        <tr>
            <td><code>startNote</code></td>
            <td><p><code>ScriptFNote</code><br>Note where the script execution started — the entry point of the current script bundle (in C terms, the file containing <code>main()</code>). When a script is spread across multiple code notes (descendant code notes loaded as modules via <code>require()</code>), every note in the bundle shares the same <code>startNote</code>, while <code>currentNote</code> differs per note. Messages from <code>api.log()</code> are grouped under this note.</p></td>
        </tr>
        <tr>
            <td><code>currentNote</code></td>
            <td><p><code>ScriptFNote</code><br>Note containing the source code that is currently executing (in C terms, <code>__FILE__</code>). Equal to <code>startNote</code> unless execution has moved into a descendant module note loaded via <code>require()</code>. Don't confuse this with the note open in the UI — use <code>api.getActiveContextNote()</code> for that.</p></td>
        </tr>
        <tr>
            <td><code>originEntity</code></td>
            <td><p><code>unknown</code><br>Entity whose event triggered this execution, or <code>null</code>. Most frontend scripts are started by the user or by the UI (startup scripts, widgets), so this is usually <code>null</code>. It is set to a note when: - the script runs through a <code>~renderNote</code> relation — then it's the note being rendered (the one carrying the relation), not the script note; - a backend script calls <code>api.runOnFrontend()</code> — then it's the backend execution's <code>originEntity</code>, provided that entity was a note.</p></td>
        </tr>
        <tr>
            <td><code>dayjs</code></td>
            <td><p><code>ScriptDayjs</code><br>day.js library for date manipulation. See <code>https://day.js.org</code> for documentation</p></td>
        </tr>
        <tr>
            <td><code>RightPanelWidget</code></td>
            <td><p><code>WidgetClass&lt;RightPanelWidget&gt;</code><br>Base class for right-panel widgets — <code>class X extends api.RightPanelWidget { … }</code>.</p></td>
        </tr>
        <tr>
            <td><code>NoteContextAwareWidget</code></td>
            <td><p><code>WidgetClass&lt;NoteContextAwareWidget&gt;</code><br>Base class for note-context-aware widgets — <code>class X extends api.NoteContextAwareWidget { … }</code>.</p></td>
        </tr>
        <tr>
            <td><code>BasicWidget</code></td>
            <td><p><code>WidgetClass&lt;BasicWidget&gt;</code><br>Base class for basic widgets — <code>class X extends api.BasicWidget { … }</code>.</p></td>
        </tr>
        <tr>
            <td><code>activateNote</code></td>
            <td><pre><code class="language-application-typescript">activateNote(notePath: string): Promise&lt;void&gt;</code></pre><p>Activates note in the tree and in the note detail.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>notePath</code></td><td><code>string</code><br>(or noteId)</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>activateNewNote</code></td>
            <td><pre><code class="language-application-typescript">activateNewNote(notePath: string): Promise&lt;void&gt;</code></pre><p>Activates newly created note. Compared to this.activateNote() also makes sure that frontend has been fully synced.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>notePath</code></td><td><code>string</code><br>(or noteId)</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>openTabWithNote</code></td>
            <td><pre><code class="language-application-typescript">openTabWithNote(notePath: string, activate: boolean): Promise&lt;void&gt;</code></pre><p>Open a note in a new tab.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>notePath</code></td><td><code>string</code><br>(or noteId)</td></tr><tr><td><code>activate</code></td><td><code>boolean</code><br>set to true to activate the new tab, false to stay on the current tab</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>openSplitWithNote</code></td>
            <td><pre><code class="language-application-typescript">openSplitWithNote(notePath: string, activate: boolean): Promise&lt;void&gt;</code></pre><p>Open a note in a new split.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>notePath</code></td><td><code>string</code><br>(or noteId)</td></tr><tr><td><code>activate</code></td><td><code>boolean</code><br>set to true to activate the new split, false to stay on the current split</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>runOnBackend</code></td>
            <td><pre><code class="language-application-typescript">runOnBackend(func: Func, params?: unknown[]): Promise&lt;unknown&gt;</code></pre><p>Executes given anonymous function on the backend. Internally this serializes the anonymous function into string and sends it to backend via AJAX. Please make sure that the supplied function is synchronous. Only sync functions will work correctly with transaction management. If you really know what you're doing, you can call api.runAsyncOnBackendWithManualTransactionHandling()</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>func</code></td><td><code>Func</code><br>(synchronous) function to be executed on the backend</td></tr><tr><td><code>params</code><br><em>optional</em></td><td><code>unknown[]</code><br>list of parameters to the anonymous function to be sent to backend</td></tr></tbody></table></figure><p><strong>Returns</strong> <code>Promise&lt;unknown&gt;</code>: return value of the executed function on the backend</p></td>
        </tr>
        <tr>
            <td><code>runAsyncOnBackendWithManualTransactionHandling</code></td>
            <td><pre><code class="language-application-typescript">runAsyncOnBackendWithManualTransactionHandling(func: Func, params?: unknown[]): Promise&lt;unknown&gt;</code></pre><p>Executes given anonymous function on the backend. Internally this serializes the anonymous function into string and sends it to backend via AJAX. This function is meant for advanced needs where an async function is necessary. In this case, the automatic request-scoped transaction management is not applied, and you need to manually define transaction via api.transactional().</p><p>If you have a synchronous function, please use api.runOnBackend().</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>func</code></td><td><code>Func</code><br>(synchronous) function to be executed on the backend</td></tr><tr><td><code>params</code><br><em>optional</em></td><td><code>unknown[]</code><br>list of parameters to the anonymous function to be sent to backend</td></tr></tbody></table></figure><p><strong>Returns</strong> <code>Promise&lt;unknown&gt;</code>: return value of the executed function on the backend</p></td>
        </tr>
        <tr>
            <td><code>isBackendScriptingEnabled</code></td>
            <td><pre><code class="language-application-typescript">isBackendScriptingEnabled(): boolean</code></pre><p>Whether backend script execution is enabled on the server (the <code>[Security] backendScriptingEnabled</code> config toggle). When it's disabled, <code>api.runOnBackend()</code> / <code>api.runAsyncOnBackendWithManualTransactionHandling()</code> reject with a "Backend script execution is disabled" error, so check this first to let a script degrade gracefully instead of throwing.</p></td>
        </tr>
        <tr>
            <td><code>isSqlConsoleEnabled</code></td>
            <td><pre><code class="language-application-typescript">isSqlConsoleEnabled(): boolean</code></pre><p>Whether the SQL console is enabled on the server (the <code>[Security] sqlConsoleEnabled</code> config toggle). When it's disabled, backend scripts that run raw SQL (<code>api.sql.*</code>) fail, so check this before invoking SQL-backed logic via <code>api.runOnBackend()</code>.</p></td>
        </tr>
        <tr>
            <td><code>searchForNotes</code></td>
            <td><pre><code class="language-application-typescript">searchForNotes(searchString: string): Promise&lt;ScriptFNote[]&gt;</code></pre><p>This is a powerful search method - you can search by attributes and their values, e.g.: "#dateModified =* MONTH AND #log". See full documentation for all options at: <a href="https://triliumnext.github.io/Docs/Wiki/search.html">https://triliumnext.github.io/Docs/Wiki/search.html</a></p></td>
        </tr>
        <tr>
            <td><code>searchForNote</code></td>
            <td><pre><code class="language-application-typescript">searchForNote(searchString: string): Promise&lt;ScriptFNote | null&gt;</code></pre><p>This is a powerful search method - you can search by attributes and their values, e.g.: "#dateModified =* MONTH AND #log". See full documentation for all options at: <a href="https://triliumnext.github.io/Docs/Wiki/search.html">https://triliumnext.github.io/Docs/Wiki/search.html</a></p></td>
        </tr>
        <tr>
            <td><code>getNote</code></td>
            <td><pre><code class="language-application-typescript">getNote(noteId: string): Promise&lt;ScriptFNote | null&gt;</code></pre><p>Returns note by given noteId. If note is missing from the cache, it's loaded.</p></td>
        </tr>
        <tr>
            <td><code>getNotes</code></td>
            <td><pre><code class="language-application-typescript">getNotes(noteIds: string[], silentNotFoundError?: boolean): Promise&lt;ScriptFNote[]&gt;</code></pre><p>Returns list of notes. If note is missing from the cache, it's loaded.</p><p>This is often used to bulk-fill the cache with notes which would have to be picked one by one otherwise (by e.g. createLink())</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>noteIds</code></td><td><code>string[]</code></td></tr><tr><td><code>silentNotFoundError</code><br><em>optional</em></td><td><code>boolean</code><br>don't report error if the note is not found</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>reloadNotes</code></td>
            <td><pre><code class="language-application-typescript">reloadNotes(noteIds: string[]): Promise&lt;void&gt;</code></pre><p>Update frontend tree (note) cache from the backend.</p></td>
        </tr>
        <tr>
            <td><code>createNote</code></td>
            <td><pre><code class="language-application-typescript">createNote(parentNotePath: string, opts?: ScriptCreateNoteOpts): Promise&lt;{ note: ScriptFNote | null; branch: ScriptFBranch | undefined }&gt;</code></pre><p>Creates a new note as a child of the given parent, entirely on the frontend — no backend scripting required (unlike <code>api.runOnBackend(() =&gt; api.createTextNote(...))</code>). By default the new note is activated in the current tab with its title focused for editing; pass <code>{ activate: false }</code> to create it silently.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>parentNotePath</code></td><td><code>string</code><br>note path (or noteId) of the parent under which to create the note</td></tr><tr><td><code>opts</code><br><em>optional</em></td><td><code>ScriptCreateNoteOpts</code><br>creation options — e.g. <code>{ title, content, type, mime, activate }</code></td></tr></tbody></table></figure><p><strong>Returns</strong> <code>Promise&lt;{ note: ScriptFNote | null; branch: ScriptFBranch | undefined }&gt;</code>: the created note and its branch, resolved from the frontend cache</p></td>
        </tr>
        <tr>
            <td><code>getInstanceName</code></td>
            <td><pre><code class="language-application-typescript">getInstanceName(): string | null</code></pre><p>Instance name identifies particular Trilium instance. It can be useful for scripts if some action needs to happen on only one specific instance.</p></td>
        </tr>
        <tr>
            <td><code>addTextToActiveContextEditor</code></td>
            <td><pre><code class="language-application-typescript">addTextToActiveContextEditor(text: string): void</code></pre><p>Adds given text to the editor cursor</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>text</code></td><td><code>string</code><br>this must be clear text, HTML is not supported.</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>getActiveContextNote</code></td>
            <td><pre><code class="language-application-typescript">getActiveContextNote(): ScriptFNote</code></pre><p><strong>Returns</strong> <code>ScriptFNote</code>: active note (loaded into center pane)</p></td>
        </tr>
        <tr>
            <td><code>getActiveContext</code></td>
            <td><pre><code class="language-application-typescript">getActiveContext(): ScriptNoteContext</code></pre><p>Obtains the currently active/focused split in the current tab.</p><p>Note that this method does not return the note context of the "Quick edit" panel, it will return the note context behind it.</p></td>
        </tr>
        <tr>
            <td><code>getActiveMainContext</code></td>
            <td><pre><code class="language-application-typescript">getActiveMainContext(): ScriptNoteContext</code></pre><p>Obtains the main context of the current tab. This is the left-most split.</p><p>Note that this method does not return the note context of the "Quick edit" panel, it will return the note context behind it.</p></td>
        </tr>
        <tr>
            <td><code>getNoteContexts</code></td>
            <td><pre><code class="language-application-typescript">getNoteContexts(): ScriptNoteContext[]</code></pre><p><strong>Returns</strong> <code>ScriptNoteContext[]</code>: returns all note contexts (splits) in all tabs</p></td>
        </tr>
        <tr>
            <td><code>getMainNoteContexts</code></td>
            <td><pre><code class="language-application-typescript">getMainNoteContexts(): ScriptNoteContext[]</code></pre><p><strong>Returns</strong> <code>ScriptNoteContext[]</code>: returns all main contexts representing tabs</p></td>
        </tr>
        <tr>
            <td><code>getActiveContextTextEditor</code></td>
            <td><pre><code class="language-application-typescript">getActiveContextTextEditor(): Promise&lt;unknown&gt;</code></pre><p>See <a href="https://ckeditor.com/docs/ckeditor5/latest/api/module_core_editor_editor-Editor.html">https://ckeditor.com/docs/ckeditor5/latest/api/module_core_editor_editor-Editor.html</a> for documentation on the returned instance.</p><p><strong>Returns</strong> <code>Promise&lt;unknown&gt;</code>: instance of CKEditor</p></td>
        </tr>
        <tr>
            <td><code>getActiveContextCodeEditor</code></td>
            <td><pre><code class="language-application-typescript">getActiveContextCodeEditor(): Promise&lt;unknown&gt;</code></pre><p>See <a href="https://codemirror.net/doc/manual.html#api">https://codemirror.net/doc/manual.html#api</a></p><p><strong>Returns</strong> <code>Promise&lt;unknown&gt;</code>: instance of CodeMirror</p></td>
        </tr>
        <tr>
            <td><code>getActiveNoteDetailWidget</code></td>
            <td><pre><code class="language-application-typescript">getActiveNoteDetailWidget(): Promise&lt;unknown&gt;</code></pre><p>Get access to the widget handling note detail. Methods like <code>getWidgetType()</code> and <code>getTypeWidget()</code> to get to the implementation of actual widget type.</p></td>
        </tr>
        <tr>
            <td><code>getActiveContextNotePath</code></td>
            <td><pre><code class="language-application-typescript">getActiveContextNotePath(): string | null</code></pre><p><strong>Returns</strong> <code>string | null</code>: returns a note path of active note or null if there isn't active note</p></td>
        </tr>
        <tr>
            <td><code>getComponentByEl</code></td>
            <td><pre><code class="language-application-typescript">getComponentByEl(el: HTMLElement): unknown</code></pre><p>Returns component which owns the given DOM element (the nearest parent component in DOM tree)</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>el</code></td><td><code>HTMLElement</code><br>DOM element</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>showMessage</code></td>
            <td><pre><code class="language-application-typescript">showMessage(message: string, delay?: number): void</code></pre><p>Show an info toast message to the user.</p></td>
        </tr>
        <tr>
            <td><code>showError</code></td>
            <td><pre><code class="language-application-typescript">showError(message: string, delay?: number): void</code></pre><p>Show an error toast message to the user.</p></td>
        </tr>
        <tr>
            <td><code>showInfoDialog</code></td>
            <td><pre><code class="language-application-typescript">showInfoDialog(message: string): Promise&lt;void&gt;</code></pre><p>Show an info dialog to the user.</p></td>
        </tr>
        <tr>
            <td><code>showConfirmDialog</code></td>
            <td><pre><code class="language-application-typescript">showConfirmDialog(message: string): Promise&lt;boolean&gt;</code></pre><p>Show confirm dialog to the user.</p><p><strong>Returns</strong> <code>Promise&lt;boolean&gt;</code>: promise resolving to true if the user confirmed</p></td>
        </tr>
        <tr>
            <td><code>showPromptDialog</code></td>
            <td><pre><code class="language-application-typescript">showPromptDialog(props: { title?: string; message?: string; defaultValue?: string }): Promise&lt;string | null&gt;</code></pre><p>Show prompt dialog to the user.</p><p><strong>Returns</strong> <code>Promise&lt;string | null&gt;</code>: promise resolving to the answer provided by the user</p></td>
        </tr>
        <tr>
            <td><code>pickSingleItem</code></td>
            <td><pre><code class="language-application-typescript">pickSingleItem(props: { title?: string; items: PickerItem[] | PickerItemGroup[]; placeholder?: string }): Promise&lt;PickerItem | null&gt;</code></pre><p>Show a dialog for picking one item out of many, grouped and searchable.</p><p><code>items</code> are either the items themselves or groups of them, never the two mixed. Named for the one thing it does now: picking several at once will be a method of its own beside this.</p><p><strong>Returns</strong> <code>Promise&lt;PickerItem | null&gt;</code>: promise resolving to the item picked, or null where the user backed out.</p></td>
        </tr>
        <tr>
            <td><code>createLink</code></td>
            <td><pre><code class="language-application-typescript">createLink(notePath: string, params?: Record&lt;string, unknown&gt;): unknown</code></pre><p>Create a note link (jQuery object) for given note.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>notePath</code></td><td><code>string</code><br>(or noteId)</td></tr><tr><td><code>params</code><br><em>optional</em></td><td><code>Record&lt;string, unknown&gt;</code></td></tr></tbody></table></figure><p><strong>Returns</strong> <code>unknown</code>: - jQuery element with the link (wrapped in <span>)</span></p></td>
        </tr>
        <tr>
            <td><code>createNoteLink</code></td>
            <td><pre><code class="language-application-typescript">createNoteLink(notePath: string, params?: Record&lt;string, unknown&gt;): unknown</code></pre><aside class="admonition warning"><p>Deprecated. - use api.createLink() instead</p></aside></td>
        </tr>
        <tr>
            <td><code>triggerCommand</code></td>
            <td><pre><code class="language-application-typescript">triggerCommand(name: string, data?: Record&lt;string, unknown&gt;): Promise&lt;unknown&gt;</code></pre><p>Trigger command. This is a very low-level API which should be avoided if possible.</p></td>
        </tr>
        <tr>
            <td><code>triggerEvent</code></td>
            <td><pre><code class="language-application-typescript">triggerEvent(name: string, data?: Record&lt;string, unknown&gt;): Promise&lt;unknown&gt;</code></pre><p>Trigger event. This is a very low-level API which should be avoided if possible.</p></td>
        </tr>
        <tr>
            <td><code>setupElementTooltip</code></td>
            <td><pre><code class="language-application-typescript">setupElementTooltip(el: unknown): void</code></pre></td>
        </tr>
        <tr>
            <td><code>protectNote</code></td>
            <td><pre><code class="language-application-typescript">protectNote(noteId: string, protect: boolean): Promise&lt;void&gt;</code></pre><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>noteId</code></td><td><code>string</code></td></tr><tr><td><code>protect</code></td><td><code>boolean</code><br>true to protect note, false to unprotect</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>protectSubTree</code></td>
            <td><pre><code class="language-application-typescript">protectSubTree(noteId: string, protect: boolean): Promise&lt;void&gt;</code></pre><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>noteId</code></td><td><code>string</code></td></tr><tr><td><code>protect</code></td><td><code>boolean</code><br>true to protect subtree, false to unprotect</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>getTodayNote</code></td>
            <td><pre><code class="language-application-typescript">getTodayNote(): Promise&lt;ScriptFNote&gt;</code></pre><p>Returns date-note for today. If it doesn't exist, it is automatically created.</p></td>
        </tr>
        <tr>
            <td><code>getDayNote</code></td>
            <td><pre><code class="language-application-typescript">getDayNote(date: string): Promise&lt;ScriptFNote&gt;</code></pre><p>Returns day note for a given date. If it doesn't exist, it is automatically created.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>date</code></td><td><code>string</code><br>e.g. "2019-04-29"</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>getWeekFirstDayNote</code></td>
            <td><pre><code class="language-application-typescript">getWeekFirstDayNote(date: string): Promise&lt;ScriptFNote&gt;</code></pre><p>Returns day note for the first date of the week of the given date. If it doesn't exist, it is automatically created.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>date</code></td><td><code>string</code><br>e.g. "2019-04-29"</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>getWeekNote</code></td>
            <td><pre><code class="language-application-typescript">getWeekNote(date: string): Promise&lt;ScriptFNote&gt;</code></pre><p>Returns week note for given date. If such a note doesn't exist, it is automatically created.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>date</code></td><td><code>string</code><br>in YYYY-MM-DD format</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>getMonthNote</code></td>
            <td><pre><code class="language-application-typescript">getMonthNote(month: string): Promise&lt;ScriptFNote&gt;</code></pre><p>Returns month-note. If it doesn't exist, it is automatically created.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>month</code></td><td><code>string</code><br>e.g. "2019-04"</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>getQuarterNote</code></td>
            <td><pre><code class="language-application-typescript">getQuarterNote(date: string): Promise&lt;ScriptFNote&gt;</code></pre><p>Returns quarter note for given date. If such a note doesn't exist, it is automatically created.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>date</code></td><td><code>string</code><br>in YYYY-MM format</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>getYearNote</code></td>
            <td><pre><code class="language-application-typescript">getYearNote(year: string): Promise&lt;ScriptFNote&gt;</code></pre><p>Returns year-note. If it doesn't exist, it is automatically created.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>year</code></td><td><code>string</code><br>e.g. "2019"</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>setHoistedNoteId</code></td>
            <td><pre><code class="language-application-typescript">setHoistedNoteId(noteId: string): void</code></pre><p>Hoist note in the current tab. See <a href="https://triliumnext.github.io/Docs/Wiki/note-hoisting.html">https://triliumnext.github.io/Docs/Wiki/note-hoisting.html</a></p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>noteId</code></td><td><code>string</code><br>set hoisted note. 'root' will effectively unhoist</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>bindGlobalShortcut</code></td>
            <td><pre><code class="language-application-typescript">bindGlobalShortcut(keyboardShortcut: string, handler: () =&gt; void, namespace?: string): void</code></pre><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>keyboardShortcut</code></td><td><code>string</code><br>e.g. "ctrl+shift+a"</td></tr><tr><td><code>handler</code></td><td><code>() =&gt; void</code></td></tr><tr><td><code>namespace</code><br><em>optional</em></td><td><code>string</code><br>specify namespace of the handler for the cases where call for bind may be repeated. If a handler with this ID exists, it's replaced by the new handler.</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>waitUntilSynced</code></td>
            <td><pre><code class="language-application-typescript">waitUntilSynced(): Promise&lt;unknown&gt;</code></pre><p>Trilium runs in a backend and frontend process, when something is changed on the backend from a script, frontend will get asynchronously synchronized.</p><p>This method returns a promise which resolves once all the backend -&gt; frontend synchronization is finished. Typical use case is when a new note has been created, we should wait until it is synced into frontend and only then activate it.</p></td>
        </tr>
        <tr>
            <td><code>refreshIncludedNote</code></td>
            <td><pre><code class="language-application-typescript">refreshIncludedNote(includedNoteId: string): void</code></pre><p>This will refresh all currently opened notes which have included note specified in the parameter</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>includedNoteId</code></td><td><code>string</code><br>noteId of the included note</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>randomString</code></td>
            <td><pre><code class="language-application-typescript">randomString(length: number): string</code></pre><p>Return randomly generated string of given length. This random string generation is NOT cryptographically secure.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>length</code></td><td><code>number</code><br>of the string</td></tr></tbody></table></figure><p><strong>Returns</strong> <code>string</code>: random string</p></td>
        </tr>
        <tr>
            <td><code>formatSize</code></td>
            <td><pre><code class="language-application-typescript">formatSize(size: number): string</code></pre><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>size</code></td><td><code>number</code><br>in bytes</td></tr></tbody></table></figure><p><strong>Returns</strong> <code>string</code>: formatted string</p></td>
        </tr>
        <tr>
            <td><code>formatNoteSize</code></td>
            <td><pre><code class="language-application-typescript">formatNoteSize(size: number): string</code></pre><aside class="admonition warning"><p>Deprecated. - use api.formatSize()</p></aside><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>size</code></td><td><code>number</code><br>in bytes</td></tr></tbody></table></figure><p><strong>Returns</strong> <code>string</code>: formatted string</p></td>
        </tr>
        <tr>
            <td><code>htmlToMarkdown</code></td>
            <td><pre><code class="language-application-typescript">htmlToMarkdown(html: string): Promise&lt;string&gt;</code></pre><p>Converts the given HTML string to Markdown.</p><p>Unlike the backend API, this runs on the server (the HTML→Markdown converter is backend-only), so it returns a promise.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>html</code></td><td><code>string</code><br>HTML content to convert</td></tr></tbody></table></figure><p><strong>Returns</strong> <code>Promise&lt;string&gt;</code>: Markdown representation of the input HTML</p></td>
        </tr>
        <tr>
            <td><code>markdownToHtml</code></td>
            <td><pre><code class="language-application-typescript">markdownToHtml(markdown: string): Promise&lt;string&gt;</code></pre><p>Converts the given Markdown string to HTML.</p><p>Runs entirely in the browser; the promise is only needed because the Markdown renderer is loaded on demand.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>markdown</code></td><td><code>string</code><br>Markdown content to convert</td></tr></tbody></table></figure><p><strong>Returns</strong> <code>Promise&lt;string&gt;</code>: HTML representation of the input Markdown</p></td>
        </tr>
        <tr>
            <td><code>formatDateISO</code></td>
            <td><pre><code class="language-application-typescript">formatDateISO(date: Date): string</code></pre><p><strong>Returns</strong> <code>string</code>: date in YYYY-MM-DD format</p></td>
        </tr>
        <tr>
            <td><code>parseDate</code></td>
            <td><pre><code class="language-application-typescript">parseDate(str: string): Date</code></pre><p>Parses a date string into a Date.</p></td>
        </tr>
        <tr>
            <td><code>logMessages</code></td>
            <td><p><code>Record&lt;string, string[]&gt;</code><br>Per-note log message buffers shown in the UI log pane.</p></td>
        </tr>
        <tr>
            <td><code>logSpacedUpdates</code></td>
            <td><p><code>Record&lt;string, unknown&gt;</code><br>Per-note spaced-update handlers for the log pane.</p></td>
        </tr>
        <tr>
            <td><code>log</code></td>
            <td><pre><code class="language-application-typescript">log(...args: unknown[]): void</code></pre><p>Log given message to the log pane in UI. Accepts multiple arguments which are joined with spaces, similar to <code>console.log</code>.</p></td>
        </tr>
        <tr>
            <td><code>preact</code></td>
            <td><p><code>unknown</code><br>The Preact API surface (components, hooks) for render scripts.</p></td>
        </tr>
    </tbody>
</table>

## `ScriptFNote`

A note as seen by frontend scripts (subset of the client's `FNote`).

<table>
    <thead>
        <tr>
            <th>Member</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>noteId</code></td>
            <td><p><code>string</code></p></td>
        </tr>
        <tr>
            <td><code>title</code></td>
            <td><p><code>string</code></p></td>
        </tr>
        <tr>
            <td><code>type</code></td>
            <td><p><code>string</code></p></td>
        </tr>
        <tr>
            <td><code>mime</code></td>
            <td><p><code>string</code></p></td>
        </tr>
        <tr>
            <td><code>isProtected</code></td>
            <td><p><code>boolean</code></p></td>
        </tr>
        <tr>
            <td><code>isArchived</code></td>
            <td><p><code>boolean</code><br>Whether the note is archived (has the <code>archived</code> label).</p></td>
        </tr>
        <tr>
            <td><code>isMetadataReadOnly</code></td>
            <td><p><code>boolean</code><br>Whether the note's metadata (title, attributes) is read-only.</p></td>
        </tr>
        <tr>
            <td><code>attributes</code></td>
            <td><p><code>string[]</code><br>IDs of this note's owned attributes.</p></td>
        </tr>
        <tr>
            <td><code>targetRelations</code></td>
            <td><p><code>string[]</code><br>IDs of relations pointing <em>at</em> this note.</p></td>
        </tr>
        <tr>
            <td><code>parents</code></td>
            <td><p><code>string[]</code><br>Parent note IDs.</p></td>
        </tr>
        <tr>
            <td><code>children</code></td>
            <td><p><code>string[]</code><br>Child note IDs.</p></td>
        </tr>
        <tr>
            <td><code>getParentNotes</code></td>
            <td><pre><code class="language-application-typescript">getParentNotes(): ScriptFNote[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getChildNotes</code></td>
            <td><pre><code class="language-application-typescript">getChildNotes(): Promise&lt;ScriptFNote[]&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>getParentNoteIds</code></td>
            <td><pre><code class="language-application-typescript">getParentNoteIds(): string[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getChildNoteIds</code></td>
            <td><pre><code class="language-application-typescript">getChildNoteIds(): string[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getChildNoteIdsWithArchiveFiltering</code></td>
            <td><pre><code class="language-application-typescript">getChildNoteIdsWithArchiveFiltering(includeArchived?: boolean): Promise&lt;string[]&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>getSubtreeNotes</code></td>
            <td><pre><code class="language-application-typescript">getSubtreeNotes(): Promise&lt;ScriptFNote[]&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>getSubtreeNoteIds</code></td>
            <td><pre><code class="language-application-typescript">getSubtreeNoteIds(includeArchived?: boolean): Promise&lt;string[]&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>hasChildren</code></td>
            <td><pre><code class="language-application-typescript">hasChildren(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>hasAncestor</code></td>
            <td><pre><code class="language-application-typescript">hasAncestor(ancestorNoteId: string, followTemplates?: boolean): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isRoot</code></td>
            <td><pre><code class="language-application-typescript">isRoot(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>getParentBranchIds</code></td>
            <td><pre><code class="language-application-typescript">getParentBranchIds(): string[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getBranchIds</code></td>
            <td><pre><code class="language-application-typescript">getBranchIds(): string[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getParentBranches</code></td>
            <td><pre><code class="language-application-typescript">getParentBranches(): ScriptFBranch[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getChildBranches</code></td>
            <td><pre><code class="language-application-typescript">getChildBranches(): ScriptFBranch[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getBranches</code></td>
            <td><pre><code class="language-application-typescript">getBranches(): ScriptFBranch[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getFilteredChildBranches</code></td>
            <td><pre><code class="language-application-typescript">getFilteredChildBranches(): ScriptFBranch[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getAllNotePaths</code></td>
            <td><pre><code class="language-application-typescript">getAllNotePaths(): string[][]</code></pre></td>
        </tr>
        <tr>
            <td><code>getBestNotePath</code></td>
            <td><pre><code class="language-application-typescript">getBestNotePath(hoistedNoteId?: string, activeNotePath?: string | null): string[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getBestNotePathString</code></td>
            <td><pre><code class="language-application-typescript">getBestNotePathString(hoistedNoteId?: string): string</code></pre></td>
        </tr>
        <tr>
            <td><code>getSortedNotePathRecords</code></td>
            <td><pre><code class="language-application-typescript">getSortedNotePathRecords(hoistedNoteId?: string, activeNotePath?: string | null): ScriptNotePathRecord[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getAttributes</code></td>
            <td><pre><code class="language-application-typescript">getAttributes(type?: string, name?: string): ScriptAttribute[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getOwnedAttributes</code></td>
            <td><pre><code class="language-application-typescript">getOwnedAttributes(type?: string, name?: string): ScriptAttribute[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getAttribute</code></td>
            <td><pre><code class="language-application-typescript">getAttribute(type: string, name: string): ScriptAttribute | null</code></pre></td>
        </tr>
        <tr>
            <td><code>getOwnedAttribute</code></td>
            <td><pre><code class="language-application-typescript">getOwnedAttribute(type: string, name: string): ScriptAttribute | null</code></pre></td>
        </tr>
        <tr>
            <td><code>getAttributeValue</code></td>
            <td><pre><code class="language-application-typescript">getAttributeValue(type: string, name: string): string | null</code></pre></td>
        </tr>
        <tr>
            <td><code>getOwnedAttributeValue</code></td>
            <td><pre><code class="language-application-typescript">getOwnedAttributeValue(type: string, name: string): string | null</code></pre></td>
        </tr>
        <tr>
            <td><code>hasAttribute</code></td>
            <td><pre><code class="language-application-typescript">hasAttribute(type: string, name: string): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>hasOwnedAttribute</code></td>
            <td><pre><code class="language-application-typescript">hasOwnedAttribute(type: string, name: string): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>getAttributeDefinitions</code></td>
            <td><pre><code class="language-application-typescript">getAttributeDefinitions(): ScriptAttribute[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getPromotedDefinitionAttributes</code></td>
            <td><pre><code class="language-application-typescript">getPromotedDefinitionAttributes(): ScriptAttribute[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getLabels</code></td>
            <td><pre><code class="language-application-typescript">getLabels(name?: string): ScriptAttribute[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getOwnedLabels</code></td>
            <td><pre><code class="language-application-typescript">getOwnedLabels(name?: string): ScriptAttribute[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getLabel</code></td>
            <td><pre><code class="language-application-typescript">getLabel(name: string): ScriptAttribute | null</code></pre></td>
        </tr>
        <tr>
            <td><code>getOwnedLabel</code></td>
            <td><pre><code class="language-application-typescript">getOwnedLabel(name: string): ScriptAttribute | null</code></pre></td>
        </tr>
        <tr>
            <td><code>getLabelValue</code></td>
            <td><pre><code class="language-application-typescript">getLabelValue(name: string): string | null</code></pre></td>
        </tr>
        <tr>
            <td><code>getOwnedLabelValue</code></td>
            <td><pre><code class="language-application-typescript">getOwnedLabelValue(name: string): string | null</code></pre></td>
        </tr>
        <tr>
            <td><code>hasLabel</code></td>
            <td><pre><code class="language-application-typescript">hasLabel(name: string): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>hasOwnedLabel</code></td>
            <td><pre><code class="language-application-typescript">hasOwnedLabel(name: string): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>hasLabelOrDisabled</code></td>
            <td><pre><code class="language-application-typescript">hasLabelOrDisabled(name: string): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isLabelTruthy</code></td>
            <td><pre><code class="language-application-typescript">isLabelTruthy(name: string): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>getRelations</code></td>
            <td><pre><code class="language-application-typescript">getRelations(name?: string): ScriptAttribute[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getOwnedRelations</code></td>
            <td><pre><code class="language-application-typescript">getOwnedRelations(name: string): ScriptAttribute[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getRelation</code></td>
            <td><pre><code class="language-application-typescript">getRelation(name: string): ScriptAttribute | null</code></pre></td>
        </tr>
        <tr>
            <td><code>getOwnedRelation</code></td>
            <td><pre><code class="language-application-typescript">getOwnedRelation(name: string): ScriptAttribute | null</code></pre></td>
        </tr>
        <tr>
            <td><code>getRelationValue</code></td>
            <td><pre><code class="language-application-typescript">getRelationValue(name: string): string | null</code></pre></td>
        </tr>
        <tr>
            <td><code>getOwnedRelationValue</code></td>
            <td><pre><code class="language-application-typescript">getOwnedRelationValue(name: string): string | null</code></pre></td>
        </tr>
        <tr>
            <td><code>hasRelation</code></td>
            <td><pre><code class="language-application-typescript">hasRelation(name: string): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>hasOwnedRelation</code></td>
            <td><pre><code class="language-application-typescript">hasOwnedRelation(name: string): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>getLabelOrRelation</code></td>
            <td><pre><code class="language-application-typescript">getLabelOrRelation(nameWithPrefix: string): string | null</code></pre></td>
        </tr>
        <tr>
            <td><code>getRelationTarget</code></td>
            <td><pre><code class="language-application-typescript">getRelationTarget(name: string): Promise&lt;ScriptFNote | null&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>getRelationTargets</code></td>
            <td><pre><code class="language-application-typescript">getRelationTargets(name: string): Promise&lt;(ScriptFNote | null)[]&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>getTargetRelations</code></td>
            <td><pre><code class="language-application-typescript">getTargetRelations(): ScriptAttribute[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getTargetRelationSourceNotes</code></td>
            <td><pre><code class="language-application-typescript">getTargetRelationSourceNotes(): Promise&lt;ScriptFNote[]&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>getContent</code></td>
            <td><pre><code class="language-application-typescript">getContent(): Promise&lt;string | Uint8Array&lt;ArrayBufferLike&gt;&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>getJsonContent</code></td>
            <td><pre><code class="language-application-typescript">getJsonContent(): Promise&lt;unknown&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>getBlob</code></td>
            <td><pre><code class="language-application-typescript">getBlob(): Promise&lt;ScriptBlob | null&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>getNoteComplement</code></td>
            <td><pre><code class="language-application-typescript">getNoteComplement(): Promise&lt;ScriptBlob | null&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>getMetadata</code></td>
            <td><pre><code class="language-application-typescript">getMetadata(): Promise&lt;ScriptNoteMetadata&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>attachments</code></td>
            <td><p><code>ScriptAttachment[] | null</code></p></td>
        </tr>
        <tr>
            <td><code>getAttachments</code></td>
            <td><pre><code class="language-application-typescript">getAttachments(): Promise&lt;ScriptAttachment[]&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>getAttachmentsByRole</code></td>
            <td><pre><code class="language-application-typescript">getAttachmentsByRole(role: string): Promise&lt;ScriptAttachment[]&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>getAttachmentById</code></td>
            <td><pre><code class="language-application-typescript">getAttachmentById(attachmentId: string): Promise&lt;ScriptAttachment | undefined&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>getNotesToInheritAttributesFrom</code></td>
            <td><pre><code class="language-application-typescript">getNotesToInheritAttributesFrom(): ScriptFNote[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getIcon</code></td>
            <td><pre><code class="language-application-typescript">getIcon(): string</code></pre></td>
        </tr>
        <tr>
            <td><code>isFolder</code></td>
            <td><pre><code class="language-application-typescript">isFolder(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isShared</code></td>
            <td><pre><code class="language-application-typescript">isShared(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isContentAvailable</code></td>
            <td><pre><code class="language-application-typescript">isContentAvailable(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isJson</code></td>
            <td><pre><code class="language-application-typescript">isJson(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isJavaScript</code></td>
            <td><pre><code class="language-application-typescript">isJavaScript(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isJsx</code></td>
            <td><pre><code class="language-application-typescript">isJsx(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isHtml</code></td>
            <td><pre><code class="language-application-typescript">isHtml(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isMarkdown</code></td>
            <td><pre><code class="language-application-typescript">isMarkdown(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isOptions</code></td>
            <td><pre><code class="language-application-typescript">isOptions(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isTriliumScript</code></td>
            <td><pre><code class="language-application-typescript">isTriliumScript(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isTriliumSqlite</code></td>
            <td><pre><code class="language-application-typescript">isTriliumSqlite(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isLaunchBarConfig</code></td>
            <td><pre><code class="language-application-typescript">isLaunchBarConfig(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isHiddenCompletely</code></td>
            <td><pre><code class="language-application-typescript">isHiddenCompletely(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isInHiddenSubtree</code></td>
            <td><pre><code class="language-application-typescript">isInHiddenSubtree(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isEligibleForConversionToAttachment</code></td>
            <td><pre><code class="language-application-typescript">isEligibleForConversionToAttachment(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>getColorClass</code></td>
            <td><pre><code class="language-application-typescript">getColorClass(): string</code></pre></td>
        </tr>
        <tr>
            <td><code>getCssClass</code></td>
            <td><pre><code class="language-application-typescript">getCssClass(): string</code></pre></td>
        </tr>
        <tr>
            <td><code>getWorkspaceIconClass</code></td>
            <td><pre><code class="language-application-typescript">getWorkspaceIconClass(): string</code></pre></td>
        </tr>
        <tr>
            <td><code>getWorkspaceTabBackgroundColor</code></td>
            <td><pre><code class="language-application-typescript">getWorkspaceTabBackgroundColor(): string</code></pre></td>
        </tr>
        <tr>
            <td><code>getScriptEnv</code></td>
            <td><pre><code class="language-application-typescript">getScriptEnv(): "frontend" | "backend" | null</code></pre></td>
        </tr>
        <tr>
            <td><code>executeScript</code></td>
            <td><pre><code class="language-application-typescript">executeScript(): Promise&lt;unknown&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>blobId</code></td>
            <td><p><code>string</code><br>Blob ID of the current content; changes when content changes.</p></td>
        </tr>
        <tr>
            <td><code>parentToBranch</code></td>
            <td><p><code>Record&lt;string, string&gt;</code><br>Map of parent note ID → branch ID.</p></td>
        </tr>
        <tr>
            <td><code>childToBranch</code></td>
            <td><p><code>Record&lt;string, string&gt;</code><br>Map of child note ID → branch ID.</p></td>
        </tr>
        <tr>
            <td><code>searchResultsLoaded</code><br><em>optional</em></td>
            <td><p><code>boolean</code></p></td>
        </tr>
        <tr>
            <td><code>highlightedTokens</code><br><em>optional</em></td>
            <td><p><code>string[]</code></p></td>
        </tr>
        <tr>
            <td><code>dto</code></td>
            <td><p><code>Record&lt;string, unknown&gt;</code><br>Plain data representation of the note (the live object minus its cache handle).</p></td>
        </tr>
        <tr>
            <td><code>addParent</code></td>
            <td><pre><code class="language-application-typescript">addParent(parentNoteId: string, branchId: string, sort?: boolean): void</code></pre></td>
        </tr>
        <tr>
            <td><code>addChild</code></td>
            <td><pre><code class="language-application-typescript">addChild(childNoteId: string, branchId: string, sort?: boolean): void</code></pre></td>
        </tr>
        <tr>
            <td><code>sortParents</code></td>
            <td><pre><code class="language-application-typescript">sortParents(): void</code></pre></td>
        </tr>
        <tr>
            <td><code>sortChildren</code></td>
            <td><pre><code class="language-application-typescript">sortChildren(): void</code></pre></td>
        </tr>
        <tr>
            <td><code>update</code></td>
            <td><pre><code class="language-application-typescript">update(row: Record&lt;string, unknown&gt;): void</code></pre></td>
        </tr>
        <tr>
            <td><code>invalidateAttributeCache</code></td>
            <td><pre><code class="language-application-typescript">invalidateAttributeCache(): void</code></pre></td>
        </tr>
        <tr>
            <td><code>toString</code></td>
            <td><pre><code class="language-application-typescript">toString(): string</code></pre></td>
        </tr>
    </tbody>
</table>

## `RightPanelWidget`

Instance shape of `RightPanelWidget` (subset) — a widget shown in the right sidebar.

<table>
    <thead>
        <tr>
            <th>Member</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>$widget</code></td>
            <td><p><code>any</code><br>The widget's root jQuery element (assign in <code>doRender</code>, e.g. <code>this.$widget = $(TPL)</code>). Typed loosely because jQuery types can't be imported into this self-contained module; inside the editor it is a real <code>JQuery&lt;HTMLElement&gt;</code> so all jQuery methods work.</p></td>
        </tr>
        <tr>
            <td><code>isEnabled</code></td>
            <td><pre><code class="language-application-typescript">isEnabled(): boolean | null | undefined</code></pre><p>Whether the widget should be shown for the current context.</p></td>
        </tr>
        <tr>
            <td><code>doRender</code></td>
            <td><pre><code class="language-application-typescript">doRender(): void</code></pre><p>Builds <code>this.$widget</code>. Override to render the widget's DOM.</p></td>
        </tr>
        <tr>
            <td><code>render</code></td>
            <td><pre><code class="language-application-typescript">render(): unknown</code></pre><p>Renders the widget and returns its root element.</p></td>
        </tr>
        <tr>
            <td><code>cleanup</code></td>
            <td><pre><code class="language-application-typescript">cleanup(): void</code></pre><p>Tears down the widget; override to release resources.</p></td>
        </tr>
        <tr>
            <td><code>id</code></td>
            <td><pre><code class="language-application-typescript">id(id: string): this</code></pre><p>Fluent builder: set the element id. Chainable.</p></td>
        </tr>
        <tr>
            <td><code>class</code></td>
            <td><pre><code class="language-application-typescript">class(className: string): this</code></pre><p>Fluent builder: add a CSS class. Chainable.</p></td>
        </tr>
        <tr>
            <td><code>css</code></td>
            <td><pre><code class="language-application-typescript">css(name: string, value: string): this</code></pre><p>Fluent builder: set an inline CSS property. Chainable.</p></td>
        </tr>
        <tr>
            <td><code>child</code></td>
            <td><pre><code class="language-application-typescript">child(...components: unknown[]): this</code></pre><p>Fluent builder: append child components. Chainable.</p></td>
        </tr>
        <tr>
            <td><code>note</code></td>
            <td><p><code>ScriptFNote | null</code><br>The note currently shown in this widget's context.</p></td>
        </tr>
        <tr>
            <td><code>noteContext</code><br><em>optional</em></td>
            <td><p><code>ScriptNoteContext</code><br>The note context (split) this widget is attached to.</p></td>
        </tr>
        <tr>
            <td><code>refreshWithNote</code></td>
            <td><pre><code class="language-application-typescript">refreshWithNote(note: ScriptFNote | null | undefined): void | Promise&lt;void&gt;</code></pre><p>Called when the active note changes. Override to update the widget.</p></td>
        </tr>
        <tr>
            <td><code>refresh</code></td>
            <td><pre><code class="language-application-typescript">refresh(): void | Promise&lt;void&gt;</code></pre><p>Forces a refresh against the current note.</p></td>
        </tr>
        <tr>
            <td><code>widgetTitle</code></td>
            <td><p><code>string</code><br>Title shown in the right-panel header.</p></td>
        </tr>
        <tr>
            <td><code>doRenderBody</code></td>
            <td><pre><code class="language-application-typescript">doRenderBody(): void | Promise&lt;void&gt;</code></pre><p>Builds the panel body. Override to render the right-panel content.</p></td>
        </tr>
    </tbody>
</table>

## `NoteContextAwareWidget`

Instance shape of `NoteContextAwareWidget` (subset) — reacts to the active note.

<table>
    <thead>
        <tr>
            <th>Member</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>$widget</code></td>
            <td><p><code>any</code><br>The widget's root jQuery element (assign in <code>doRender</code>, e.g. <code>this.$widget = $(TPL)</code>). Typed loosely because jQuery types can't be imported into this self-contained module; inside the editor it is a real <code>JQuery&lt;HTMLElement&gt;</code> so all jQuery methods work.</p></td>
        </tr>
        <tr>
            <td><code>isEnabled</code></td>
            <td><pre><code class="language-application-typescript">isEnabled(): boolean | null | undefined</code></pre><p>Whether the widget should be shown for the current context.</p></td>
        </tr>
        <tr>
            <td><code>doRender</code></td>
            <td><pre><code class="language-application-typescript">doRender(): void</code></pre><p>Builds <code>this.$widget</code>. Override to render the widget's DOM.</p></td>
        </tr>
        <tr>
            <td><code>render</code></td>
            <td><pre><code class="language-application-typescript">render(): unknown</code></pre><p>Renders the widget and returns its root element.</p></td>
        </tr>
        <tr>
            <td><code>cleanup</code></td>
            <td><pre><code class="language-application-typescript">cleanup(): void</code></pre><p>Tears down the widget; override to release resources.</p></td>
        </tr>
        <tr>
            <td><code>id</code></td>
            <td><pre><code class="language-application-typescript">id(id: string): this</code></pre><p>Fluent builder: set the element id. Chainable.</p></td>
        </tr>
        <tr>
            <td><code>class</code></td>
            <td><pre><code class="language-application-typescript">class(className: string): this</code></pre><p>Fluent builder: add a CSS class. Chainable.</p></td>
        </tr>
        <tr>
            <td><code>css</code></td>
            <td><pre><code class="language-application-typescript">css(name: string, value: string): this</code></pre><p>Fluent builder: set an inline CSS property. Chainable.</p></td>
        </tr>
        <tr>
            <td><code>child</code></td>
            <td><pre><code class="language-application-typescript">child(...components: unknown[]): this</code></pre><p>Fluent builder: append child components. Chainable.</p></td>
        </tr>
        <tr>
            <td><code>note</code></td>
            <td><p><code>ScriptFNote | null</code><br>The note currently shown in this widget's context.</p></td>
        </tr>
        <tr>
            <td><code>noteContext</code><br><em>optional</em></td>
            <td><p><code>ScriptNoteContext</code><br>The note context (split) this widget is attached to.</p></td>
        </tr>
        <tr>
            <td><code>refreshWithNote</code></td>
            <td><pre><code class="language-application-typescript">refreshWithNote(note: ScriptFNote | null | undefined): void | Promise&lt;void&gt;</code></pre><p>Called when the active note changes. Override to update the widget.</p></td>
        </tr>
        <tr>
            <td><code>refresh</code></td>
            <td><pre><code class="language-application-typescript">refresh(): void | Promise&lt;void&gt;</code></pre><p>Forces a refresh against the current note.</p></td>
        </tr>
    </tbody>
</table>

## `BasicWidget`

Instance shape of `BasicWidget` (subset) — the base for custom frontend widgets.

<table>
    <thead>
        <tr>
            <th>Member</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>$widget</code></td>
            <td><p><code>any</code><br>The widget's root jQuery element (assign in <code>doRender</code>, e.g. <code>this.$widget = $(TPL)</code>). Typed loosely because jQuery types can't be imported into this self-contained module; inside the editor it is a real <code>JQuery&lt;HTMLElement&gt;</code> so all jQuery methods work.</p></td>
        </tr>
        <tr>
            <td><code>isEnabled</code></td>
            <td><pre><code class="language-application-typescript">isEnabled(): boolean | null | undefined</code></pre><p>Whether the widget should be shown for the current context.</p></td>
        </tr>
        <tr>
            <td><code>doRender</code></td>
            <td><pre><code class="language-application-typescript">doRender(): void</code></pre><p>Builds <code>this.$widget</code>. Override to render the widget's DOM.</p></td>
        </tr>
        <tr>
            <td><code>render</code></td>
            <td><pre><code class="language-application-typescript">render(): unknown</code></pre><p>Renders the widget and returns its root element.</p></td>
        </tr>
        <tr>
            <td><code>cleanup</code></td>
            <td><pre><code class="language-application-typescript">cleanup(): void</code></pre><p>Tears down the widget; override to release resources.</p></td>
        </tr>
        <tr>
            <td><code>id</code></td>
            <td><pre><code class="language-application-typescript">id(id: string): this</code></pre><p>Fluent builder: set the element id. Chainable.</p></td>
        </tr>
        <tr>
            <td><code>class</code></td>
            <td><pre><code class="language-application-typescript">class(className: string): this</code></pre><p>Fluent builder: add a CSS class. Chainable.</p></td>
        </tr>
        <tr>
            <td><code>css</code></td>
            <td><pre><code class="language-application-typescript">css(name: string, value: string): this</code></pre><p>Fluent builder: set an inline CSS property. Chainable.</p></td>
        </tr>
        <tr>
            <td><code>child</code></td>
            <td><pre><code class="language-application-typescript">child(...components: unknown[]): this</code></pre><p>Fluent builder: append child components. Chainable.</p></td>
        </tr>
    </tbody>
</table>

## `ScriptFBranch`

A branch (parent↔child link) as seen by frontend scripts (subset of `FBranch`).

<table>
    <thead>
        <tr>
            <th>Member</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>branchId</code></td>
            <td><p><code>string</code></p></td>
        </tr>
        <tr>
            <td><code>noteId</code></td>
            <td><p><code>string</code></p></td>
        </tr>
        <tr>
            <td><code>parentNoteId</code></td>
            <td><p><code>string</code></p></td>
        </tr>
        <tr>
            <td><code>notePosition</code></td>
            <td><p><code>number</code></p></td>
        </tr>
        <tr>
            <td><code>prefix</code><br><em>optional</em></td>
            <td><p><code>string</code></p></td>
        </tr>
        <tr>
            <td><code>isExpanded</code><br><em>optional</em></td>
            <td><p><code>boolean</code></p></td>
        </tr>
        <tr>
            <td><code>getNote</code></td>
            <td><pre><code class="language-application-typescript">getNote(): Promise&lt;ScriptFNote | null&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>getNoteFromCache</code></td>
            <td><pre><code class="language-application-typescript">getNoteFromCache(): ScriptFNote | undefined</code></pre></td>
        </tr>
        <tr>
            <td><code>getParentNote</code></td>
            <td><pre><code class="language-application-typescript">getParentNote(): Promise&lt;ScriptFNote | null&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>isTopLevel</code></td>
            <td><pre><code class="language-application-typescript">isTopLevel(): boolean</code></pre></td>
        </tr>
    </tbody>
</table>

## `ScriptNoteContext`

A split/tab context as seen by frontend scripts (subset of `NoteContext`).

<table>
    <thead>
        <tr>
            <th>Member</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>ntxId</code></td>
            <td><p><code>string | null</code></p></td>
        </tr>
        <tr>
            <td><code>note</code></td>
            <td><p><code>ScriptFNote | null</code></p></td>
        </tr>
        <tr>
            <td><code>notePath</code></td>
            <td><p><code>string | null</code></p></td>
        </tr>
        <tr>
            <td><code>getCodeEditor</code></td>
            <td><pre><code class="language-application-typescript">getCodeEditor(): Promise&lt;unknown&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>getTextEditor</code></td>
            <td><pre><code class="language-application-typescript">getTextEditor(): Promise&lt;unknown&gt;</code></pre></td>
        </tr>
    </tbody>
</table>

## `ScriptDayjsInstance`

A date as day.js wraps it (subset).

<table>
    <thead>
        <tr>
            <th>Member</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>format</code></td>
            <td><pre><code class="language-application-typescript">format(template?: string): string</code></pre><p>Formats the date, such as <code>"YYYY-MM-DD"</code> for <code>2026-10-22</code>. Without a template, it returns the ISO 8601 form with the UTC offset, such as <code>2026-10-22T14:03:05+02:00</code>.</p></td>
        </tr>
        <tr>
            <td><code>add</code></td>
            <td><pre><code class="language-application-typescript">add(value: number, unit: string): ScriptDayjsInstance</code></pre><p>Returns a new date, <code>value</code> units later. The date it is called on stays unchanged.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>value</code></td><td><code>number</code></td></tr><tr><td><code>unit</code></td><td><code>string</code><br>The unit, such as <code>"day"</code>, <code>"week"</code>, <code>"month"</code> or <code>"year"</code>.</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>subtract</code></td>
            <td><pre><code class="language-application-typescript">subtract(value: number, unit: string): ScriptDayjsInstance</code></pre><p>Returns a new date, <code>value</code> units earlier. The date it is called on stays unchanged.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>value</code></td><td><code>number</code></td></tr><tr><td><code>unit</code></td><td><code>string</code><br>The unit, such as <code>"day"</code>, <code>"week"</code>, <code>"month"</code> or <code>"year"</code>.</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>toDate</code></td>
            <td><pre><code class="language-application-typescript">toDate(): Date</code></pre><p>Returns the date as a JavaScript <code>Date</code>.</p></td>
        </tr>
    </tbody>
</table>

## Types

### `ScriptDayjs`

Minimal day.js surface (the real API exposes the full day.js factory).

```typescript
type ScriptDayjs = (date?: string | number | Date) => ScriptDayjsInstance
```

### `WidgetClass`

Constructor type allowing `class X extends api.Widget { … }`.

```typescript
type WidgetClass = (...args: unknown[]) => T
```

### `Func`

```typescript
type Func = (...args: unknown[]) => unknown | string
```

### `ScriptCreateNoteOpts`

Options accepted by `FrontendApi.createNote`.

| Property | Description |
| --- | --- |
| `title`  <br>_optional_ | `string \| null`  <br>Title of the new note. |
| `content`  <br>_optional_ | `string \| null`  <br>Content of the new note (HTML for text notes, source for code notes, etc.). |
| `type`  <br>_optional_ | `string`  <br>Note type, e.g. "text" (default), "code", "book". |
| `mime`  <br>_optional_ | `string`  <br>MIME type, e.g. "application/javascript;env=frontend" for a frontend code note. |
| `templateNoteId`  <br>_optional_ | `string`  <br>Note ID of a template to apply to the new note. |
| `isProtected`  <br>_optional_ | `boolean`  <br>Create the note as protected (only takes effect when a protected session is available). |
| `activate`  <br>_optional_ | `boolean`  <br>Activate (open) the new note after creation. Defaults to `true`. |
| `focus`  <br>_optional_ | `"title" \| "content"`  <br>Which part of the activated note to focus. Defaults to "title". |
| `target`  <br>_optional_ | `string`  <br>Where to place the note relative to the parent/target: "into" (default) or "after". |
| `targetBranchId`  <br>_optional_ | `string`  <br>Branch ID used together with `target: "after"`. |
| `attributes`  <br>_optional_ | `ScriptCreateAttribute[]`  <br>Attributes to set atomically on creation. |

### `PickerItem`

One thing a picker offers, as `pickSingleItem` takes and answers with.

| Property | Description |
| --- | --- |
| `key` | `string` |
| `caption` | `string` |
| `icon`  <br>_optional_ | `string`  <br>An icon class, `bx` prefix included. |
| `tooltip`  <br>_optional_ | `string`  <br>HTML shown in a tooltip while the item is hovered. |

### `PickerItemGroup`

A run of picker items under a heading of their own.

| Property | Description |
| --- | --- |
| `key` | `string` |
| `groupHeader` | `string` |
| `items` | `PickerItem[]` |

### `ScriptNotePathRecord`

One resolved tree path to a note (subset of the client's `NotePathRecord`).

| Property | Description |
| --- | --- |
| `isArchived` | `boolean` |
| `isInHoistedSubTree` | `boolean` |
| `isSearch`  <br>_optional_ | `boolean` |
| `notePath` | `string[]` |
| `isHidden` | `boolean` |

### `ScriptAttribute`

| Property | Description |
| --- | --- |
| `attributeId` | `string` |
| `type` | `"label" \| "relation"` |
| `name` | `string` |
| `value` | `string` |
| `isInheritable` | `boolean` |
| `isOwned` | `boolean` |

### `ScriptBlob`

A note's binary/text content blob (subset of the client's `FBlob`).

| Property | Description |
| --- | --- |
| `blobId` | `string` |
| `content` | `string` |
| `contentLength` | `number` |
| `dateModified` | `string` |
| `utcDateModified` | `string` |

### `ScriptNoteMetadata`

Creation/modification timestamps returned by `ScriptFNote.getMetadata`.

| Property | Description |
| --- | --- |
| `dateCreated` | `string` |
| `utcDateCreated` | `string` |
| `dateModified` | `string` |
| `utcDateModified` | `string` |

### `ScriptAttachment`

An attachment as seen by frontend scripts (subset of the client's `FAttachment`).

| Property | Description |
| --- | --- |
| `attachmentId` | `string` |
| `ownerId` | `string` |
| `role` | `string` |
| `mime` | `string` |
| `title` | `string` |
| `utcDateModified` | `string` |
| `contentLength` | `number` |

### `ScriptCreateAttribute`

An attribute to create together with a note (see `ScriptCreateNoteOpts.attributes`).

| Property | Description |
| --- | --- |
| `type` | `"label" \| "relation"` |
| `name` | `string` |
| `value`  <br>_optional_ | `string` |
| `isInheritable`  <br>_optional_ | `boolean` |
| `position`  <br>_optional_ | `number` |