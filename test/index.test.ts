import { test } from "bun:test";
import { resolve, dirname, join } from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeRaw from "rehype-raw";
import { read } from "to-vfile";

import remarkAgda, { type RemarkAgdaOptions } from "../src";

test("simple case", async () => {
  const file = join(dirname(import.meta.path), "Simple.lagda.md");
  const vfile = await read(file);

  const options: RemarkAgdaOptions = {
    destDir: join(dirname(import.meta.path), "results"),
    transformHtml: (src) => {
      return `
          <!DOCTYPE html>
          <html>
          <head>
          <link rel="stylesheet" href="generated/agda/Agda.css" />
          </head>
          <body>
          <pre class="Agda">
          ${src}
          </pre>
          </body>
          </html>
        `;
    },
  };

  await unified()
    .use(remarkParse)
    .use(remarkAgda, options)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify)
    .process(vfile);
});
