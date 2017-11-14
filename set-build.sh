#!/usr/bin/env bash

echo 'module.exports = { buildDate:"'`date --iso-8601=seconds`'", buildRevision: "'`git log -1 --format="%H"`'" };' > services/build.js