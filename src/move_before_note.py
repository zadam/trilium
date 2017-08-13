from flask_restful import Resource

from sql import execute, getSingleResult, commit


class MoveBeforeNote(Resource):
    def put(self, note_id, before_note_id):
        before_note = getSingleResult("select * from notes_tree where note_id = ?", [before_note_id])

        if before_note <> None:
            execute("update notes_tree set note_pos = note_pos + 1 where note_id = ?", [before_note_id])

            execute("update notes_tree set note_pid = ?, note_pos = ? where note_id = ?", [before_note['note_pid'], before_note['note_pos'], note_id])

            commit()
