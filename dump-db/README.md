# Trilium Notes DB dump tool

This is a simple tool to dump the content of Trilium's document.db onto filesystem.

It is meant as a last resort solution when the standard mean to access your data (through main Trilium application) fail.

## Installation

This tool requires node.js, testing has been done on 16.14.0, but it will probably work on other versions as well.

```
npm install
```

## Running

See output of `node dump-db.js --help`:

```
Trilium Notes DB dump tool. Usage:
node dump-db.js PATH_TO_DOCUMENT_DB TARGET_PATH
```
