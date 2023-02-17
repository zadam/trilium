#!/usr/bin/env bash

rm -rf ./tmp/api_docs/backend_api
rm -rf ./tmp/api_docs/frontend_api

./node_modules/.bin/jsdoc -c jsdoc-conf.json -d ./tmp/api_docs/backend_api src/becca/entities/*.js \
  src/services/backend_script_api.js src/services/sql.js

./node_modules/.bin/jsdoc -c jsdoc-conf.json -d ./tmp/api_docs/frontend_api src/public/app/entities/*.js \
  src/public/app/services/frontend_script_api.js src/public/app/widgets/right_panel_widget.js

rm -rf ./docs/api_docs/backend_api ./docs/api_docs/frontend_api

node src/transform_api_docs.js

rm -rf ./docs/api_docs/fonts ./docs/api_docs/styles ./docs/api_docs/scripts ./docs/api_docs/backend_api/index.html ./docs/api_docs/frontend_api/index.html
