import { join, parse } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import {
  readdir,
  mkdtemp,
  exists,
  copyFile,
  readFile,
  writeFile,
} from "node:fs/promises";
import { mkdirSync } from "node:fs";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import { fromMarkdown } from "mdast-util-from-markdown";
import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import type { RootContent } from "hast";
import type { Node as UnistNode } from "unist";

export interface RemarkAgdaOptions {
  /** Place to output the HTML files */
  destDir: string;

  /** Function to transform HTML files */
  transformHtml?: (_: string) => string;

  /** Path to Agda */
  agdaBin?: string;

  /** Extra agda options */
  extraAgdaFlags?: string[];
}

export const remarkAgda: Plugin<[RemarkAgdaOptions]> = ({
  agdaBin,
  extraAgdaFlags,
  destDir,
  transformHtml,
}) => {
  // const destDir = join(publicDir, "generated", "agda");
  mkdirSync(destDir, { recursive: true });

  return async (tree, { history }) => {
    if (history.length === 0) {
      throw new Error(
        "No history attribute found. Did you parse the VFile from a file?",
      );
    }

    const path = history[history.length - 1];
    // if (!(path.endsWith(".lagda.md") || path.endsWith(".agda"))) return;
    // console.log("AGDA:processing path", path);
    const agdaOutDir = await mkdtemp(join(tmpdir(), "agdaRender."));
    // const agdaOutDir = join(tempDir, "output");
    const agdaOutFilename = parse(path).base.replace(/\.lagda.md$/, ".md");
    const agdaOutFile = join(agdaOutDir, agdaOutFilename);
    // mkdirSync(agdaOutDir, { recursive: true });
    const childOutput = spawnSync(
      agdaBin ?? "agda",
      [
        "--html",
        `--html-dir=${agdaOutDir}`,
        "--highlight-occurrences",
        "--html-highlight=code",
        ...(extraAgdaFlags ?? []),
        path,
      ],
      {},
    );

    if (childOutput.error || !(await exists(agdaOutFile))) {
      throw new Error(
        `Agda error:

        Stdout:
        ${childOutput.stdout}

        Stderr:
        ${childOutput.stderr}`,
        {
          cause: childOutput.error,
        },
      );
    }

    // // TODO: Handle child output
    // console.error("--AGDA OUTPUT--");
    // console.error(childOutput);
    // console.error(childOutput.stdout?.toString());
    // console.error(childOutput.stderr?.toString());
    // console.error("--AGDA OUTPUT--");
    const referencedFiles = new Set();

    const writtenFiles = await readdir(agdaOutDir);
    const promises = writtenFiles.map(async (file) => {
      referencedFiles.add(file);

      const fullPath = join(agdaOutDir, file);
      const fullDestPath = join(destDir, file);

      if (file.endsWith(".html")) {
        // Transform the HTML optionally
        const src = await readFile(fullPath, { encoding: "utf-8" });
        const transformedHtml = (transformHtml ?? ((html) => html))(src);
        await writeFile(fullDestPath, transformedHtml);
      } else {
        // Copy the CSS file over
        await copyFile(fullPath, fullDestPath);
      }
    });
    await Promise.all(promises);

    const htmlname = parse(path).base.replace(/\.lagda.md/, ".html");

    const doc = await readFile(agdaOutFile, { encoding: "utf-8" });

    // This is the post-processed markdown with HTML code blocks replacing the Agda code blocks
    const tree2 = fromMarkdown(doc);

    const collectedCodeBlocks: string[] = [];

    visit(tree2, "html", (node) => {
      const html = fromHtml(node.value, { fragment: true });

      visit(html, "element", (node) => {
        if (node.tagName !== "a") return;

        if (typeof node.properties.href === "string") {
          // Trim off end
          const [href, hash, ...rest] = node.properties.href.split("#");
          if (rest.length > 0) throw new Error("come look at this");

          if (href === htmlname) node.properties.href = `#${hash}`;

          // TODO: Transform
          // if (referencedFiles.has(href)) {
          //   node.properties.href = `${base}generated/agda/${href}${hash ? `#${hash}` : ""}`;
          //   node.properties.target = "_blank";
          // }
        }
      });

      while (true) {
        if (html.children.length > 0) {
          const firstChild: RootContent = html.children[0];

          if (firstChild.type !== "element") break;

          const className = firstChild.properties.className;

          // @ts-ignore TODO: Fix this
          if (!className?.includes("Agda")) break;

          const stringContents = toHtml(firstChild);
          collectedCodeBlocks.push(stringContents);
        }
        break;
      }
    });

    console.log(`Collected ${collectedCodeBlocks.length} blocks!`);

    let idx = 0;

    visit(tree, "code", (node: UnistNode) => {
      // Make sure it's either null (which gets interpreted as agda), or agda
      // @ts-ignore
      if (!(node.lang === null || node.lang === "agda")) return;

      // node.type = "html";

      node.type = "html";

      // @ts-ignore
      node.value = collectedCodeBlocks[idx];

      console.log(node);

      idx += 1;
    });
  };
};

export default remarkAgda;
