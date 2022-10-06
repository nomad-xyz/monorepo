import * as dotenv from "dotenv";
import fs from "fs";

/**
 * `ensureEnvFileIsLoaded` is a helper function that calls `dotenv`
 * Because node scripts can be called independently and in any order,
 * there is no single entry point that `dotenv` can be called from.
 * Add this to the top of any file that accesses `process.env` to ensure
 * environment variables in `.env` are set.
 */
export const ensureEnvFileIsLoaded = () => {
    // Using `env.example` as a fallback was from the original `dotenv` call
    // in `src/nomadenv.ts`. This can likely be removed.
    const envFile = fs.realpathSync(process.cwd() + "/.env");
    const envFileBackup = fs.realpathSync(process.cwd() + "/.env.example");
    if (fs.existsSync(envFile)) {
        dotenv.config({ path: envFile });
    }
    else {
        dotenv.config({ path: envFileBackup });
    }
}
