import {describeEtapi, getEtapi, postEtapi,putEtapiContent} from "../support/etapi";

describeEtapi("backup", () => {
    it("create", async () => {
        const response = await putEtapiContent("backup/etapi_test");
        expect(response.status).toEqual(204);
    });
});
