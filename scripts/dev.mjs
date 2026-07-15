import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const node = process.execPath;
const options = {
  cwd: rootDir,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "development",
    DB_PATH: path.join(rootDir, "server", "regola.db"),
  },
};
const server = spawn(node, ["server/index.js"], options);
const vite = spawn(node, ["node_modules/vite/bin/vite.js", "--host", "0.0.0.0"], options);

function stop() {
  server.kill();
  vite.kill();
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

for (const child of [server, vite]) {
  child.on("exit", (code) => {
    if (code && code !== 0) process.exitCode = code;
    stop();
  });
}
