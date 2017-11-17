#!/usr/bin/env bash

echo 'module.exports = { build_date:"'`date --iso-8601=seconds`'", build_revision: "'`git log -1 --format="%H"`'" };' > services/build.js