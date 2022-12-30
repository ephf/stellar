import {
  readdirSync,
  readFileSync,
  writeFileSync,
  lstatSync,
  existsSync,
  mkdirSync,
  rmdirSync,
  unlinkSync,
  watch,
} from "fs";
import { createServer, STATUS_CODES } from "http";
import { createHash, randomUUID } from "crypto";
import { Element } from "./jsx/backend.js";
import EventEmitter from "events";
import parse from "./jsx/parse.js";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
class ServicePage {
  constructor(methods) {
    this.methods = methods;
  }
}

(function clearDir(dir) {
  if (!existsSync(dir)) return;
  readdirSync(dir).forEach((file) => {
    file = path.join(dir, file);
    if (lstatSync(file).isDirectory()) {
      clearDir(file);
      return;
    }

    unlinkSync(file);
  });
  rmdirSync(dir);
})("out");

mkdirSync("out");

async function compilePage(filepath, pagesdn) {
  const readfilepath = path.join(pagesdn, filepath);
  const type = path.extname(filepath);

  if (type == ".jsx") {
    const jsx = readFileSync(readfilepath, "utf-8");
    const parsedJS = parse(jsx);
    let url = "/" + filepath.replace(/\.\w+$/, "");
    const modulePath = path.join("out", url + randomUUID() + ".js");

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

    return [
      url.replace(/\\/g, "/"),
      {
        ping: content.default,
        exports: exports.join("\n"),
        head,
      },
    ];
  }

  if (type == ".js") {
    const url = "/" + filepath.replace(/\.\w+$/, "").replace(/\\/g, "/");
    const content = readFileSync(readfilepath, "utf-8");
    const modulePath = path.join("out", url + randomUUID() + ".js");
    writeFileSync(modulePath, content);
    return [
      url,
      {
        ping: async () =>
          new ServicePage(
            await import(path.join("file://" + __dirname, "..", modulePath))
          ),
      },
    ];
  }
}

async function loadPages(dn, pagesdn) {
  const pages = {};
  await Promise.all(
    readdirSync(path.join(pagesdn, dn)).map(async (file) => {
      const filepath = path.join(dn, file);
      const readfilepath = path.join(pagesdn, filepath);

      if (lstatSync(readfilepath).isDirectory()) {
        if (!existsSync(path.join("out", filepath)))
          mkdirSync(path.join("out", filepath));
        Object.assign(pages, await loadPages(filepath, pagesdn));
        return;
      }

      const [url, page] = (await compilePage(filepath, pagesdn)) ?? [];
      if (url) pages[url] = page;
    })
  );
  return pages;
}

const stellarjsx = readFileSync(
  path.join(__dirname, "jsx/frontend.js"),
  "utf-8"
);

const testing = process.argv[2] == "test";

export default async function listen({
  port = 80,
  pagesdn = "pages",
  callback = Function(),
  allowCache = false,
}) {
  const pages = await loadPages("", pagesdn);
  let rlwrites = [];
  createServer(async (req, res) => {
    if (!allowCache) res.setHeader("Cache-Control", "no-cache");
    const [url, rawsearch] = req.url.split("#")[0].split("?");

    if (url == "/stellarjsx") {
      res.writeHead(200, { "Content-Type": "text/javascript" });
      res.end(stellarjsx);
      return;
    }

    if (testing && url == "/stellarwatch") {
      const body = STATUS_CODES[426];
      res.writeHead(426, {
        "Content-Length": body.length,
        "Content-Type": "text/plain",
      });
      res.end(body);
      return;
    }

    const page = pages[url];
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
    let response = await page.ping(req, res);

    if (!response) {
      return;
    }

    if (response instanceof ServicePage) {
      if ("WebSocket" in response.methods) {
        const body = STATUS_CODES[426];
        res.writeHead(426, {
          "Content-Length": body.length,
          "Content-Type": "text/plain",
        });
        res.end(body);
        return;
      }
      const callback = response.methods[req.method.toLowerCase()];
      if (!callback) {
        res.writeHead(404);
        res.end(`Cannot ${req.method} on ${url}`);
        return;
      }

      response = await callback(req, res);
    }

    if (response instanceof Element || typeof response == "function") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<html>
        ${page.head}
        <body>
          <script type="module">
            import jsx from "/stellarjsx";
            ${
              testing
                ? "new WebSocket('ws://localhost/stellarwatch').onmessage = () => location.reload();"
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
  })
    .listen(port, callback)
    .on("upgrade", async (req, socket) => {
      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\n" +
          "Upgrade: websocket\r\n" +
          "Connection: Upgrade\r\n" +
          `Sec-WebSocket-Accept: ${createHash("sha1")
            .update(
              req.headers["sec-websocket-key"] +
                "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
            )
            .digest("base64")}\r\n\r\n`
      );
      if (req.url == "/stellarwatch") {
        rlwrites.push((text) => {
          socket.write(Buffer.from([0x81, text.length, ...Buffer.from(text)]));
        });
        return;
      }
      const customSocket = new EventEmitter();
      socket.on("data", (data) => {
        if (data[0] == 0x88) {
          customSocket.emit("close");
          return;
        }
        const xor = data.slice(2, 6);
        data = data.slice(6).map((byte, i) => byte ^ xor[i % 4]);
        customSocket.emit("data", data);
      });
      customSocket.write = (text) => {
        socket.write(Buffer.from([0x81, text.length, ...Buffer.from(text)]));
      };

      const [url, rawsearch] = req.url.split("#")[0].split("?");
      Object.defineProperty(customSocket, "query", {
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

      (await pages[url].ping()).methods.WebSocket(customSocket);
    });

  let change = false;
  (function watchDir(dir) {
    watch(path.join(pagesdn, dir), async (type, filename) => {
      if (change) return;
      change = true;
      setTimeout(() => (change = false), 100);

      if (type == "rename") return;
      if (lstatSync(path.join(pagesdn, dir, filename)).isDirectory()) return;

      const filepath = path.join(dir, filename);
      const [url, page] = await compilePage(filepath, pagesdn);
      console.log("Changed", filename, url ? "Updating " + url : "");
      if (url) pages[url] = page;

      rlwrites.forEach((write) => write("reload"));
      rlwrites = [];
    });
    readdirSync(path.join(pagesdn, dir)).forEach((file) => {
      if (lstatSync(path.join(pagesdn, dir, file)).isDirectory()) {
        watchDir(path.join(dir, file));
      }
    });
  })("");
}
