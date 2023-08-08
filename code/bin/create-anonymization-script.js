#!/usr/bin/env node

const anonymizationService = require('../../git/trilium_customized/src/services/anonymization');
const fs = require('fs');
const path = require('path');

fs.writeFileSync(path.resolve(__dirname, 'tpl', 'anonymize-database.sql'), anonymizationService.getFullAnonymizationScript());
