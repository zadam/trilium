const {
    describeEtapi, postEtapi,
    getEtapi,
} = require("../support/etapi");
const {putEtapiContent} = require("../support/etapi.js");

describeEtapi("backup", () => {
    it("create", async () => {
        const response = await putEtapiContent("backup/etapi_test");
        expect(response.status).toEqual(204);
    });
});
