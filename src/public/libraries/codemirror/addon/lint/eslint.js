// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
  "use strict";

  async function validator(text, options) {
    await requireLibrary(ESLINT);

    var errors = new eslint().verify(text, {
        root: true,
        parserOptions: {
            ecmaVersion: 2017,
            sourceType: 'module'
        },
        extends: ['eslint:recommended', 'airbnb-base'],
        env: {
            'node': true
        },
        rules: {
            'import/no-unresolved': 'off',
            'import/no-extraneous-dependencies': 'off',
            'func-names': 'off',
            'no-multi-spaces': 'off',
            'spaced-comment': ["error", "always", { "markers": ["/"] }],
            'comma-dangle': ['error'],
            'padded-blocks': 'off',
            'linebreak-style': 'off',
            'class-methods-use-this': 'off',
            'no-unused-vars': ['error', { vars: 'local', args: 'after-used' }],
            'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
            'no-nested-ternary': 'off',
            'no-underscore-dangle': ['error', {'allow': ['_super', '_lookupFactory']}],
            'object-shorthand': ['error', 'methods'],
        }
    });

    var result = [];
    if (errors) parseErrors(errors, result);
    return result;
  }

  CodeMirror.registerHelper("lint", "javascript", validator);

  function parseErrors(errors, output) {
    for (const error of errors) {
      var startLine = error.line - 1;
      var endLine = error.endLine !== undefined ? error.endLine - 1 : startLine;
      var startCol = error.column - 1;
      var endCol = error.endColumn !== undefined ? error.endColumn - 1 : startCol + 1;

      output.push({
          message: error.message,
          severity: error.severity === 1 ? "warning" : "error",
          from: CodeMirror.Pos(startLine, startCol),
          to: CodeMirror.Pos(endLine, endCol)
      });
    }

    console.log(output);
  }
});
