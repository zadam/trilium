import appContext from "./components/app_context.js";
import MobileLayout from "./layouts/mobile_layout.js";
import glob from "./services/glob.js";

glob.setupGlobs();

appContext.setLayout(new MobileLayout());
appContext.start();
