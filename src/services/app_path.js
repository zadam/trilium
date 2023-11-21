import assetPath from './asset_path.js'
import env from './env.js'

export default env.isDev()
    ? assetPath + "/app"
    : assetPath + "/app-dist";
