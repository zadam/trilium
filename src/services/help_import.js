const cls = require("./cls");
const zipImport = require("../services/import/zip");
const TaskContext = require("./task_context");
const becca = require("../becca/becca");
const beccaLoader = require("../becca/becca_loader");
const fs = require("fs").promises;

const HELP_FILE_PATH = '/home/adam/Downloads/Help1.zip';

beccaLoader.beccaLoaded.then(() => {
    cls.init(async () => {
        const helpRoot = becca.getNote("_help");
        const taskContext = new TaskContext('no-progress-reporting', null, {});
        const data = await fs.readFile(HELP_FILE_PATH, "binary");

        await zipImport.importZip(taskContext, Buffer.from(data, 'binary'), helpRoot);
    });
});
