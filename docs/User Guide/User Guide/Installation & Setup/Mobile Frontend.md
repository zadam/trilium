# Mobile Frontend
<figure class="image image-style-align-right image_resized" style="width:33.52%;"><img style="aspect-ratio:1242/2688;" src="Mobile Frontend_IMG_1765.PNG" width="1242" height="2688"></figure>

Trilium has a mobile web frontend which is optimized for touch based devices - smartphones and tablets. It is activated automatically during login process based on browser detection.

Mobile frontend is limited in features compared to the full desktop version. See below for more details on this.

## Layout basics

Unlike the desktop version, the mobile version has a slightly different UI meant to better fit the constrained screens of a mobile phone.

Here is a non-exhaustive list of differences between the desktop version and the mobile one:

*   The <a class="reference-link" href="../Basic%20Concepts%20and%20Features/UI%20Elements/Note%20Tree.md">Note Tree</a> is displayed as a sidebar. To display the sidebar, press the button in the top-left of the screen.
    *   There is also a swipe gesture that can be done from the left of the screen, but the browser's navigation gesture interferes with it most of the time (depending on the platform).
    *   Press and hold a note to display the <a class="reference-link" href="../Basic%20Concepts%20and%20Features/UI%20Elements/Note%20Tree/Note%20tree%20contextual%20menu.md">Note tree contextual menu</a>.
*   The <a class="reference-link" href="../Basic%20Concepts%20and%20Features/Navigation/Quick%20search.md">Quick search</a> bar is also displayed at the top of the note tree.
*   The full <a class="reference-link" href="../Basic%20Concepts%20and%20Features/Navigation/Search.md">Search</a> function can be triggered either from either the <a class="reference-link" href="../Basic%20Concepts%20and%20Features/UI%20Elements/Global%20menu.md">Global menu</a> or from the <a class="reference-link" href="../Basic%20Concepts%20and%20Features/UI%20Elements/Launch%20Bar.md">Launch Bar</a>, if configured.
*   The <a class="reference-link" href="../Basic%20Concepts%20and%20Features/UI%20Elements/Global%20menu.md">Global menu</a> is shorter: _Open new window_ and _Show cheatsheet_ are left out, and _Switch to desktop version_ is under _Advanced_.
*   The <a class="reference-link" href="../Basic%20Concepts%20and%20Features/UI%20Elements/Launch%20Bar.md">Launch Bar</a> is displayed at the bottom of the screen.
    *   The launch bar uses a different configuration for icons than the desktop version. See the dedicated page for more information on how to configure it.
*   Most of the note-related actions are grouped in the horizontal dots icon on the top-right of the note.
*   In a text note, the formatting toolbar sits at the bottom of the screen as a single row that scrolls sideways. It is shown only while you are editing the text, and hides when you hide the keyboard or move to another field, such as the note title. It starts with _Undo_ and _Redo_, since the on-screen keyboard has no keys for them. While the cursor is in a table, an image, a code block, a link or another element that has a toolbar of its own on desktop, a highlighted button naming that element, such as _Table ›_, follows them; it replaces the formatting toolbar with the element's toolbar, which starts with a back button that closes it again, followed by the element's name ahead of its tools, and goes away when the cursor leaves the element. Selecting an element as a whole, such as an image, or tapping a link shows its toolbar right away; tap the back button to return to the formatting toolbar. Its buttons with a list of choices, such as the column and row actions of a table, open that list as a menu at the bottom of the screen, where an option that is on or off, such as a table's header row, is a switch. The <span class="tn-icon cke cke-plus"></span> button after them opens insertions as tiles at the bottom of the screen: code block, block quote and admonition (also in the block type button), then the less common table, collapsible, tabs, columns, horizontal line, page break, footnote, math, drawing canvas, Mermaid diagram, bookmark, link and content embeds, special characters, emoji, icon, date/time, template and Markdown import. The tiles marked with <span class="tn-icon bx bx-chevron-right"></span> open a list of choices: _Code block_ the language, _Admonition_ its type, _Insert table_ the size of the table, _Columns_ the number of columns, _Footnote_ a new footnote or a reference to an existing one, _Date/time_ the format of the date and time, and _Insert text snippet_ the template to insert, which is grayed out while there are none. The block type button shows the type of the current block as an icon rather than its name, and opens the block types as tiles at the bottom of the screen, with the current one highlighted: paragraph and heading 2 to 6, then bulleted list, numbered list and to-do list, then code block, block quote and admonition. Picking a paragraph or a heading in a list turns the item back into plain text, and the same goes for a code block. Block quote and admonition wrap the current block rather than replace it, so they are highlighted alongside it; pick one again to remove it. Typing `-` , `1.` or `[ ]` at the start of a line also starts a list. While the cursor is in a bulleted or numbered list, a _List ›_ button follows _Undo_ and _Redo_: its row holds _List style_, which opens the markers (such as squares or roman numerals) as tiles, and, in a numbered list, _Start at_, which asks for the number the list starts at, and _Reversed order_. The <span class="tn-icon cke cke-trilium-ai"></span> AI assistant button, shown once a provider is configured, opens its quick actions as a menu at the bottom of the screen, with _Ask AI…_ at its top. The alignment button shows the alignment of the current block, and opens left, center, right and justify as a row of tiles, with the current one highlighted. The <span class="tn-icon cke cke-paper-clip"></span> button replaces the separate image upload and attach file buttons: it opens _Image_, _Camera_, _Attach and embed file_ and _Attach file as a link_ as a list. _Camera_ opens the device's camera and inserts the photo taken; the others open the device's file picker. The <span class="tn-icon cke cke-link"></span> link button replaces the separate link and internal link buttons: it opens the _Add link_ dialog, which links to a note or to a web address, or _Edit link_ when the cursor is inside a link. The dialog does not open the keyboard by itself; tap the note or address field to type. The same button is on the row of text formatting, after the inline styles, to turn selected text into a link. The <span class="tn-icon cke cke-arrow-up"></span> and <span class="tn-icon cke cke-arrow-down"></span> buttons after the indentation buttons move the current block, or the selected blocks, up or down, as <kbd>Alt</kbd>+<kbd>↑</kbd> and <kbd>Alt</kbd>+<kbd>↓</kbd> do on a keyboard. Inside a table they move the row instead.
    *   The formatting applied to text (bold, italic, underline, strikethrough, inline code, superscript and subscript, keyboard shortcut, font size and colors, and removing formatting) is on a row of its own, which ends with <span class="tn-icon cke cke-trilium-scissors"></span> to cut the selection into a sub-note. Tap <span class="tn-icon cke cke-text"></span> next to the block type button to show it, and <span class="tn-icon cke cke-previous-arrow"></span> at its start to return to the main row. Selecting text shows this row on its own, and it goes back to the main row once the selection is gone (for example as you start typing), unless you opened or closed the row yourself in the meantime. The font size button opens the list of sizes as a menu at the bottom of the screen, each drawn at its size, with the current one checked. A single color button replaces the separate text and background color buttons: it opens a menu with a row of colors for the text and one for its background, each with a cell that removes the color and one that opens the device's color picker.
*   While the on-screen keyboard is open, a <span class="tn-icon bx bxs-keyboard"></span> button in the bottom-right corner, just above the keyboard, hides it. In a text note, the button is at the right end of the formatting toolbar. While a menu of the formatting toolbar is open in place of the keyboard, the button becomes a <span class="tn-icon bx bx-x"></span>, which closes the menu and brings the keyboard back. This works in every note type and in every text field, and is the only way to hide the keyboard in the iOS app, where the keyboard has no _Done_ button.
*   The <a class="reference-link" href="../Basic%20Concepts%20and%20Features/UI%20Elements/Tabs.md">Tabs</a> are grouped under a tab switcher in the <a class="reference-link" href="../Basic%20Concepts%20and%20Features/UI%20Elements/Launch%20Bar.md">Launch Bar</a>, where the tabs are displayed in a full-screen grid with preview for easy switching, as well as additional options such as reopening closed tabs.
*   Since v0.100.0, <a class="reference-link" href="../Basic%20Concepts%20and%20Features/UI%20Elements/Split%20View.md">Split View</a> can also be used in mobile view, but with a maximum of two panes at once. The splits are displayed vertically instead of horizontally.

## Installing as a PWA

The mobile view can be set up as a PWA. While this does not offer any offline capabilities, it will display the application in full-screen and makes it easy to access via your mobile phone's home screen.

=== "<span class="tn-icon bx bxl-apple"></span> iOS with Safari"

    1.  Open your default web browser and access your Trilium instance.
    2.  Login.
    3.  Press the \[…\] button in the bottom-right of the screen and select Share.
    4.  Scroll down to reveal the full list of items and choose _Add to Home Screen_.
    5.  Press _Add_ and the web app will be available.

=== "<span class="tn-icon bx bxl-chrome"></span> Android with Google Chrome"

    > [!IMPORTANT]
    > Google Chrome requires the server to be served over HTTPS in order to display in full-screen. If using HTTP, the app will appear like a normal web page (similar to a bookmark).

    1.  Open your default web browser and access your Trilium instance.
    2.  Login.
    3.  Press the three vertical dots icon in the top-right of the screen and select _Add to Home screen._
    4.  Select the _Install_ option.
    5.  Select an appropriate name.
    6.  The web app will appear as an application, not on the home screen.

=== "Android with Brave"

    > [!IMPORTANT]
    > Brave requires the server to be served over HTTPS in order to display in full-screen. If using HTTP, the app will appear like a normal web page (similar to a bookmark).

    1.  Open your default web browser and access your Trilium instance.
    2.  Login.
    3.  Press the three vertical dots icon in the bottom-right of the screen and select _Add to Home screen_.
    4.  Press the _Install_ option.
    5.  The web app will appear as an application, not on the home screen.

=== "Samsung Browser"

    1.  Open your default web browser and access your Trilium instance.
    2.  Login.
    3.  Press the hamburger menu in the bottom-right of the screen.
    4.  Select _Add to_, followed by _Home screen_.
    5.  Press _Add_ and the web app will appear on the home page.

## Sharing to Trilium

Once installed as a PWA on Android, Trilium appears in the system's share menu, so links, text, images and other files can be sent to it from other apps. Shared content is saved to the <a class="reference-link" href="../Basic%20Concepts%20and%20Features/Notes/Note%20Inbox.md">Note Inbox</a>, and Trilium opens the note it created:

*   Text or a link becomes a text note. A shared link is also stored in the `#pageUrl` label.
*   A single file becomes an image note or a file note, placed directly in the inbox.
*   Several files, or files shared together with text, are placed under a new text note that holds the text.

Every note created this way carries the `#clipType=share` label, which gives a shared text note the <span class="tn-icon bx bx-share"></span> icon unless the note has an `#iconClass` of its own. A single share can carry at most 20 files.

> [!NOTE]
> Sharing requires being logged in. If the session has expired, log in again and share once more.

## Testing via the desktop application

If you are running Trilium without a dedicated [server installation](Server%20Installation.md), you can still test the mobile application using the desktop application. For more information, see <a class="reference-link" href="Desktop%20Installation/Using%20the%20desktop%20application%20as%20a%20server.md">Using the desktop application as a server</a>. To access it go to `http://<ip>:37840/login?mobile` .

## Forcing mobile/desktop frontend

Trilium decides automatically whether to use mobile or desktop front-end. If this is not appropriate, you can use `?mobile` or `?desktop` query param on **login** page (Note: you might need to log out).

Alternatively, simply select _Switch to mobile version_ in the <a class="reference-link" href="../Basic%20Concepts%20and%20Features/UI%20Elements/Global%20menu.md">Global menu</a>. In the mobile version, select _Advanced_ → _Switch to desktop version_ there instead.

## Scripting

You can alter the behavior with <a class="reference-link" href="../Scripting.md">Scripting</a>, just like for normal frontend. For script notes to be executed, they need to have labeled `#run=mobileStartup`.

Custom <a class="reference-link" href="../Basic%20Concepts%20and%20Features/UI%20Elements/Launch%20Bar.md">Launch Bar</a> widgets are also supported.