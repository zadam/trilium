# Sorting Notes
## Manual sorting

You can sort notes by right-clicking the parent note in the <a class="reference-link" href="../UI%20Elements/Note%20Tree.md">Note Tree</a> and selecting Advanced -> Sort notes by ... This will sort existing notes, but will not automatically sort future notes added to this parent note.

The sorting dialog allows:

*   Sorting by title, creation or modification date, or by the value of a label on the child notes.
*   Sorting by several such criteria in turn, each ascending or descending: the next level only decides between notes the previous ones left equal.
*   Ensuring folders are displayed at the top.
*   Natural sort, based on the sorting rules of a particular language.

## Automatic/Permanent Sorting

Child notes can be automatically sorted by attaching specific [labels](../../Advanced%20Usage/Attributes.md) to the parent note:

<table>
    <thead>
        <tr>
            <th>Label</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>#sorted</code></td>
            <td><p>Keeps child notes sorted by title alphabetically.</p><p>When given a value, it will sort by other criteria instead: a comma-separated list of levels, each a label on the child notes written with <code>#</code>, or one of the properties <code>title</code>, <code>dateCreated</code> and <code>dateModified</code>, optionally followed by <code>asc</code> or <code>desc</code>, as in a search's <code>orderBy</code>. For example <code>#sorted="#priority desc, #dueDate"</code> sorts by priority, highest first, and notes of equal priority by due date. A child note without a level's label sorts after every child that has it, whichever direction the level runs in. When neither note has the label, the next level decides.</p><p>A label followed by <code>first</code> or <code>last</code> instead groups the child notes that have it before or after the rest, whatever its value. For example <code>#sorted="#archived last, title"</code> keeps <a href="Archived%20Notes.md">archived notes</a> below the others.</p></td>
        </tr>
        <tr>
            <td><code>#sortDirection</code></td>
            <td><p>If <code>sorted</code> is applied, specifies the direction of the sort:</p><ul><li><code>ASC</code>, ascending (default)</li><li><code>DESC</code>, descending</li></ul><p>A level of <code>sorted</code> followed by its own <code>asc</code> or <code>desc</code> keeps that direction regardless, and so does a <code>first</code> or <code>last</code> group.</p></td>
        </tr>
        <tr>
            <td><code>#sortFoldersFirst</code></td>
            <td>If <code>sorted</code> is applied, folders (notes with children) will be sorted as a group at the top (at the bottom when <code>#sortDirection</code> is <code>desc</code>), and the rest will be sorted.</td>
        </tr>
        <tr>
            <td><code>#sortNatural</code></td>
            <td>Sort numbers naturally instead of alphabetically, so 2 comes before 10.</td>
        </tr>
        <tr>
            <td><code>#sortLocale</code></td>
            <td>The language code driving the natural sort (e.g. <code>zh-CN</code>, <code>de</code>). Only meaningful together with <code>#sortNatural</code>.</td>
        </tr>
        <tr>
            <td><code>#top</code></td>
            <td>If <code>sorted</code> is applied to the parent note, keeps given note on top in its parent.</td>
        </tr>
        <tr>
            <td><code>#bottom</code></td>
            <td>If <code>sorted</code> is applied to the parent note, keeps given note on bottom in its parent.</td>
        </tr>
    </tbody>
</table>

Sorting is done by comparing note properties or specific labels on child notes. There are four sorting levels, with the first having the highest priority. Lower priority levels are applied only if higher priority comparisons result in equality.

1.  **Top Label Sorting**: Child notes with the `#top` label will appear at the top of the folder, unless `#sorted` places `#top` itself (see below).
2.  **Bottom Label Sorting**: (Introduced in Trilium 0.62) Child notes with the `#bottom` label will appear at the bottom of the folder, unless `#sorted` places `#bottom` itself.
3.  **Property/Label-Based Sorting**: Sorting is based on the parent note's `#sorted` label:
    *   **Default Sorting**: If `#sorted` has no value, notes are sorted alphabetically.
    *   **Property Sorting**: If `#sorted` is set to `title`, `dateModified`, or `dateCreated`, notes are sorted based on the specified property.
    *   **Label Sorting**: If `#sorted` is set to the name of a child note's label, sorting is based on the values of this label. For example, setting `#sorted=#myOrder` on the parent note and using `#myOrder=001`, `#myOrder=002`, etc., on child notes. A single name without `#` that is not one of the properties above is also treated as a label, so `#sorted=myOrder` works the same way.
    *   **Multi-Level Sorting**: Several of the above can be combined, separated by commas; each level is applied only where the previous ones are equal. A label is written with `#` and a property without it. Every level can carry its own direction as a word after the name, `asc` or `desc`, otherwise it follows `#sortDirection`. For example `#sorted="#priority desc, #area, dateCreated"` sorts by priority, highest first, then by area, then by creation date.
    *   **Grouping**: A label followed by `first` or `last` puts the child notes that have it, with any value, before or after the rest, regardless of `#sortDirection`. The following levels then sort within each group. For example `#sorted="#archived last, #priority desc"`. Notes with `#top` or `#bottom` stay at the top or bottom even when they belong to a group, unless `#sorted` names those labels too.
    *   **Placing `#top` and `#bottom`**: Naming `#top` or `#bottom` in `#sorted` applies it at that position instead of before every level. For example `#sorted="#archived last, #top first, #bottom last, title"` keeps archived notes below all the others, including those with `#bottom`, and `#top` and `#bottom` then apply within each of the two groups. `#sortFoldersFirst` groups folders right after the last of `#top` and `#bottom`, so here archived folders also sort below the other notes. Written with `first` or `last`, the labels ignore their values; to order several pinned notes by value, add a level such as `#top` or `#bottom desc` after them.
4.  **Alphabetical Sorting**: Used as a last resort when other criteria result in equality.

> [!WARNING]
> Since v0.107.0, a label in a multi-level `#sorted` must be written with `#`. In v0.106.0 the names were written bare, as in `#sorted="priority desc, dueDate"`; such a value now reads both names as properties that do not exist and falls back to sorting by title. Add a `#` before each label name to restore it.

All comparisons are made string-wise (e.g., "1" \< "2" or "2020-10-10" < "2021-01-15", but also "2" \> "10").