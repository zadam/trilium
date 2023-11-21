import {describeEtapi, postEtapi, putEtapiContent,getEtapi} from "../support/etapi";



describeEtapi("app_info", () => {
    it("get", async () => {
        const appInfo = await getEtapi("app-info");
        expect(appInfo.clipperProtocolVersion).toEqual("1.0");
    });
});
