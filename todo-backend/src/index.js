const http = require("node:http");

const PORT = Number(process.env.PORT ?? 3000);

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("todo-backend is running\n");
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`listening on http://localhost:${PORT}`);
});

