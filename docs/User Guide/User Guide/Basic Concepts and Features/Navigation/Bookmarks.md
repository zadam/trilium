# Bookmarks
Frequently used notes can be bookmarked, which will make them appear in the <a class="reference-link" href="../UI%20Elements/Launch%20Bar.md">Launch Bar</a> for easy access.

## Configuring the launch bar

If bookmarks don't appear in the launch bar, then most likely the bookmark section has been hidden. Go to the <a class="reference-link" href="../UI%20Elements/Launch%20Bar.md">Launch Bar</a> configuration from the <a class="reference-link" href="../UI%20Elements/Global%20menu.md">Global menu</a> and ensure _Bookmarks_ is in the _Visible Launchers_ section.

## Bookmark folder

Space in the left panel is limited, and you might want to bookmark many items. One possible solution is to bookmark a folder, so it shows its children:

To do this, bookmark a folder, then right click its button in the <a class="reference-link" href="../UI%20Elements/Launch%20Bar.md">Launch Bar</a> and check _Show as a folder_. The button then opens a list of the note's children instead of the note itself. Uncheck _Show as a folder_ to turn it back into a regular bookmark.

_Show as a folder_ assigns the `#bookmarkFolder` label to the note, so adding the label by hand works as well. Because the label belongs to the note, a note that is both bookmarked and dropped onto the launch bar shows its children in both places.

## Mobile

On mobile, bookmarks are only displayed starting with v0.102.0. Because of the more constrained screen size, the bookmarks are grouped under a single icon instead of displaying them as separate icons.

When pressed, a menu will appear listing all the bookmarks. Bookmark folders are also supported and will appear as sub-menus.