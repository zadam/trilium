const sqlInit = require("./sql_init");
const cls = require("./cls");
const zipImport = require("../services/import/zip");
const TaskContext = require("./task_context");
const becca = require("../becca/becca");
const fs = require("fs").promises;

const HELP_FILE_PATH = '/home/adam/Downloads/Help1.zip';

sqlInit.dbReady.then(() => {
    cls.init(async () => {
        const helpRoot = becca.getNote("_help");
        const taskContext = new TaskContext('no-progress-reporting', null, {});
        const data = await fs.readFile(HELP_FILE_PATH, "binary");

        console.log("BUGGER LENGTH", data.length);

        await zipImport.importZip(taskContext, Buffer.from(data, 'binary'), helpRoot);
    });
});
