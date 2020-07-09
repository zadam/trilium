import attributeParser from '../src/public/app/services/attribute_parser.js';
import {describe, it, expect, execute} from './mini_test.js';

describe("Preprocessor", () => {
    it("relation with value", () => {
        expect(attributeParser.preprocess('<p>~relation&nbsp;= <a class="reference-link" href="#root/RclIpMauTOKS/NFi2gL4xtPxM" some-attr="abc" data-note-path="root/RclIpMauTOKS/NFi2gL4xtPxM">note</a>&nbsp;</p>'))
            .toEqual("~relation = #root/RclIpMauTOKS/NFi2gL4xtPxM ");
    });
});

describe("Lexer", () => {
    it("simple label", () => {
        expect(attributeParser.lexer("#label").map(t => t.text))
            .toEqual(["#label"]);
    });

    it("label with value", () => {
        expect(attributeParser.lexer("#label=Hallo").map(t => t.text))
            .toEqual(["#label", "=", "Hallo"]);
    });

    it("label with value", () => {
        const tokens = attributeParser.lexer("#label=Hallo");
        expect(tokens[0].startIndex).toEqual(0);
        expect(tokens[0].endIndex).toEqual(5);
    });

    it("relation with value", () => {
        expect(attributeParser.lexer('~relation=#root/RclIpMauTOKS/NFi2gL4xtPxM').map(t => t.text))
            .toEqual(["~relation", "=", "#root/RclIpMauTOKS/NFi2gL4xtPxM"]);
    });

    it("use quotes to define value", () => {
        expect(attributeParser.lexer("#'label a'='hello\"` world'").map(t => t.text))
            .toEqual(["#label a", "=", 'hello"` world']);

        expect(attributeParser.lexer('#"label a" = "hello\'` world"').map(t => t.text))
            .toEqual(["#label a", "=", "hello'` world"]);

        expect(attributeParser.lexer('#`label a` = `hello\'" world`').map(t => t.text))
            .toEqual(["#label a", "=", "hello'\" world"]);
    });
});

describe("Parser", () => {
    it("simple label", () => {
        const attrs = attributeParser.parser(["#token"].map(t => ({text: t})));

        expect(attrs.length).toEqual(1);
        expect(attrs[0].type).toEqual('label');
        expect(attrs[0].name).toEqual('token');
        expect(attrs[0].value).toBeFalsy();
    });

    it("label with value", () => {
        const attrs = attributeParser.parser(["#token", "=", "val"].map(t => ({text: t})));

        expect(attrs.length).toEqual(1);
        expect(attrs[0].type).toEqual('label');
        expect(attrs[0].name).toEqual('token');
        expect(attrs[0].value).toEqual("val");
    });

    it("relation", () => {
        let attrs = attributeParser.parser(["~token", "=", "#root/RclIpMauTOKS/NFi2gL4xtPxM"].map(t => ({text: t})));

        expect(attrs.length).toEqual(1);
        expect(attrs[0].type).toEqual('relation');
        expect(attrs[0].name).toEqual("token");
        expect(attrs[0].value).toEqual('NFi2gL4xtPxM');

        attrs = attributeParser.parser(["~token", "=", "#NFi2gL4xtPxM"].map(t => ({text: t})));

        expect(attrs.length).toEqual(1);
        expect(attrs[0].type).toEqual('relation');
        expect(attrs[0].name).toEqual("token");
        expect(attrs[0].value).toEqual('NFi2gL4xtPxM');
    });

    it("error cases", () => {
        expect(() => attributeParser.parser(["~token"].map(t => ({text: t})), "~token"))
            .toThrow('Relation "~token" should point to a note.');
    });
});

execute();
