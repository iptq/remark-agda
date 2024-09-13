# remark-agda

This is a plugin that processes Literate Agda files that are written in Markdown,
and replaces it with the HTML directly. This is useful for blogs where you want
to do additional processing with remark, such as Katex or others.

- [remark](https://github.com/remarkjs/remark)
- [literate Agda](https://agda.readthedocs.io/en/latest/tools/literate-programming.html#literate-markdown-and-typst)

This plugin has been extracted from the source code of [my blog](https://mzhang.io).

## Installation

```
npm i remark-agda
pnpm add remark-agda
bun add remark-agda
```

## Usage

```js
const vfile = await read("/path/to/file.lagda.md");
await unified()
    .use(remarkParse)
    .use(remarkAgda, options)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify)
    .process(vfile);
```

Note:

- Since this returns raw HTML, we need the `allowDangerousHtml: true` flag to `remarkRehype`
  _as well as_ the `rehypeRaw` plugin to convert back.

## Contact

Author: Michael Zhang

License: GPL-3.0

Send questions to ~mzhang/public-inbox@lists.sr.ht