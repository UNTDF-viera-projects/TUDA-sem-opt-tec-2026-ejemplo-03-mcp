import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const result = await build({
  entryPoints: [new URL("../weather/view.js", import.meta.url).pathname],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  write: false,
  minify: true,
});
const template = await readFile(
  new URL("../weather/view.html", import.meta.url),
  "utf8",
);
await mkdir(new URL("../dist-weather/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../dist-weather/view.html", import.meta.url),
  template.replace(
    "<!-- APP_SCRIPT -->",
    () =>
      `<script>${result.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`,
  ),
);
