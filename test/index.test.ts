import { test } from "bun:test";
import { resolve, dirname, join } from "node:path";
import { unified } from "unified";
import remarkAgda from "../src";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { VFile } from "vfile";

test("simple case", async () => {
  const file = join(dirname(import.meta.path), "Simple.lagda.md");
  const vfile = new VFile({ path: file });

  const result = await unified()
    .use(remarkParse)
    .use(remarkAgda, {
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
    })
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(vfile);
  console.log("result", result);
});
