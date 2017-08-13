from flask_restful import Resource

from sql import execute, getSingleResult, commit


class MoveAfterNote(Resource):
    def put(self, note_id, after_note_id):
        after_note = getSingleResult("select * from notes_tree where note_id = ?", [after_note_id])

        if after_note <> None:
            execute("update notes_tree set note_pos = note_pos + 1 where note_pid = ? and note_pos > ?", [after_note['note_pid'], after_note['note_pos']])

            execute("update notes_tree set note_pid = ?, note_pos = ? where note_id = ?", [after_note['note_pid'], after_note['note_pos'] + 1, note_id])

            commit()
