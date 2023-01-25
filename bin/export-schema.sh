#!/usr/bin/env bash

SCHEMA_FILE_PATH=db/schema.sql

sqlite3 ./data/document.db .schema | grep -v "sqlite_sequence" > "$SCHEMA_FILE_PATH"

echo "DB schema exported to $SCHEMA_FILE_PATH"