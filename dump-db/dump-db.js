#!/usr/bin/env node

const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const dumpService = require("./inc/dump.js");

yargs(hideBin(process.argv))
    .command('$0 <path_to_document> <target_directory>', 'dump the contents of document.db into the target directory', (yargs) => {
        return yargs
            .positional('path_to_document', { describe: 'path to the document.db' })
            .positional('target_directory', { describe: 'path of the directory into which the notes should be dumped' })
    }, (argv) => {
        try {
            dumpService.dumpDocument(argv.path_to_document, argv.target_directory, {
                includeDeleted: argv.includeDeleted,
                password: argv.password
            });
        }
        catch (e) {
            console.error(`Unrecoverable error:`, e);
            process.exit(1);
        }
    })
    .option('password', {
        type: 'string',
        description: 'Set password to be able to decrypt protected notes.'
    })
    .option('include-deleted', {
        type: 'boolean',
        default: false,
        description: 'If set to true, dump also deleted notes.'
    })
    .parse();
