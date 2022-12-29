import { createServer, STATUS_CODES } from "http";
import { createHash } from "crypto";

let write;

createServer((req, res) => {
  if (req.url == "/write") {
    res.end();
    write?.();
    return;
  }
  const body = STATUS_CODES[426];
  res.writeHead(426, {
    "Content-Length": body.length,
    "Content-Type": "text/plain",
  });
  res.end(body);
})
  .listen(3222)
  .on("upgrade", (req, socket) => {
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
    socket.on("error", Function());
    const text = "reload";
    write = () => {
      console.log("reloading");
      socket.write(Buffer.from([0x81, text.length, ...Buffer.from(text)]));
    };
  });
