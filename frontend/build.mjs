import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build, context } from "esbuild";

const projectDirectory = fileURLToPath(new URL(".", import.meta.url));
process.chdir(projectDirectory);

const desktop = process.argv.includes("--desktop");
const output = desktop ? "dist-desktop" : "dist";
const apiOrigin = desktop ? "/api" : (process.env.ODONTO_API_ORIGIN || "").replace(/\/$/, "");
await mkdir(output, { recursive: true });
await Promise.all(["index.html", "assets", "css"].map((item) =>
  cp(item, output + "/" + item, { recursive: true }),
));
await cp("../OdontoSoft.ico", output + "/favicon.ico");

const options = {
  entryPoints: ["src/app/main.jsx"],
  outdir: output + "/react",
  entryNames: "app",
  bundle: true,
  splitting: true,
  format: "esm",
  jsx: "automatic",
  minify: true,
  define: {
    "process.env.NODE_ENV": '"production"',
    ODONTO_API_ORIGIN: JSON.stringify(apiOrigin),
  },
};

if (process.argv.includes("--serve")) {
  const app = await context(options);
  await app.rebuild();
  await app.watch();
  const port = Number(process.env.ODONTOSOFT_WEB_PORT || 5173);
  const server = await app.serve({ host: "127.0.0.1", port, servedir: output, fallback: output + "/index.html" });
  console.log("OdontoSoft: http://127.0.0.1:" + server.port + "/");
} else {
  await build(options);
  console.log("Compiled the OdontoSoft React app in " + output + ".");
}
