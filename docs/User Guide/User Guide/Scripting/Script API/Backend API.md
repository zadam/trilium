# Backend API
## `BackendApi`

The `api` global available inside **backend** script notes (`application/javascript;env=backend`). Runs server-side: no DOM, no jQuery.

<table>
    <thead>
        <tr>
            <th>Member</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>startNote</code><br><em>optional</em></td>
            <td><p><code>ScriptBNote | null</code><br>Note where the script execution started — the entry point of the current script bundle (in C terms, the file containing <code>main()</code>). When a script is spread across multiple code notes (descendant code notes loaded as modules via <code>require()</code>), every note in the bundle shares the same <code>startNote</code>, while <code>currentNote</code> differs per note. Messages from <code>api.log()</code> are grouped under this note. When a frontend script calls <code>api.runOnBackend()</code>, the frontend's <code>startNote</code> is preserved here; since that note may not be resolvable on the backend, this can be null.</p></td>
        </tr>
        <tr>
            <td><code>currentNote</code></td>
            <td><p><code>ScriptBNote</code><br>Note containing the source code that is currently executing (in C terms, <code>__FILE__</code>). Equal to <code>startNote</code> unless execution has moved into a descendant module note loaded via <code>require()</code>. Don't confuse this with the concept of the active note in the UI.</p></td>
        </tr>
        <tr>
            <td><code>originEntity</code><br><em>optional</em></td>
            <td><p><code>unknown</code><br>Entity whose event triggered this execution; <code>undefined</code> when the run was not event-driven (e.g. started manually via "Execute script" or <code>note.executeScript()</code>). What it holds depends on the trigger: - <code>~runOnNoteCreation</code>, <code>~runOnNoteChange</code>, <code>~runOnNoteTitleChange</code>, <code>~runOnNoteContentChange</code> — the affected note; - <code>~runOnChildNoteCreation</code> — the newly created child note; - <code>~runOnAttributeCreation</code>, <code>~runOnAttributeChange</code> — the attribute; - <code>~runOnBranchCreation</code>, <code>~runOnBranchChange</code>, <code>~runOnBranchDeletion</code> — the branch; - scheduled scripts (<code>#run=backendStartup</code> / <code>#run=hourly</code> / <code>#run=daily</code>) — the script note itself; - search scripts (<code>~searchScript</code>) — the search note.</p></td>
        </tr>
        <tr>
            <td><code>req</code></td>
            <td><p><code>ScriptRequest</code><br>Express request object. Available only inside custom request handlers — a note with the <code>#customRequestHandler</code> label, invoked via a <code>/custom/...</code> URL. The editor surfaces this member only for such notes (where the request always supplies it), so it is non-optional rather than forcing a null-check.</p></td>
        </tr>
        <tr>
            <td><code>res</code></td>
            <td><p><code>ScriptResponse</code><br>Express response object — write the HTTP response here, e.g. <code>api.res.status(200).json({ ok: true })</code>. Available only inside custom request handlers (where it is always supplied), so it is non-optional.</p></td>
        </tr>
        <tr>
            <td><code>pathParams</code></td>
            <td><p><code>string[]</code><br>The capture groups from the <code>#customRequestHandler</code> regex that matched this request's URL, in order. Available only inside custom request handlers.</p></td>
        </tr>
        <tr>
            <td><code>dayjs</code></td>
            <td><p><code>ScriptDayjs</code><br>day.js library for date manipulation. See <code>https://day.js.org</code> for documentation</p></td>
        </tr>
        <tr>
            <td><code>xml2js</code></td>
            <td><p><code>unknown</code><br>xml2js library for XML parsing. See <code>https://github.com/Leonidas-from-XIV/node-xml2js</code> for documentation</p></td>
        </tr>
        <tr>
            <td><code>htmlParser</code></td>
            <td><p><code>unknown</code><br>node-html-parser library for HTML parsing. See <code>https://github.com/taoqf/node-fast-html-parser</code> for documentation.</p></td>
        </tr>
        <tr>
            <td><code>getInstanceName</code></td>
            <td><pre><code class="language-application-typescript">getInstanceName(): string | null</code></pre><p>Instance name identifies particular Trilium instance. It can be useful for scripts if some action needs to happen on only one specific instance.</p></td>
        </tr>
        <tr>
            <td><code>getNote</code></td>
            <td><pre><code class="language-application-typescript">getNote(noteId: string): ScriptBNote | null</code></pre><p>Returns a note by its ID, or null.</p></td>
        </tr>
        <tr>
            <td><code>getBranch</code></td>
            <td><pre><code class="language-application-typescript">getBranch(branchId: string): ScriptBBranch | null</code></pre><p>Returns a branch by its ID, or null.</p></td>
        </tr>
        <tr>
            <td><code>getAttribute</code></td>
            <td><pre><code class="language-application-typescript">getAttribute(attributeId: string): ScriptAttribute | null</code></pre><p>Returns an attribute by its ID, or null.</p></td>
        </tr>
        <tr>
            <td><code>getAttachment</code></td>
            <td><pre><code class="language-application-typescript">getAttachment(attachmentId: string): unknown</code></pre><p>Returns an attachment by its ID, or null.</p></td>
        </tr>
        <tr>
            <td><code>getRevision</code></td>
            <td><pre><code class="language-application-typescript">getRevision(revisionId: string): unknown</code></pre><p>Returns a revision by its ID, or null.</p></td>
        </tr>
        <tr>
            <td><code>getEtapiToken</code></td>
            <td><pre><code class="language-application-typescript">getEtapiToken(etapiTokenId: string): unknown</code></pre><p>Returns an ETAPI token by its ID, or null.</p></td>
        </tr>
        <tr>
            <td><code>getEtapiTokens</code></td>
            <td><pre><code class="language-application-typescript">getEtapiTokens(): unknown[]</code></pre><p>Returns all ETAPI tokens.</p></td>
        </tr>
        <tr>
            <td><code>getOption</code></td>
            <td><pre><code class="language-application-typescript">getOption(optionName: string): unknown</code></pre><p>Returns an option by name, or null.</p></td>
        </tr>
        <tr>
            <td><code>getOptions</code></td>
            <td><pre><code class="language-application-typescript">getOptions(): unknown[]</code></pre><p>Returns all options.</p></td>
        </tr>
        <tr>
            <td><code>searchForNotes</code></td>
            <td><pre><code class="language-application-typescript">searchForNotes(query: string, searchParams?: Record&lt;string, unknown&gt;): ScriptBNote[]</code></pre><p>This is a powerful search method - you can search by attributes and their values, e.g.: "#dateModified =* MONTH AND #log". See <code>https://triliumnext.github.io/Docs/Wiki/search.html</code> for full documentation for all options</p></td>
        </tr>
        <tr>
            <td><code>searchForNote</code></td>
            <td><pre><code class="language-application-typescript">searchForNote(query: string, searchParams?: Record&lt;string, unknown&gt;): ScriptBNote | null</code></pre><p>This is a powerful search method - you can search by attributes and their values, e.g.: "#dateModified =* MONTH AND #log". See <code>https://triliumnext.github.io/Docs/Wiki/search.html</code> for full documentation for all options</p></td>
        </tr>
        <tr>
            <td><code>getNotesWithLabel</code></td>
            <td><pre><code class="language-application-typescript">getNotesWithLabel(name: string, value?: string): ScriptBNote[]</code></pre><p>Retrieves notes with given label name &amp; value</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>name</code></td><td><code>string</code><br>attribute name</td></tr><tr><td><code>value</code><br><em>optional</em></td><td><code>string</code><br>attribute value</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>getNoteWithLabel</code></td>
            <td><pre><code class="language-application-typescript">getNoteWithLabel(name: string, value?: string): ScriptBNote | null</code></pre><p>Retrieves first note with given label name &amp; value</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>name</code></td><td><code>string</code><br>attribute name</td></tr><tr><td><code>value</code><br><em>optional</em></td><td><code>string</code><br>attribute value</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>ensureNoteIsPresentInParent</code></td>
            <td><pre><code class="language-application-typescript">ensureNoteIsPresentInParent(noteId: string, parentNoteId: string, prefix?: string): { branch: ScriptBBranch | null }</code></pre><p>If there's no branch between note and parent note, create one. Otherwise, do nothing. Returns the new or existing branch.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>noteId</code></td><td><code>string</code></td></tr><tr><td><code>parentNoteId</code></td><td><code>string</code></td></tr><tr><td><code>prefix</code><br><em>optional</em></td><td><code>string</code><br>if branch is created between note and parent note, set this prefix</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>ensureNoteIsAbsentFromParent</code></td>
            <td><pre><code class="language-application-typescript">ensureNoteIsAbsentFromParent(noteId: string, parentNoteId: string): void</code></pre><p>If there's a branch between note and parent note, remove it. Otherwise, do nothing.</p></td>
        </tr>
        <tr>
            <td><code>toggleNoteInParent</code></td>
            <td><pre><code class="language-application-typescript">toggleNoteInParent(present: boolean, noteId: string, parentNoteId: string, prefix?: string): void</code></pre><p>Based on the value, either create or remove branch between note and parent note.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>present</code></td><td><code>boolean</code><br>true if we want the branch to exist, false if we want it gone</td></tr><tr><td><code>noteId</code></td><td><code>string</code></td></tr><tr><td><code>parentNoteId</code></td><td><code>string</code></td></tr><tr><td><code>prefix</code><br><em>optional</em></td><td><code>string</code><br>if branch is created between note and parent note, set this prefix</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>createTextNote</code></td>
            <td><pre><code class="language-application-typescript">createTextNote(parentNoteId: string, title: string, content: string): ScriptNoteAndBranch</code></pre><p>Create text note. See also createNewNote() for more options.</p></td>
        </tr>
        <tr>
            <td><code>createDataNote</code></td>
            <td><pre><code class="language-application-typescript">createDataNote(parentNoteId: string, title: string, content: object): ScriptNoteAndBranch</code></pre><p>Create data note - data in this context means object serializable to JSON. Created note will be of type 'code' and JSON MIME type. See also createNewNote() for more options.</p></td>
        </tr>
        <tr>
            <td><code>createNewNote</code></td>
            <td><pre><code class="language-application-typescript">createNewNote(params: { parentNoteId: string; title: string; content: string | Uint8Array&lt;ArrayBufferLike&gt;; type: string; mime?: string; [key: string]: unknown }): ScriptNoteAndBranch</code></pre><p><strong>Returns</strong> <code>ScriptNoteAndBranch</code>: object contains newly created entities note and branch</p></td>
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
            <td><pre><code class="language-application-typescript">log(...args: unknown[]): void</code></pre><p>Log given message to trilium logs and log pane in UI. Accepts multiple arguments which are joined with spaces, similar to <code>console.log</code>.</p></td>
        </tr>
        <tr>
            <td><code>getRootCalendarNote</code></td>
            <td><pre><code class="language-application-typescript">getRootCalendarNote(): ScriptBNote | null</code></pre><p>Returns root note of the calendar.</p></td>
        </tr>
        <tr>
            <td><code>getDayNote</code></td>
            <td><pre><code class="language-application-typescript">getDayNote(date: string, rootNote?: ScriptBNote): ScriptBNote | null</code></pre><p>Returns day note for given date. If such note doesn't exist, it is created.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>date</code></td><td><code>string</code><br>in YYYY-MM-DD format</td></tr><tr><td><code>rootNote</code><br><em>optional</em></td><td><code>ScriptBNote</code><br>specify calendar root note, normally leave empty to use the default calendar</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>getTodayNote</code></td>
            <td><pre><code class="language-application-typescript">getTodayNote(rootNote?: ScriptBNote): ScriptBNote | null</code></pre><p>Returns today's day note. If such note doesn't exist, it is created.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>rootNote</code><br><em>optional</em></td><td><code>ScriptBNote</code><br>specify calendar root note, normally leave empty to use the default calendar</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>getWeekFirstDayNote</code></td>
            <td><pre><code class="language-application-typescript">getWeekFirstDayNote(date: string, rootNote?: ScriptBNote): ScriptBNote | null</code></pre><p>Returns note for the first date of the week of the given date.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>date</code></td><td><code>string</code><br>in YYYY-MM-DD format</td></tr><tr><td><code>rootNote</code><br><em>optional</em></td><td><code>ScriptBNote</code><br>specify calendar root note, normally leave empty to use the default calendar</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>getWeekNote</code></td>
            <td><pre><code class="language-application-typescript">getWeekNote(date: string, rootNote?: ScriptBNote): ScriptBNote | null</code></pre><p>Returns week note for given date. If such a note doesn't exist, it is created.</p><p>If the calendar does not support week notes, this method will return `null`.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>date</code></td><td><code>string</code><br>in YYYY-MM-DD format</td></tr><tr><td><code>rootNote</code><br><em>optional</em></td><td><code>ScriptBNote</code><br>specify calendar root note, normally leave empty to use the default calendar</td></tr></tbody></table></figure><p><strong>Returns</strong> <code>ScriptBNote | null</code>: an existing or newly created week note, or <code>null</code> if the calendar does not support week notes.</p></td>
        </tr>
        <tr>
            <td><code>getMonthNote</code></td>
            <td><pre><code class="language-application-typescript">getMonthNote(date: string, rootNote?: ScriptBNote): ScriptBNote | null</code></pre><p>Returns month note for given date. If such a note doesn't exist, it is created.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>date</code></td><td><code>string</code><br>in YYYY-MM format</td></tr><tr><td><code>rootNote</code><br><em>optional</em></td><td><code>ScriptBNote</code><br>specify calendar root note, normally leave empty to use the default calendar</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>getQuarterNote</code></td>
            <td><pre><code class="language-application-typescript">getQuarterNote(date: string, rootNote?: ScriptBNote): ScriptBNote | null</code></pre><p>Returns quarter note for given date. If such a note doesn't exist, it is created.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>date</code></td><td><code>string</code><br>in YYYY-MM format</td></tr><tr><td><code>rootNote</code><br><em>optional</em></td><td><code>ScriptBNote</code><br>specify calendar root note, normally leave empty to use the default calendar</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>getYearNote</code></td>
            <td><pre><code class="language-application-typescript">getYearNote(year: string, rootNote?: ScriptBNote): ScriptBNote | null</code></pre><p>Returns year note for given year. If such a note doesn't exist, it is created.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>year</code></td><td><code>string</code><br>in YYYY format</td></tr><tr><td><code>rootNote</code><br><em>optional</em></td><td><code>ScriptBNote</code><br>specify calendar root note, normally leave empty to use the default calendar</td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>sortNotes</code></td>
            <td><pre><code class="language-application-typescript">sortNotes(parentNoteId: string, sortConfig: { sortBy?: string; reverse?: boolean; foldersFirst?: boolean }): void</code></pre><p>Sort child notes of a given note. <code>sortBy</code> takes the <code>#sorted</code> grammar — comma-separated levels of <code>title</code>, <code>dateCreated</code>, <code>dateModified</code> or a label name, each optionally followed by <code>asc</code> or <code>desc</code> (<code>priority desc, dueDate</code>); <code>reverse</code> is the direction of the levels without their own, of the folders grouping and of ties.</p></td>
        </tr>
        <tr>
            <td><code>setNoteToParent</code></td>
            <td><pre><code class="language-application-typescript">setNoteToParent(noteId: string, prefix: string, parentNoteId: string | null): void</code></pre><p>This method finds note by its noteId and prefix and either sets it to the given parentNoteId or removes the branch (if parentNoteId is not given).</p><p>This method looks similar to toggleNoteInParent() but differs because we're looking up branch by prefix.</p><aside class="admonition warning"><p>Deprecated. this method is pretty confusing and serves specialized purpose only</p></aside></td>
        </tr>
        <tr>
            <td><code>transactional</code></td>
            <td><pre><code class="language-application-typescript">transactional(func: () =&gt; T): T</code></pre><p>This functions wraps code which is supposed to be running in transaction. If transaction already exists, then we'll use that transaction.</p><p><strong>Returns</strong> <code>T</code>: result of func callback</p></td>
        </tr>
        <tr>
            <td><code>randomString</code></td>
            <td><pre><code class="language-application-typescript">randomString(length: number): string</code></pre><p>Return randomly generated string of given length. This random string generation is NOT cryptographically secure.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>length</code></td><td><code>number</code><br>of the string</td></tr></tbody></table></figure><p><strong>Returns</strong> <code>string</code>: random string</p></td>
        </tr>
        <tr>
            <td><code>escapeHtml</code></td>
            <td><pre><code class="language-application-typescript">escapeHtml(str: string): string</code></pre><p><strong>Returns</strong> <code>string</code>: escaped string</p></td>
        </tr>
        <tr>
            <td><code>unescapeHtml</code></td>
            <td><pre><code class="language-application-typescript">unescapeHtml(str: string): string</code></pre><p><strong>Returns</strong> <code>string</code>: unescaped string</p></td>
        </tr>
        <tr>
            <td><code>htmlToMarkdown</code></td>
            <td><pre><code class="language-application-typescript">htmlToMarkdown(html: string): string</code></pre><p>Converts the given HTML string to Markdown.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>html</code></td><td><code>string</code><br>HTML content to convert</td></tr></tbody></table></figure><p><strong>Returns</strong> <code>string</code>: Markdown representation of the input HTML</p></td>
        </tr>
        <tr>
            <td><code>markdownToHtml</code></td>
            <td><pre><code class="language-application-typescript">markdownToHtml(markdown: string): string</code></pre><p>Converts the given Markdown string to HTML.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>markdown</code></td><td><code>string</code><br>Markdown content to convert</td></tr></tbody></table></figure><p><strong>Returns</strong> <code>string</code>: HTML representation of the input Markdown</p></td>
        </tr>
        <tr>
            <td><code>sql</code></td>
            <td><p><code>unknown</code><br>sql</p></td>
        </tr>
        <tr>
            <td><code>getAppInfo</code></td>
            <td><pre><code class="language-application-typescript">getAppInfo(): unknown</code></pre><p>Application info (version, build date, etc.).</p></td>
        </tr>
        <tr>
            <td><code>createOrUpdateLauncher</code></td>
            <td><pre><code class="language-application-typescript">createOrUpdateLauncher(opts: { id: string; type: "note" | "script" | "customWidget"; title: string; isVisible: boolean; icon: string; keyboardShortcut: string; targetNoteId?: string; scriptNoteId?: string; widgetNoteId?: string }): { note: ScriptBNote }</code></pre><p>Creates a new launcher to the launchbar. If the launcher (id) already exists, it will be updated.</p></td>
        </tr>
        <tr>
            <td><code>exportSubtreeToZipFile</code></td>
            <td><pre><code class="language-application-typescript">exportSubtreeToZipFile(noteId: string, format: "markdown" | "html", zipFilePath: string): Promise&lt;void&gt;</code></pre><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>noteId</code></td><td><code>string</code></td></tr><tr><td><code>format</code></td><td><code>"markdown" | "html"</code><br>either 'html' or 'markdown'</td></tr><tr><td><code>zipFilePath</code></td><td><code>string</code></td></tr></tbody></table></figure></td>
        </tr>
        <tr>
            <td><code>runOnFrontend</code></td>
            <td><pre><code class="language-application-typescript">runOnFrontend(script: string | () =&gt; void, params?: unknown[]): void</code></pre><p>Executes given anonymous function on the frontend(s). Internally, this serializes the anonymous function into string and sends it to frontend(s) via WebSocket. Note that there can be multiple connected frontend instances (e.g. in different tabs). In such case, all instances execute the given function.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>script</code></td><td><code>string | () =&gt; void</code><br>script to be executed on the frontend</td></tr><tr><td><code>params</code><br><em>optional</em></td><td><code>unknown[]</code><br>list of parameters to the anonymous function to be sent to frontend</td></tr></tbody></table></figure><p><strong>Returns</strong> <code>void</code>: no return value is provided.</p></td>
        </tr>
        <tr>
            <td><code>runOutsideOfSync</code></td>
            <td><pre><code class="language-application-typescript">runOutsideOfSync(callback: () =&gt; void): Promise&lt;void&gt;</code></pre><p>Sync process can make data intermittently inconsistent. Scripts which require strong data consistency can use this function to wait for a possible sync process to finish and prevent new sync process from starting while it is running.</p><p>Because this is an async process, the inner callback doesn't have automatic transaction handling, so in case you need to make some DB changes, you need to surround your call with api.transactional(...)</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>callback</code></td><td><code>() =&gt; void</code><br>function to be executed while sync process is not running</td></tr></tbody></table></figure><p><strong>Returns</strong> <code>Promise&lt;void&gt;</code>: resolves once the callback is finished (callback is awaited)</p></td>
        </tr>
        <tr>
            <td><code>backupNow</code></td>
            <td><pre><code class="language-application-typescript">backupNow(backupName: string): Promise&lt;string&gt;</code></pre><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>backupName</code></td><td><code>string</code><br>If the backupName is e.g. "now", then the backup will be written to "backup-now.db" file</td></tr></tbody></table></figure><p><strong>Returns</strong> <code>Promise&lt;string&gt;</code>: resolves once the backup is finished</p></td>
        </tr>
        <tr>
            <td><code>duplicateSubtree</code></td>
            <td><pre><code class="language-application-typescript">duplicateSubtree(origNoteId: string, newParentNoteId: string): ScriptNoteAndBranch</code></pre><p>Enables the complete duplication of the specified original note and all its children into the specified parent note. The new note will be named the same as the original, with (Dup) added to the end of it.</p><figure class="table"><table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody><tr><td><code>origNoteId</code></td><td><code>string</code><br>the noteId for the original note to be duplicated</td></tr><tr><td><code>newParentNoteId</code></td><td><code>string</code><br>the noteId for the parent note where the duplication is to be placed.</td></tr></tbody></table></figure><p><strong>Returns</strong> <code>ScriptNoteAndBranch</code>: the note and the branch of the newly created note.</p></td>
        </tr>
    </tbody>
</table>

## `ScriptBNote`

A note as seen by backend scripts (subset of trilium-core's `BNote`).

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
            <td><p><code>boolean</code></p></td>
        </tr>
        <tr>
            <td><code>isDeleted</code></td>
            <td><p><code>boolean</code></p></td>
        </tr>
        <tr>
            <td><code>shareId</code></td>
            <td><p><code>string</code><br>Share root ID this note is published under, if any.</p></td>
        </tr>
        <tr>
            <td><code>blobId</code></td>
            <td><p><code>string</code></p></td>
        </tr>
        <tr>
            <td><code>dateCreated</code></td>
            <td><p><code>string</code></p></td>
        </tr>
        <tr>
            <td><code>dateModified</code></td>
            <td><p><code>string</code></p></td>
        </tr>
        <tr>
            <td><code>utcDateCreated</code></td>
            <td><p><code>string</code></p></td>
        </tr>
        <tr>
            <td><code>utcDateModified</code></td>
            <td><p><code>string</code></p></td>
        </tr>
        <tr>
            <td><code>getContent</code></td>
            <td><pre><code class="language-application-typescript">getContent(): string | Uint8Array&lt;ArrayBufferLike&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>setContent</code></td>
            <td><pre><code class="language-application-typescript">setContent(content: string | Uint8Array&lt;ArrayBufferLike&gt;, opts?: { forceFrontendReload?: boolean }): void</code></pre></td>
        </tr>
        <tr>
            <td><code>getJsonContent</code></td>
            <td><pre><code class="language-application-typescript">getJsonContent(): T | null</code></pre></td>
        </tr>
        <tr>
            <td><code>getJsonContentSafely</code></td>
            <td><pre><code class="language-application-typescript">getJsonContentSafely(): unknown</code></pre></td>
        </tr>
        <tr>
            <td><code>setJsonContent</code></td>
            <td><pre><code class="language-application-typescript">setJsonContent(content: unknown): void</code></pre></td>
        </tr>
        <tr>
            <td><code>hasStringContent</code></td>
            <td><pre><code class="language-application-typescript">hasStringContent(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>getFileName</code></td>
            <td><pre><code class="language-application-typescript">getFileName(): string</code></pre></td>
        </tr>
        <tr>
            <td><code>getFlatText</code></td>
            <td><pre><code class="language-application-typescript">getFlatText(): string</code></pre></td>
        </tr>
        <tr>
            <td><code>getPojo</code></td>
            <td><pre><code class="language-application-typescript">getPojo(): Record&lt;string, unknown&gt;</code></pre><p>Plain serialisable representation of the note (the real return type is <code>NotePojo</code>).</p></td>
        </tr>
        <tr>
            <td><code>getTitleOrProtected</code></td>
            <td><pre><code class="language-application-typescript">getTitleOrProtected(): string</code></pre></td>
        </tr>
        <tr>
            <td><code>getIcon</code></td>
            <td><pre><code class="language-application-typescript">getIcon(): string</code></pre></td>
        </tr>
        <tr>
            <td><code>parents</code></td>
            <td><p><code>ScriptBNote[]</code></p></td>
        </tr>
        <tr>
            <td><code>children</code></td>
            <td><p><code>ScriptBNote[]</code></p></td>
        </tr>
        <tr>
            <td><code>parentBranches</code></td>
            <td><p><code>ScriptBBranch[]</code></p></td>
        </tr>
        <tr>
            <td><code>parentCount</code></td>
            <td><p><code>number</code></p></td>
        </tr>
        <tr>
            <td><code>childrenCount</code></td>
            <td><p><code>number</code></p></td>
        </tr>
        <tr>
            <td><code>getParentNotes</code></td>
            <td><pre><code class="language-application-typescript">getParentNotes(): ScriptBNote[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getChildNotes</code></td>
            <td><pre><code class="language-application-typescript">getChildNotes(): ScriptBNote[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getVisibleChildNotes</code></td>
            <td><pre><code class="language-application-typescript">getVisibleChildNotes(): ScriptBNote[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getParentBranches</code></td>
            <td><pre><code class="language-application-typescript">getParentBranches(): ScriptBBranch[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getChildBranches</code></td>
            <td><pre><code class="language-application-typescript">getChildBranches(): ScriptBBranch[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getVisibleChildBranches</code></td>
            <td><pre><code class="language-application-typescript">getVisibleChildBranches(): ScriptBBranch[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getStrongParentBranches</code></td>
            <td><pre><code class="language-application-typescript">getStrongParentBranches(): ScriptBBranch[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getFilteredChildBranches</code></td>
            <td><pre><code class="language-application-typescript">getFilteredChildBranches(): ScriptBBranch[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getBranches</code></td>
            <td><pre><code class="language-application-typescript">getBranches(): ScriptBBranch[]</code></pre></td>
        </tr>
        <tr>
            <td><code>hasChildren</code></td>
            <td><pre><code class="language-application-typescript">hasChildren(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>hasVisibleChildren</code></td>
            <td><pre><code class="language-application-typescript">hasVisibleChildren(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>getAncestors</code></td>
            <td><pre><code class="language-application-typescript">getAncestors(): ScriptBNote[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getAncestorNoteIds</code></td>
            <td><pre><code class="language-application-typescript">getAncestorNoteIds(): string[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getDescendantNoteIds</code></td>
            <td><pre><code class="language-application-typescript">getDescendantNoteIds(): string[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getDistanceToAncestor</code></td>
            <td><pre><code class="language-application-typescript">getDistanceToAncestor(ancestorNoteId: string): number</code></pre></td>
        </tr>
        <tr>
            <td><code>hasAncestor</code></td>
            <td><pre><code class="language-application-typescript">hasAncestor(ancestorNoteId: string): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isDescendantOfNote</code></td>
            <td><pre><code class="language-application-typescript">isDescendantOfNote(ancestorNoteId: string): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isRoot</code></td>
            <td><pre><code class="language-application-typescript">isRoot(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>getSubtree</code></td>
            <td><pre><code class="language-application-typescript">getSubtree(opts?: ScriptSubtreeOpts): { notes: ScriptBNote[]; relationships: ScriptSubtreeRelationship[] }</code></pre></td>
        </tr>
        <tr>
            <td><code>getSubtreeNoteIds</code></td>
            <td><pre><code class="language-application-typescript">getSubtreeNoteIds(opts?: ScriptSubtreeOpts): string[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getSubtreeNotesIncludingTemplated</code></td>
            <td><pre><code class="language-application-typescript">getSubtreeNotesIncludingTemplated(): ScriptBNote[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getInheritingNotes</code></td>
            <td><pre><code class="language-application-typescript">getInheritingNotes(): ScriptBNote[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getAllNotePaths</code></td>
            <td><pre><code class="language-application-typescript">getAllNotePaths(): string[][]</code></pre></td>
        </tr>
        <tr>
            <td><code>getBestNotePath</code></td>
            <td><pre><code class="language-application-typescript">getBestNotePath(hoistedNoteId?: string): string[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getBestNotePathString</code></td>
            <td><pre><code class="language-application-typescript">getBestNotePathString(hoistedNoteId?: string): string</code></pre></td>
        </tr>
        <tr>
            <td><code>getSortedNotePathRecords</code></td>
            <td><pre><code class="language-application-typescript">getSortedNotePathRecords(hoistedNoteId?: string): ScriptNotePathRecord[]</code></pre></td>
        </tr>
        <tr>
            <td><code>areAllNotePathsArchived</code></td>
            <td><pre><code class="language-application-typescript">areAllNotePathsArchived(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>ownedAttributes</code></td>
            <td><p><code>ScriptAttribute[]</code></p></td>
        </tr>
        <tr>
            <td><code>targetRelations</code></td>
            <td><p><code>ScriptAttribute[]</code></p></td>
        </tr>
        <tr>
            <td><code>attributeCount</code></td>
            <td><p><code>number</code></p></td>
        </tr>
        <tr>
            <td><code>ownedAttributeCount</code></td>
            <td><p><code>number</code></p></td>
        </tr>
        <tr>
            <td><code>labelCount</code></td>
            <td><p><code>number</code></p></td>
        </tr>
        <tr>
            <td><code>ownedLabelCount</code></td>
            <td><p><code>number</code></p></td>
        </tr>
        <tr>
            <td><code>relationCount</code></td>
            <td><p><code>number</code></p></td>
        </tr>
        <tr>
            <td><code>relationCountIncludingLinks</code></td>
            <td><p><code>number</code></p></td>
        </tr>
        <tr>
            <td><code>ownedRelationCount</code></td>
            <td><p><code>number</code></p></td>
        </tr>
        <tr>
            <td><code>ownedRelationCountIncludingLinks</code></td>
            <td><p><code>number</code></p></td>
        </tr>
        <tr>
            <td><code>targetRelationCount</code></td>
            <td><p><code>number</code></p></td>
        </tr>
        <tr>
            <td><code>targetRelationCountIncludingLinks</code></td>
            <td><p><code>number</code></p></td>
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
            <td><pre><code class="language-application-typescript">getOwnedAttribute(type: string, name: string, value?: string | null): ScriptAttribute | null</code></pre></td>
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
            <td><code>getAttributeById</code></td>
            <td><pre><code class="language-application-typescript">getAttributeById(attributeId: string): ScriptAttribute | undefined</code></pre></td>
        </tr>
        <tr>
            <td><code>getAttributeCaseInsensitive</code></td>
            <td><pre><code class="language-application-typescript">getAttributeCaseInsensitive(type: string, name: string, value?: string | null): ScriptAttribute | undefined</code></pre></td>
        </tr>
        <tr>
            <td><code>hasAttribute</code></td>
            <td><pre><code class="language-application-typescript">hasAttribute(type: string, name: string): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>hasOwnedAttribute</code></td>
            <td><pre><code class="language-application-typescript">hasOwnedAttribute(type: string, name: string, value?: string): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>getLabelDefinitions</code></td>
            <td><pre><code class="language-application-typescript">getLabelDefinitions(): ScriptAttribute[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getRelationDefinitions</code></td>
            <td><pre><code class="language-application-typescript">getRelationDefinitions(): ScriptAttribute[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getTargetRelations</code></td>
            <td><pre><code class="language-application-typescript">getTargetRelations(): ScriptAttribute[]</code></pre></td>
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
            <td><code>getLabels</code></td>
            <td><pre><code class="language-application-typescript">getLabels(name?: string): ScriptAttribute[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getOwnedLabels</code></td>
            <td><pre><code class="language-application-typescript">getOwnedLabels(name: string): ScriptAttribute[]</code></pre></td>
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
            <td><code>getLabelValues</code></td>
            <td><pre><code class="language-application-typescript">getLabelValues(name: string): string[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getOwnedLabelValues</code></td>
            <td><pre><code class="language-application-typescript">getOwnedLabelValues(name: string): string[]</code></pre></td>
        </tr>
        <tr>
            <td><code>hasLabel</code></td>
            <td><pre><code class="language-application-typescript">hasLabel(name: string): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>hasOwnedLabel</code></td>
            <td><pre><code class="language-application-typescript">hasOwnedLabel(name: string, value?: string): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isLabelTruthy</code></td>
            <td><pre><code class="language-application-typescript">isLabelTruthy(name: string): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>hasInheritableArchivedLabel</code></td>
            <td><pre><code class="language-application-typescript">hasInheritableArchivedLabel(): boolean</code></pre></td>
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
            <td><code>getRelations</code></td>
            <td><pre><code class="language-application-typescript">getRelations(name?: string): ScriptAttribute[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getOwnedRelations</code></td>
            <td><pre><code class="language-application-typescript">getOwnedRelations(name?: string | null): ScriptAttribute[]</code></pre></td>
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
            <td><code>getRelationTarget</code></td>
            <td><pre><code class="language-application-typescript">getRelationTarget(name: string): ScriptBNote | null</code></pre></td>
        </tr>
        <tr>
            <td><code>hasRelation</code></td>
            <td><pre><code class="language-application-typescript">hasRelation(name: string, value?: string): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>hasOwnedRelation</code></td>
            <td><pre><code class="language-application-typescript">hasOwnedRelation(name: string, value?: string): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>addLabel</code></td>
            <td><pre><code class="language-application-typescript">addLabel(name: string, value?: string, isInheritable?: boolean): ScriptAttribute</code></pre></td>
        </tr>
        <tr>
            <td><code>addRelation</code></td>
            <td><pre><code class="language-application-typescript">addRelation(name: string, targetNoteId: string, isInheritable?: boolean): ScriptAttribute</code></pre></td>
        </tr>
        <tr>
            <td><code>addAttribute</code></td>
            <td><pre><code class="language-application-typescript">addAttribute(type: string, name: string, value?: string, isInheritable?: boolean): ScriptAttribute</code></pre></td>
        </tr>
        <tr>
            <td><code>setLabel</code></td>
            <td><pre><code class="language-application-typescript">setLabel(name: string, value?: string): void</code></pre></td>
        </tr>
        <tr>
            <td><code>setRelation</code></td>
            <td><pre><code class="language-application-typescript">setRelation(name: string, value?: string): void</code></pre></td>
        </tr>
        <tr>
            <td><code>setAttribute</code></td>
            <td><pre><code class="language-application-typescript">setAttribute(type: string, name: string, value?: string): void</code></pre></td>
        </tr>
        <tr>
            <td><code>setAttributeValueById</code></td>
            <td><pre><code class="language-application-typescript">setAttributeValueById(attributeId: string, value?: string): void</code></pre></td>
        </tr>
        <tr>
            <td><code>toggleLabel</code></td>
            <td><pre><code class="language-application-typescript">toggleLabel(enabled: boolean, name: string, value?: string): void</code></pre></td>
        </tr>
        <tr>
            <td><code>toggleRelation</code></td>
            <td><pre><code class="language-application-typescript">toggleRelation(enabled: boolean, name: string, value?: string): void</code></pre></td>
        </tr>
        <tr>
            <td><code>toggleAttribute</code></td>
            <td><pre><code class="language-application-typescript">toggleAttribute(type: string, enabled: boolean, name: string, value?: string): void</code></pre></td>
        </tr>
        <tr>
            <td><code>removeLabel</code></td>
            <td><pre><code class="language-application-typescript">removeLabel(name: string, value?: string): void</code></pre></td>
        </tr>
        <tr>
            <td><code>removeRelation</code></td>
            <td><pre><code class="language-application-typescript">removeRelation(name: string, value?: string): void</code></pre></td>
        </tr>
        <tr>
            <td><code>removeAttribute</code></td>
            <td><pre><code class="language-application-typescript">removeAttribute(type: string, name: string, value?: string): void</code></pre></td>
        </tr>
        <tr>
            <td><code>isInherited</code></td>
            <td><pre><code class="language-application-typescript">isInherited(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>revisionCount</code></td>
            <td><p><code>number | null</code></p></td>
        </tr>
        <tr>
            <td><code>getRevisions</code></td>
            <td><pre><code class="language-application-typescript">getRevisions(): ScriptBRevision[]</code></pre></td>
        </tr>
        <tr>
            <td><code>saveRevision</code></td>
            <td><pre><code class="language-application-typescript">saveRevision(opts?: { description?: string; source?: string }): ScriptBRevision</code></pre></td>
        </tr>
        <tr>
            <td><code>getAttachments</code></td>
            <td><pre><code class="language-application-typescript">getAttachments(): ScriptAttachment[]</code></pre></td>
        </tr>
        <tr>
            <td><code>getAttachmentById</code></td>
            <td><pre><code class="language-application-typescript">getAttachmentById(attachmentId: string): ScriptAttachment</code></pre></td>
        </tr>
        <tr>
            <td><code>getAttachmentByTitle</code></td>
            <td><pre><code class="language-application-typescript">getAttachmentByTitle(title: string): ScriptAttachment | undefined</code></pre></td>
        </tr>
        <tr>
            <td><code>getAttachmentsByRole</code></td>
            <td><pre><code class="language-application-typescript">getAttachmentsByRole(role: string): ScriptAttachment[]</code></pre></td>
        </tr>
        <tr>
            <td><code>saveAttachment</code></td>
            <td><pre><code class="language-application-typescript">saveAttachment(attachment: ScriptSaveAttachmentInput, matchBy?: "title" | "attachmentId"): ScriptAttachment</code></pre></td>
        </tr>
        <tr>
            <td><code>convertToParentAttachment</code></td>
            <td><pre><code class="language-application-typescript">convertToParentAttachment(opts?: Record&lt;string, unknown&gt;): ScriptAttachment | null</code></pre></td>
        </tr>
        <tr>
            <td><code>isEligibleForConversionToAttachment</code></td>
            <td><pre><code class="language-application-typescript">isEligibleForConversionToAttachment(opts?: Record&lt;string, unknown&gt;): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>contentSize</code></td>
            <td><p><code>number | null</code></p></td>
        </tr>
        <tr>
            <td><code>contentAndAttachmentsSize</code></td>
            <td><p><code>number | null</code></p></td>
        </tr>
        <tr>
            <td><code>contentAndAttachmentsAndRevisionsSize</code></td>
            <td><p><code>number | null</code></p></td>
        </tr>
        <tr>
            <td><code>cloneTo</code></td>
            <td><pre><code class="language-application-typescript">cloneTo(parentNoteId: string): ScriptCloneResponse</code></pre></td>
        </tr>
        <tr>
            <td><code>deleteNote</code></td>
            <td><pre><code class="language-application-typescript">deleteNote(deleteId?: string | null): void</code></pre></td>
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
            <td><code>searchNotesInSubtree</code></td>
            <td><pre><code class="language-application-typescript">searchNotesInSubtree(searchString: string): ScriptBNote[]</code></pre></td>
        </tr>
        <tr>
            <td><code>searchNoteInSubtree</code></td>
            <td><pre><code class="language-application-typescript">searchNoteInSubtree(searchString: string): ScriptBNote | null</code></pre></td>
        </tr>
        <tr>
            <td><code>getSearchResultNotes</code></td>
            <td><pre><code class="language-application-typescript">getSearchResultNotes(): ScriptBNote[]</code></pre></td>
        </tr>
        <tr>
            <td><code>isFolder</code></td>
            <td><pre><code class="language-application-typescript">isFolder(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isContentAvailable</code></td>
            <td><pre><code class="language-application-typescript">isContentAvailable(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isStringNote</code></td>
            <td><pre><code class="language-application-typescript">isStringNote(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isHtml</code></td>
            <td><pre><code class="language-application-typescript">isHtml(): boolean</code></pre></td>
        </tr>
        <tr>
            <td><code>isImage</code></td>
            <td><pre><code class="language-application-typescript">isImage(): boolean</code></pre></td>
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
            <td><code>isJson</code></td>
            <td><pre><code class="language-application-typescript">isJson(): boolean</code></pre></td>
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
            <td><code>getScriptEnv</code></td>
            <td><pre><code class="language-application-typescript">getScriptEnv(): "frontend" | "backend" | null</code></pre></td>
        </tr>
        <tr>
            <td><code>executeScript</code></td>
            <td><pre><code class="language-application-typescript">executeScript(): unknown</code></pre></td>
        </tr>
    </tbody>
</table>

## `ScriptRequest`

Minimal Express `Request` surface available to **custom request handlers** (a subset of Express's `Request` — re-declared here to keep this module self-contained). Only the commonly used members are typed; the real object is a full Express request.

<table>
    <thead>
        <tr>
            <th>Member</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>params</code></td>
            <td><p><code>Record&lt;string, string&gt;</code><br>Route/path parameters.</p></td>
        </tr>
        <tr>
            <td><code>query</code></td>
            <td><p><code>Record&lt;string, unknown&gt;</code><br>Parsed query-string parameters.</p></td>
        </tr>
        <tr>
            <td><code>body</code></td>
            <td><p><code>unknown</code><br>Parsed request body (requires a matching body parser).</p></td>
        </tr>
        <tr>
            <td><code>headers</code></td>
            <td><p><code>Record&lt;string, string | string[] | undefined&gt;</code><br>Request headers (lower-cased names).</p></td>
        </tr>
        <tr>
            <td><code>method</code></td>
            <td><p><code>string</code><br>HTTP method, e.g. "GET", "POST".</p></td>
        </tr>
        <tr>
            <td><code>url</code></td>
            <td><p><code>string</code><br>Request URL (path + query string).</p></td>
        </tr>
        <tr>
            <td><code>get</code></td>
            <td><pre><code class="language-application-typescript">get(headerName: string): string | undefined</code></pre><p>Returns the value of the given (case-insensitive) header.</p></td>
        </tr>
    </tbody>
</table>

## `ScriptResponse`

Minimal Express `Response` surface available to **custom request handlers** (a subset of Express's `Response`). Write the HTTP response through this object, e.g. `api.res.status(200).json({ ok: true })`.

<table>
    <thead>
        <tr>
            <th>Member</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>status</code></td>
            <td><pre><code class="language-application-typescript">status(code: number): ScriptResponse</code></pre><p>Sets the HTTP status code (chainable).</p></td>
        </tr>
        <tr>
            <td><code>send</code></td>
            <td><pre><code class="language-application-typescript">send(body?: unknown): ScriptResponse</code></pre><p>Sends the response body (string, Buffer, object, …) and ends the response.</p></td>
        </tr>
        <tr>
            <td><code>json</code></td>
            <td><pre><code class="language-application-typescript">json(body: unknown): ScriptResponse</code></pre><p>Sends a JSON response and ends the response.</p></td>
        </tr>
        <tr>
            <td><code>setHeader</code></td>
            <td><pre><code class="language-application-typescript">setHeader(name: string, value: string | string[]): ScriptResponse</code></pre><p>Sets a response header (chainable).</p></td>
        </tr>
        <tr>
            <td><code>set</code></td>
            <td><pre><code class="language-application-typescript">set(field: string, value?: string): ScriptResponse</code></pre><p>Sets a response header (Express alias of <code>setHeader</code>, chainable).</p></td>
        </tr>
        <tr>
            <td><code>redirect</code></td>
            <td><pre><code class="language-application-typescript">redirect(url: string): void</code></pre><p>Redirects to the given URL.</p></td>
        </tr>
        <tr>
            <td><code>end</code></td>
            <td><pre><code class="language-application-typescript">end(): void</code></pre><p>Ends the response without further data.</p></td>
        </tr>
    </tbody>
</table>

## `ScriptBBranch`

A branch (note→parent placement) as seen by backend scripts (subset of `BBranch`).

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
            <td><code>prefix</code></td>
            <td><p><code>string | null</code></p></td>
        </tr>
        <tr>
            <td><code>notePosition</code></td>
            <td><p><code>number</code></p></td>
        </tr>
        <tr>
            <td><code>isExpanded</code></td>
            <td><p><code>boolean</code></p></td>
        </tr>
        <tr>
            <td><code>getNote</code></td>
            <td><pre><code class="language-application-typescript">getNote(): ScriptBNote</code></pre></td>
        </tr>
        <tr>
            <td><code>getParentNote</code></td>
            <td><pre><code class="language-application-typescript">getParentNote(): ScriptBNote | null</code></pre></td>
        </tr>
    </tbody>
</table>

## `ScriptBRevision`

A note revision as seen by backend scripts (subset of trilium-core's `BRevision`).

<table>
    <thead>
        <tr>
            <th>Member</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>revisionId</code><br><em>optional</em></td>
            <td><p><code>string</code></p></td>
        </tr>
        <tr>
            <td><code>noteId</code></td>
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
            <td><code>title</code></td>
            <td><p><code>string</code></p></td>
        </tr>
        <tr>
            <td><code>dateLastEdited</code><br><em>optional</em></td>
            <td><p><code>string</code></p></td>
        </tr>
        <tr>
            <td><code>utcDateLastEdited</code><br><em>optional</em></td>
            <td><p><code>string</code></p></td>
        </tr>
        <tr>
            <td><code>contentLength</code><br><em>optional</em></td>
            <td><p><code>number</code></p></td>
        </tr>
        <tr>
            <td><code>getContent</code></td>
            <td><pre><code class="language-application-typescript">getContent(): string | Uint8Array&lt;ArrayBufferLike&gt;</code></pre></td>
        </tr>
        <tr>
            <td><code>getJsonContent</code></td>
            <td><pre><code class="language-application-typescript">getJsonContent(): unknown</code></pre></td>
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
            <td><pre><code class="language-application-typescript">format(template?: string): string</code></pre></td>
        </tr>
        <tr>
            <td><code>add</code></td>
            <td><pre><code class="language-application-typescript">add(value: number, unit: string): ScriptDayjsInstance</code></pre></td>
        </tr>
        <tr>
            <td><code>subtract</code></td>
            <td><pre><code class="language-application-typescript">subtract(value: number, unit: string): ScriptDayjsInstance</code></pre></td>
        </tr>
        <tr>
            <td><code>toDate</code></td>
            <td><pre><code class="language-application-typescript">toDate(): Date</code></pre></td>
        </tr>
    </tbody>
</table>

## Types

### `ScriptDayjs`

Minimal day.js surface (the real API exposes the full day.js factory).

```typescript
type ScriptDayjs = (date?: string | number | Date) => ScriptDayjsInstance
```

### `ScriptAttribute`

| Property | Description |
| --- | --- |
| `attributeId` | `string` |
| `type` | `"label" \| "relation"` |
| `name` | `string` |
| `value` | `string` |
| `isInheritable` | `boolean` |
| `isOwned` | `boolean` |

### `ScriptNoteAndBranch`

Result of the backend note-creation helpers.

| Property | Description |
| --- | --- |
| `note` | `ScriptBNote` |
| `branch` | `ScriptBBranch` |

### `ScriptSubtreeOpts`

Options accepted by the subtree traversal helpers on `ScriptBNote`.

| Property | Description |
| --- | --- |
| `includeArchived`  <br>_optional_ | `boolean` |
| `includeHidden`  <br>_optional_ | `boolean` |
| `resolveSearch`  <br>_optional_ | `boolean` |

### `ScriptSubtreeRelationship`

A single parent→child link in a subtree (`ScriptBNote.getSubtree`).

| Property | Description |
| --- | --- |
| `parentNoteId` | `string` |
| `childNoteId` | `string` |

### `ScriptNotePathRecord`

One resolved tree path to a note (subset of the client's `NotePathRecord`).

| Property | Description |
| --- | --- |
| `isArchived` | `boolean` |
| `isInHoistedSubTree` | `boolean` |
| `isSearch`  <br>_optional_ | `boolean` |
| `notePath` | `string[]` |
| `isHidden` | `boolean` |

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

### `ScriptSaveAttachmentInput`

Input accepted by `ScriptBNote.saveAttachment`.

| Property | Description |
| --- | --- |
| `attachmentId`  <br>_optional_ | `string` |
| `role` | `string` |
| `mime` | `string` |
| `title` | `string` |
| `content`  <br>_optional_ | `string \| Uint8Array<ArrayBufferLike>` |
| `position`  <br>_optional_ | `number` |

### `ScriptCloneResponse`

Result of a clone operation (`ScriptBNote.cloneTo`); mirrors `CloneResponse`.

| Property | Description |
| --- | --- |
| `success` | `boolean` |
| `message`  <br>_optional_ | `string` |
| `branchId`  <br>_optional_ | `string` |
| `notePath`  <br>_optional_ | `string` |