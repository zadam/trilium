UPDATE notes SET title = 'Recovered protected note', isProtected = 0 WHERE noteId IN (
    SELECT noteId FROM notes JOIN note_contents USING(noteId)
    WHERE notes.isProtected = 1
      AND note_contents.isProtected = 0
      AND notes.isDeleted = 0
)