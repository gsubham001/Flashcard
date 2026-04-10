const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const projectRoot = __dirname;
const nodemonBin = path.join(projectRoot, "node_modules", ".bin", "nodemon.cmd");
const port = 5000;

function checkExistingServer() {
  return new Promise((resolve) => {
    const request = http.get(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/health",
        timeout: 1500
      },
      (response) => {
        let body = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve(response.statusCode === 200 && body.includes("SmartCards server is running"));
        });
      }
    );

    request.on("error", () => resolve(false));
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const alreadyRunning = await checkExistingServer();

  if (alreadyRunning) {
    console.log(`SmartCards backend is already running on http://localhost:${port}`);
    process.exit(0);
  }

  const devProcess = spawn("cmd.exe", ["/c", nodemonBin, "index.js"], {
    cwd: projectRoot,
    stdio: "inherit",
    shell: false
  });

  devProcess.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error("Failed to start backend dev server:", error);
  process.exit(1);
});
