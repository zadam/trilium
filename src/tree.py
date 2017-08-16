from flask_restful import Resource
from sql import getResults
from flask_restful import Resource

from sql import getResults


class Tree(Resource):
    def get(self):
        notes = getResults("select "
                           "notes_tree.*, "
                           "COALESCE(clone.note_title, notes.note_title) as note_title, "
                           "notes.note_clone_id, "        
                           "case when notes.note_clone_id is null or notes.note_clone_id = '' then 0 else 1 end as is_clone "
                           "from notes_tree "
                           "join notes on notes.note_id = notes_tree.note_id "
                           "left join notes as clone on notes.note_clone_id = clone.note_id "
                           "order by note_pid, note_pos")

        rootNotes = []
        notesMap = {}

        for note in notes:
            note['children'] = []

            if not note['note_pid']:
                rootNotes.append(note)

            notesMap[note['note_id']] = note

        for note in notes:
            if note['note_pid'] != "":
                parent = notesMap[note['note_pid']]

                parent['children'].append(note)
                parent['folder'] = True

        return rootNotes
