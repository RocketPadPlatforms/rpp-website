// Must stay first: loads .env before any module reads process.env.
import "./config/env";

import initExpress from "./config/express";

// Start Server
initExpress();
