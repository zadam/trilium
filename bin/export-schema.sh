#!/usr/bin/env bash

SCHEMA_FILE_PATH=db/schema.sql

sqlite3 ~/trilium-data/document.db .schema | grep -v "sqlite_sequence" | grep -v "note_fulltext_" > "$SCHEMA_FILE_PATH"

echo "DB schema exported to $SCHEMA_FILE_PATH"