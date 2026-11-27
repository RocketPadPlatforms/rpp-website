import dotenv from "dotenv";

// Imported for its side effect, and imported first: paths.ts, logger.ts and
// express.ts all read process.env at module scope, and in CommonJS every import
// is resolved before the importing module's own body runs. Calling
// dotenv.config() from inside app.ts would therefore run too late.
//
// quiet: true suppresses the promotional banner dotenv 17 prints by default.
dotenv.config({ quiet: true });
