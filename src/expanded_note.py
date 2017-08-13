from flask_restful import Resource

from sql import execute, commit


class ExpandedNote(Resource):
    def put(self, note_id, expanded):
        execute("update notes_tree set is_expanded = ? where note_id = ?", [expanded, note_id])

        commit()
