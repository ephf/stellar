import {
  readdirSync,
  readFileSync,
  writeFileSync,
  lstatSync,
  existsSync,
  mkdirSync,
} from "fs";
import { createServer, STATUS_CODES, request } from "http";
import { Element } from "./jsx/backend.js";
import parse from "./jsx/parse.js";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

async function loadPages(dn, pagesdn) {
  const pages = [];
  await Promise.all(
    readdirSync(path.join(pagesdn, dn)).map(async (file) => {
      const filepath = path.join(dn, file);
      const readfilepath = path.join(pagesdn, filepath);

      if (lstatSync(readfilepath).isDirectory()) {
        if (!existsSync(path.join("out", filepath)))
          mkdirSync(path.join("out", filepath));
        pages.push(...(await loadPages(filepath, pagesdn)));
        return;
      }

      const type = path.extname(file);

      if (type == ".jsx") {
        const jsx = readFileSync(readfilepath, "utf-8");
        const parsedJS = parse(jsx);
        let url = "/" + filepath.replace(/\.\w+$/, "");
        const modulePath = path.join("out", url + ".js");

        writeFileSync(modulePath, parsedJS);
        const content = await import(
          "file://" + path.join(__dirname, "..", modulePath)
        );

        const exports = [];
        let styles = "";
        if (existsSync(path.join(pagesdn, url + ".css")))
          styles = readFileSync(path.join(pagesdn, url + ".css"), "utf-8");
        let head = `<head>\n<style>${styles}</style>\n</head>`;
        Object.entries(content).forEach(([name, exp]) => {
          if (name == "default") return;
          if (name == "head") {
            head = exp
              .toHTML()
              .replace(/<\/head>$/, `\n<style>${styles}</style>\n</head>`);
            return;
          }
          exports.push(exp.toString());
        });
        if (url == "/index") url = "/";

        pages.push({
          ping: content.default,
          exports: exports.join("\n"),
          head,
          url: url.replace(/\\/g, "/"),
        });
        return;
      }

      if (type == ".js") {
        pages.push({
          ping: await import(path.join(import.meta.url, readfilepath)),
          url: filepath.replace(/\.\w+$/, ""),
        });
      }
    })
  );
  return pages;
}

const stellarjsx = readFileSync(
  path.join(__dirname, "jsx/frontend.js"),
  "utf-8"
);

export default async function listen({
  port = 80,
  pagesdn = "pages",
  callback = Function(),
  allowCache = false,
  live = false,
}) {
  const pages = await loadPages("", pagesdn);
  createServer(async (req, res) => {
    if (!allowCache) res.setHeader("Cache-Control", "no-cache");
    const [url, rawsearch] = req.url.split("#")[0].split("?");

    if (url == "/stellarjsx") {
      res.writeHead(200, { "Content-Type": "text/javascript" });
      res.end(stellarjsx);
      return;
    }

    if (live && url == "/stellarwatch") {
      const body = STATUS_CODES[426];
      res.writeHead(426, {
        "Content-Length": body.length,
        "Content-Type": "text/plain",
      });
      res.end(body);
      return;
    }

    const page = pages.find((page) => page.url == url);
    if (!page) {
      res.writeHead(404);
      res.end("Cannot find page: " + url);
      return;
    }

    Object.defineProperty(req, "query", {
      get() {
        return Object.fromEntries(
          [...new URLSearchParams(rawsearch)].map(([key, value]) => [
            key,
            value || true,
          ])
        );
      },
      set() {
        throw "Cannot set req.query";
      },
    });
    res.state = {};
    const response = await page.ping(req, res);

    if (!response) {
      return;
    }

    if (response instanceof Element || typeof response == "function") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<html>
        ${page.head}
        <body>
          <script type="module">
            import jsx from "/stellarjsx";
            ${
              live
                ? "new WebSocket('ws://localhost:3222').onmessage = () => location.reload();"
                : ""
            }
            ${page.exports}
            document.body.append(${
              typeof response == "function"
                ? `(${response.toString()})(${JSON.stringify(res.state)})`
                : response.toString()
            });
          </script>
        </body>
      </html>`);
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(response));
  }).listen(port, (...a) => {
    callback(...a);
    const req = request(
      {
        host: "localhost",
        path: "/write",
        port: 3222,
        method: "GET",
      },
      Function()
    );
    req.on("error", (error) => {
      console.log("error:", error);
    });
    req.end();
  });
}
