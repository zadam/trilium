// the history was previously not exposed and the fact they were not cleaned up is rather a side-effect than an intention

module.exports = () => {
    const cls = require("../../src/services/cls");
    const beccaLoader = require("../../src/becca/becca_loader");
    const becca = require("../../src/becca/becca");

    cls.init(() => {
        beccaLoader.load();

        // deleting just branches because they might be cloned (and therefore saved) also outside of the hidden subtree

        const searchRoot = becca.getNote('_search');

        for (const searchBranch of searchRoot.getChildBranches()) {
            const searchNote = searchBranch.getNote();

            if (searchNote.type === 'search') {
                searchBranch.deleteBranch('0206__delete_search_and_sql_console_history');
            }
        }

        const sqlConsoleRoot = becca.getNote('_sqlConsole');

        for (const sqlConsoleBranch of sqlConsoleRoot.getChildBranches()) {
            const sqlConsoleNote = sqlConsoleBranch.getNote();

            if (sqlConsoleNote.type === 'code' && sqlConsoleNote.mime === 'text/x-sqlite;schema=trilium') {
                sqlConsoleBranch.deleteBranch('0206__delete_search_and_sql_console_history');
            }
        }
    });
};
