from flask_restful import Resource
from sql import getResults
from flask_restful import Resource

from sql import getResults


class Tree(Resource):
    def get(self):
        notes = getResults("select notes_tree.*, notes.note_title from notes_tree join notes on notes.note_id = notes_tree.note_id order by note_pid, note_pos")

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
