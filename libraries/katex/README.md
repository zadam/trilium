# [<img src="https://katex.org/img/katex-logo-black.svg" width="130" alt="KaTeX">](https://katex.org/)
[![npm](https://img.shields.io/npm/v/katex.svg)](https://www.npmjs.com/package/katex)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![CI](https://github.com/KaTeX/KaTeX/workflows/CI/badge.svg?branch=master&event=push)](https://github.com/KaTeX/KaTeX/actions?query=workflow%3ACI)
[![codecov](https://codecov.io/gh/KaTeX/KaTeX/branch/master/graph/badge.svg)](https://codecov.io/gh/KaTeX/KaTeX)
[![Discussions](https://img.shields.io/badge/Discussions-join-brightgreen)](https://github.com/KaTeX/KaTeX/discussions)
[![jsDelivr](https://data.jsdelivr.com/v1/package/npm/katex/badge?style=rounded)](https://www.jsdelivr.com/package/npm/katex)
![katex.min.js size](https://img.badgesize.io/https://unpkg.com/katex/dist/katex.min.js?compression=gzip)
[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/KaTeX/KaTeX)

KaTeX is a fast, easy-to-use JavaScript library for TeX math rendering on the web.

 * **Fast:** KaTeX renders its math synchronously and doesn't need to reflow the page. See how it compares to a competitor in [this speed test](http://www.intmath.com/cg5/katex-mathjax-comparison.php).
 * **Print quality:** KaTeX's layout is based on Donald Knuth's TeX, the gold standard for math typesetting.
 * **Self contained:** KaTeX has no dependencies and can easily be bundled with your website resources.
 * **Server side rendering:** KaTeX produces the same output regardless of browser or environment, so you can pre-render expressions using Node.js and send them as plain HTML.

KaTeX is compatible with all major browsers, including Chrome, Safari, Firefox, Opera, Edge, and IE 11.

KaTeX supports much (but not all) of LaTeX and many LaTeX packages. See the [list of supported functions](https://katex.org/docs/supported.html).

Try out KaTeX [on the demo page](https://katex.org/#demo)!

## Getting started

### Starter template

```html
<!DOCTYPE html>
<!-- KaTeX requires the use of the HTML5 doctype. Without it, KaTeX may not render properly -->
<html>
  <head>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.13.9/dist/katex.min.css" integrity="sha384-r/BYDnh2ViiCwqZt5VJVWuADDic3NnnTIEOv4hOh05nSfB6tjWpKmn1kUHOVkMXc" crossorigin="anonymous">

    <!-- The loading of KaTeX is deferred to speed up page rendering -->
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.13.9/dist/katex.min.js" integrity="sha384-zDIgORxjImEWftZXZpWLs2l57fMX9B3yWFPN5Ecabe211Hm5ZG/OIz2b07DYPUcH" crossorigin="anonymous"></script>

    <!-- To automatically render math in text elements, include the auto-render extension: -->
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.13.9/dist/contrib/auto-render.min.js" integrity="sha384-vZTG03m+2yp6N6BNi5iM4rW4oIwk5DfcNdFfxkk9ZWpDriOkXX8voJBFrAO7MpVl" crossorigin="anonymous"
        onload="renderMathInElement(document.body);"></script>
  </head>
  ...
</html>
```

You can also [download KaTeX](https://github.com/KaTeX/KaTeX/releases) and host it yourself.

For details on how to configure auto-render extension, refer to [the documentation](https://katex.org/docs/autorender.html).

### API

Call `katex.render` to render a TeX expression directly into a DOM element.
For example:

```js
katex.render("c = \\pm\\sqrt{a^2 + b^2}", element, {
    throwOnError: false
});
```

Call `katex.renderToString` to generate an HTML string of the rendered math,
e.g., for server-side rendering.  For example:

```js
var html = katex.renderToString("c = \\pm\\sqrt{a^2 + b^2}", {
    throwOnError: false
});
// '<span class="katex">...</span>'
```

Make sure to include the CSS and font files in both cases.
If you are doing all rendering on the server, there is no need to include the
JavaScript on the client.

The examples above use the `throwOnError: false` option, which renders invalid
inputs as the TeX source code in red (by default), with the error message as
hover text.  For other available options, see the
[API documentation](https://katex.org/docs/api.html),
[options documentation](https://katex.org/docs/options.html), and
[handling errors documentation](https://katex.org/docs/error.html).

## Demo and Documentation

Learn more about using KaTeX [on the website](https://katex.org)!

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

KaTeX is licensed under the [MIT License](http://opensource.org/licenses/MIT).
