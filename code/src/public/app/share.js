/**
 * Fetch note with given ID from backend
 *
 * @param noteId of the given note to be fetched. If false, fetches current note.
 */
async function fetchNote(noteId = null) {
    if (!noteId) {
        noteId = document.body.getAttribute("data-note-id");
    }

    const resp = await fetch(`api/notes/${noteId}`);

    return await resp.json();
}

document.addEventListener('DOMContentLoaded', () => {
    const toggleMenuButton = document.getElementById('toggleMenuButton');
    const layout = document.getElementById('layout');

    if (toggleMenuButton && layout) {
        toggleMenuButton.addEventListener('click', () => layout.classList.toggle('showMenu'));
    }
}, false);
