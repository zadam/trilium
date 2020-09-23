const repository = require('../../src/services/repository');
const sql = require('../../src/services/sql');

module.exports = () => {
    for (const note of repository.getEntities("SELECT * FROM notes")) {
        let position = 0;

        for (const branch of note.getChildBranches()) {
            sql.execute(`UPDATE branches SET notePosition = ? WHERE branchId = ?`, [position, branch.branchId]);

            position += 10;
        }
    }
};
