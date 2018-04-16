-- index confuses planner and is mostly useless anyway since we're mostly used in non-deleted notes (which are presumably majority)
DROP INDEX IDX_notes_isDeleted;