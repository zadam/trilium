const becca = require("../../becca/becca");
const bulkActionService = require("../../services/bulk_actions");

function execute(req) {
    const {noteIds} = req.body;

    const bulkActionNote = becca.getNote('bulkaction');

    bulkActionService.executeActions(bulkActionNote, noteIds);
}

module.exports = {
    execute
};
