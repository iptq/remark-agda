import { join, parse } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync, spawn } from "node:child_process";
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

const remarkAgda: Plugin<[RemarkAgdaOptions]> = ({
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
    // console.log("path", path);
    // if (!(path.endsWith(".lagda.md") || path.endsWith(".agda"))) return;

    // console.log("AGDA:processing path", path);

    const agdaOutDir = await mkdtemp(join(tmpdir(), "agdaRender."));
    // const agdaOutDir = join(tempDir, "output");
    const agdaOutFilename = parse(path).base.replace(/\.lagda.md$/, ".md");
    const agdaOutFile = join(agdaOutDir, agdaOutFilename);
    console.log("looking for file", agdaOutFile);
    // mkdirSync(agdaOutDir, { recursive: true });

    const childOutput = await spawnSync(
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

    const doc = await readFile(agdaOutFile);

    // This is the post-processed markdown with HTML code blocks replacing the Agda code blocks
    const tree2 = fromMarkdown(doc);

    const collectedCodeBlocks: RootContent[] = [];
    visit(tree2, "html", (node) => {
      const html = fromHtml(node.value, { fragment: true });

      const firstChild: RootContent = html.children[0]!;

      visit(html, "element", (node) => {
        if (node.tagName !== "a") return;

        if (node.properties.href) {
          // Trim off end
          const [href, hash, ...rest] = node.properties.href.split("#");
          if (rest.length > 0) throw new Error("come look at this");

          if (href === htmlname) node.properties.href = `#${hash}`;

          if (referencedFiles.has(href)) {
            node.properties.href = `${base}generated/agda/${href}${hash ? `#${hash}` : ""}`;
            node.properties.target = "_blank";
          }
        }
      });

      if (!firstChild?.properties?.className?.includes("Agda")) return;

      const stringContents = toHtml(firstChild);
      collectedCodeBlocks.push({
        contents: stringContents,
      });
    });

    let idx = 0;
    visit(tree, "code", (node) => {
      if (!(node.lang === null || node.lang === "agda")) return;

      node.type = "html";
      node.value = collectedCodeBlocks[idx].contents;
      idx += 1;
    });
  };
};

export default remarkAgda;
