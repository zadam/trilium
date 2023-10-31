const {
    describeEtapi, postEtapi,
    putEtapiContent
} = require("../support/etapi");
const {getEtapi} = require("../support/etapi.js");

describeEtapi("app_info", () => {
    it("get", async () => {
        const appInfo = await getEtapi("app-info");
        expect(appInfo.clipperProtocolVersion).toEqual("1.0");
    });
});
