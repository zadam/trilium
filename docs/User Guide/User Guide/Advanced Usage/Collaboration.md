# Collaboration
A collaboration opens one note, or a note with all the notes under it, to guests who are not users of your Trilium. Guests open a link in any browser, see the note the way a [shared](Sharing.md) note looks, and, when you allow it, edit it or add notes under it. There are no guest accounts: each capability is either open to anyone who has the link or needs a password you set.

Sharing stays what it is, a read-only publication. Collaboration is a separate feature with its own link, its own settings and its own permissions, so a note can be shared, collaborated on, both or neither.

## Starting a collaboration

Open the note, then choose **Collaborate…** from the note menu (the ⋮ button in the note's title row). The dialog that opens holds every setting:

*   **Include child notes** opens the notes under this one too. Guests see them in a tree next to the note, with the same capabilities as the note itself. Notes added or moved under it later are included automatically.
*   **View** is either open to anyone with the link, or needs a password.
*   **Edit** is off, open to anyone with the link, or needs a password. Editing covers the content and the title of text, code, Markdown, Mermaid diagram, canvas and mind map notes in the collaboration, and the title of collections; other note types stay read-only for guests. Editing cannot be open to anyone while viewing needs a password.
*   **Add child notes** lets guests create new text notes under any note in the collaboration. It is never open to anyone: it is off or needs a password, and it is only offered while child notes are included and editing is allowed.
*   **Guest limit** caps how many guests can be connected at the same time. The default is 10 and the largest value is 1000. A guest who arrives when the limit is reached sees a "collaboration is full" page and can try again later. The host's own session never counts, and a guest who holds a password counts once however many tabs they have open.
*   **Link name** replaces the generated id in the link with a readable name of your choosing, such as `team-notes`.
*   **Your name** is the name guests see for you in the list of people and beside your cursor. Left empty, you are “Host”.

Press **Start collaboration**. The dialog shows the link with buttons to copy it or open it in a browser, and the note's title row shows a **Collaboration** badge. Its menu copies or opens the link, opens the settings and stops the collaboration.

When both viewing and editing need a password, one password opens both unless you tick **Use a separate password for editing**; then guests with the view password can only read. The password for adding notes follows the editing password the same way, with **Use a separate password for adding notes** to give it one of its own. A guest who enters a password unlocks every capability it matches. Leave a password field empty when changing other settings to keep the password a guest already uses.

## What guests see

The link leads to a page built like a [shared](Sharing.md) note, in a dark or light theme. The sidebar holds a tree with the opened note at its top and, when child notes are included, the notes under it. The note's icon sits left of its title, and under the title the page shows the note's type and when it was created and last changed. A note's children follow its text as cards showing the start of their content, or the picture of a diagram, canvas or mind map, as in the app. Notes keep their color in the tree, on their cards and on their icon, toned for the page's light or dark theme the same way the app tones them.

The **…** beside the title opens the note's options, drawn as the app's note menu. Every guest can copy a link to the note, download it and print it. A guest who may edit can also change the note's type from its **Note type** submenu, to Text, Collection, Canvas, Mermaid Diagram, Mind Map, Code or Markdown as the app names them, and a code note's language from its **Language** submenu, which lists the languages your code-notes options enable, as the app's own list does, with a field to search them. The ones your Trilium can run, which are JavaScript, JSX, HTML and the SQL console, show there but only you can choose them. As in the app, the content stays as it was; a canvas or mind map that cannot read it starts empty. A guest who may add notes can add a child note from there too. The icon at the top right of the page logs the guest out, so passwords have to be entered again.

When child notes are included, the notes a guest opens line up as tabs at the top of the page; a tab's × closes it. The back and forward buttons to the left of the tabs retrace the notes visited in that browser tab. The tabs, and the formatting toolbar of a guest who may edit, stay in view while the note scrolls. Moving to another note, from the tree, a tab, a card or a link, switches the page in place without reloading it. The editor and its toolbar stay loaded while the next note is a text, code or Mermaid note of the same type; a canvas, a mind map, a collection or a note of another type loads the page again.

A guest who may edit gets the editor of the note's type, and their changes save automatically:

*   a text editor with the common formatting tools for text notes, where an empty note shows the app's prompt to type its content;
*   a code editor for code and Markdown notes, in the app's default code colors for the page's light or dark theme;
*   for a Mermaid diagram, its source next to the diagram it draws, which shows Mermaid's message while the source does not parse. The buttons left of the **…** switch between the source alone, both side by side and the diagram alone, as in the app; the view is split until the guest picks another, which then holds in that browser tab;
*   the app's canvas for canvas notes, and the app's mind map for mind maps, with their own toolbars and menus. Guests cannot add pictures to a canvas; the pictures it already holds stay;
*   nothing for a collection, which shows its child notes as cards.

Each save of a diagram, canvas or mind map also stores the picture of it that guests who only read, and [shared](Sharing.md) pages, show in its place.

A guest who may edit can also:

*   rename the note by typing in its title. Enter moves to the start of the text, as in the app.
*   change the note's icon by clicking it beside the title, or any note's color or icon by right-clicking it in the tree. The color picker is the app's own and the icons are the built-in packs. Both set the note's `color` and `iconClass` labels, as the app does.

A guest who may add notes gets a **+** on each note in the tree. It creates a note named "New note" under that note, as the app does, and opens it with the title selected, so typing names it.

A password is only asked for when the guest tries something that needs it. A collaboration whose view is open shows the note at once and offers an **Unlock** form for the editing or adding password above the note.

Changes reach everyone on the page as they happen: a guest who is reading sees the new version in place, keeping their place in the note, and a guest who is editing keeps their own text until they stop typing. The tree, and each note's title, color and icon in it, update for every guest without reloading the page. When two people change the same note at the same time, the second save is refused and the guest chooses between loading the other version and keeping their own.

Guests cannot:

*   see or change attributes other than the color and icon, move, clone, delete or protect notes, or upload files and images;
*   reach anything outside the collaboration, including [protected notes](../Basic%20Concepts%20and%20Features/Notes/Protected%20Notes.md) inside it, which are left out;
*   run or edit [scripts](../Scripting.md); a note's own scripts never run on the guest page. Code notes your Trilium runs or renders, which are JavaScript, JSX, SQL console and HTML notes, stay read-only to guests, and a guest cannot switch a note into one of those types;
*   edit or switch a note to the types the guest page has no editor for: render, web view, relation map, saved search, note map, AI chat and spreadsheet notes stay read-only to guests;
*   use the rest of your Trilium: a guest's session never becomes a login.

## People and cursors

The foot of the sidebar of every collaboration page lists the people on the collaboration's pages right now, the host included, and so does the sidebar a phone opens. Each person has a color, shown on their initial in the list and on their cursor. The list marks the host with a _Host_ tag and the guest's own row with “(you)”, shows a pencil beside everyone who has the open note in an editor and, when child notes are included, the note each person is on.

Guests are named “Guest 1”, “Guest 2” and so on, numbered as they arrive. A guest who reloads the page, or comes back within two minutes, keeps their number. To choose a name, a guest presses the <span class="tn-icon bx bx-rename"></span> button on their own row and types it; the name lasts as long as their session on the collaboration, so logging out starts them over as a new guest. You set your own name with **Your name** in the collaboration's settings.

Everyone who edits a text, code, Markdown or Mermaid note sees the others' cursors and selections in it, in their colors, with the person's name at the cursor for a few seconds after it moves. Your cursor reaches the guests while you edit the note in Trilium, and theirs show in your editor. Canvas and mind map notes show who is there, but no cursors.

### Managing the people in Trilium

While a guest is on the pages, the title row of every note the collaboration includes shows a <span class="tn-icon bx bx-user"></span> badge with the number of people present. Its menu lists them, each with their note, and each person's submenu offers:

*   **Rename**, which changes the name everyone sees. Renaming yourself sets **Your name**.
*   **Remove**, for a guest, which signs them out of the collaboration and closes their pages. Removing does not block anyone: through an open link they can come back as a new guest, and through a password link they need the password again. To keep someone out, also change the password.

## Attribution and history

Every guest change creates a [revision](../Basic%20Concepts%20and%20Features/Notes/Note%20Revisions.md) marked as coming from a collaboration, so you can see what guests changed and go back to an earlier version. Server-side scripts that react to a note's changes run for guest edits the same way they run for edits made over [ETAPI](ETAPI%20\(REST%20API\).md) or by the web clipper.

## Changing or stopping

Open the dialog again from the note menu or from the badge to change any setting; the change applies to the next request a guest makes. **Stop collaboration** closes every guest's page at once, the link stops working and the note is a normal private note again. Starting a new collaboration on the same note creates a new link.

## Where the link is served

The link points at the Trilium instance you are using, or at the [sync server](../Installation%20%26%20Setup/Synchronization.md) when one is configured, because that is the instance guests can reach. The settings sync between your instances like the rest of your notes, so a collaboration set up on the desktop is served by the sync server. Every instance in the sync cluster needs a version that knows about collaborations.

Guests then connect to the sync server, which your desktop app does not see them through: while a sync server serves the link, the desktop shows no people badge, cannot rename or remove guests, and exchanges no cursors with them, and the guests do not see you on the pages. Open the sync server's own web interface to work with them there.

Trilium stays a single-user application: see the [FAQ](../FAQ.md) on multi-user support for what collaboration does not try to be.