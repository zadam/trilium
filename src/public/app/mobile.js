import appContext from "./services/app_context.js";
import MobileLayout from "./widgets/mobile_layout.js";
import glob from "./services/glob.js";

glob.setupGlobs();

appContext.setLayout(new MobileLayout());
appContext.start();