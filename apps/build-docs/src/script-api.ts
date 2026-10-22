import { execSync } from "child_process";
import { join } from "path";

import BuildContext from "./context";

export default function buildScriptApi({ baseDir, gitRootDir }: BuildContext) {
    // Generate types
    execSync(`pnpm typecheck`, { stdio: "inherit", cwd: gitRootDir });

    const outDir = join(baseDir, "script-api", "frontend");
    execSync(`pnpm typedoc --options typedoc.frontend.json --html "${outDir}"`, {
        stdio: "inherit"
    });
}
