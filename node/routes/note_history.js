const express = require('express');
const router = express.Router();
const sql = require('../sql');

router.get('/:noteId', async (req, res, next) => {
    const noteId = req.params.noteId;

    const history = await sql.getResults("select * from notes_history where note_id = ? order by date_modified desc", [noteId]);

    res.send(history);
});

module.exports = router;