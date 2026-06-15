import { loadConfig } from "./config.js";
import { createApiServer } from "./server.js";

const config = loadConfig();
const server = createApiServer({ config });

server.listen(config.port, config.host, () => {
  console.log(`Agentic Galgame API listening on http://${config.host}:${config.port}`);
  console.log(`Data directory: ${config.dataDir}`);
  console.log(`Database: ${config.databaseUrl ? "postgres" : "file"}`);
  console.log(`Asset storage: ${config.assetStorageProvider}`);
  console.log(`AI provider enabled: ${config.aiEnabled ? "yes" : "no"}`);
  console.log(`API auth: ${config.apiAuthToken ? "enabled" : "disabled"}`);
});
