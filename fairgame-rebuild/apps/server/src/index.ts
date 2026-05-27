import { createServer } from "node:http";

import { Server } from "socket.io";

import { createApp } from "./app";

const port = Number(process.env["PORT"] ?? 4000);
const app = createApp();
const httpServer = createServer(app);

new Server(httpServer, {
  cors: {
    origin: "http://127.0.0.1:5173"
  }
});

httpServer.listen(port, () => {
  console.log(`FairGame server listening on http://127.0.0.1:${port}`);
});
