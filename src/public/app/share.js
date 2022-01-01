/**
 * Fetch note with given ID from backend
 *
 * @param noteId of the given note to be fetched. If falsy, fetches current note.
 */
async function fetchNote(noteId = null) {
    if (!noteId) {
        noteId = document.getElementsByName("body")[0].getAttribute("data-note-id");
    }

    const resp = await fetch(`share/api/notes/${noteId}`);

    return await resp.json();
}

document.addEventListener('DOMContentLoaded', () => {
    const toggleMenuButton = document.getElementById('toggleMenuButton');
    const layout = document.getElementById('layout');

    toggleMenuButton.addEventListener('click', () => layout.classList.toggle('showMenu'));
}, false);
