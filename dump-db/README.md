# Trilium Notes DB dump tool

This is a simple tool to dump the content of Trilium's document.db onto filesystem.

It is meant as a last resort solution when the standard mean to access your data (through main Trilium application) fail.

## Installation

This tool requires node.js, testing has been done on 16.14.2, but it will probably work on other versions as well.

```
npm install
```

## Running

See output of `node dump-db.js --help`:

```
dump-db.js <path_to_document> <target_directory>

dump the contents of document.db into the target directory

Positionals:
path_to_document  path to the document.db
target_directory  path of the directory into which the notes should be dumped

Options:
--help             Show help                                         [boolean]
--version          Show version number                               [boolean]
--password         Set password to be able to decrypt protected notes.[string]
--include-deleted  If set to true, dump also deleted notes.
[boolean] [default: false]
```
