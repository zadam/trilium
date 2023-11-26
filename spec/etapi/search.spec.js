const crypto = require('crypto');
const {
    deleteEtapi,
    getEtapiResponse,
    describeEtapi, postEtapi,
    getEtapi,
    getEtapiContent,
    patchEtapi, putEtapi,
    putEtapiContent
} = require("../support/etapi");
const {createTextNote} = require("../support/etapi.js");

describeEtapi("search", () => {
    describe('search', () => {
        let europe, america;
        let austria, czechia;
        let usa, canada;

        beforeAll(async () => {
            europe = await createTextNote(null, 'Europe');
            austria = await createTextNote(europe.noteId, 'Austria');
            czechia = await createTextNote(europe.noteId, 'Czechia');

            america = await createTextNote(null, 'America');
            usa = await createTextNote(null, 'USA');
            canada = await createTextNote(null, 'Canada');
        });

        async function search(searchString, params) {
            const keyToValues = Object.keys(params).map(key => `${key}=${params[key]}`);

            const {results} = await getEtapi(`notes?search=${searchString}&${keyToValues.join('&')}`);

            return results;
        }

        it("search", async () => {
            const results = await search('Austria');

            expect(results.length).toEqual(0);
        });
    });
});
