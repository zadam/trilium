from flask_restful import Resource

from sql import execute, getSingleResult, commit


class MoveToNote(Resource):
    def put(self, note_id, parent_id):
        res = getSingleResult('select max(note_pos) as max_note_pos from notes_tree where note_pid = ?', [parent_id])
        max_note_pos = res['max_note_pos']
        new_note_pos = 0

        if max_note_pos is None: # no children yet
            new_note_pos = 0
        else:
            new_note_pos = max_note_pos + 1

        execute("update notes_tree set note_pid = ?, note_pos = ? where note_id = ?", [parent_id, new_note_pos, note_id])

        commit()