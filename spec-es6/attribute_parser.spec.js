import attributeParser from '../src/public/app/services/attribute_parser.js';
import {describe, it, expect, execute} from './mini_test.js';

describe("Lexing", () => {
    it("simple label", () => {
        expect(attributeParser.lex("#label").map(t => t.text))
            .toEqual(["#label"]);
    });

    it("simple label with trailing spaces", () => {
        expect(attributeParser.lex("   #label  ").map(t => t.text))
            .toEqual(["#label"]);
    });

    it("inherited label", () => {
        expect(attributeParser.lex("#label(inheritable)").map(t => t.text))
            .toEqual(["#label", "(", "inheritable", ")"]);

        expect(attributeParser.lex("#label ( inheritable ) ").map(t => t.text))
            .toEqual(["#label", "(", "inheritable", ")"]);
    });

    it("label with value", () => {
        expect(attributeParser.lex("#label=Hallo").map(t => t.text))
            .toEqual(["#label", "=", "Hallo"]);
    });

    it("label with value", () => {
        const tokens = attributeParser.lex("#label=Hallo");
        expect(tokens[0].startIndex).toEqual(0);
        expect(tokens[0].endIndex).toEqual(5);
    });

    it("relation with value", () => {
        expect(attributeParser.lex('~relation=#root/RclIpMauTOKS/NFi2gL4xtPxM').map(t => t.text))
            .toEqual(["~relation", "=", "#root/RclIpMauTOKS/NFi2gL4xtPxM"]);
    });

    it("use quotes to define value", () => {
        expect(attributeParser.lex("#'label a'='hello\"` world'").map(t => t.text))
            .toEqual(["#label a", "=", 'hello"` world']);

        expect(attributeParser.lex('#"label a" = "hello\'` world"').map(t => t.text))
            .toEqual(["#label a", "=", "hello'` world"]);

        expect(attributeParser.lex('#`label a` = `hello\'" world`').map(t => t.text))
            .toEqual(["#label a", "=", "hello'\" world"]);
    });
});

describe("Parser", () => {
    it("simple label", () => {
        const attrs = attributeParser.parse(["#token"].map(t => ({text: t})));

        expect(attrs.length).toEqual(1);
        expect(attrs[0].type).toEqual('label');
        expect(attrs[0].name).toEqual('token');
        expect(attrs[0].isInheritable).toBeFalsy();
        expect(attrs[0].value).toBeFalsy();
    });

    it("inherited label", () => {
        const attrs = attributeParser.parse(["#token", "(", "inheritable", ")"].map(t => ({text: t})));

        expect(attrs.length).toEqual(1);
        expect(attrs[0].type).toEqual('label');
        expect(attrs[0].name).toEqual('token');
        expect(attrs[0].isInheritable).toBeTruthy();
        expect(attrs[0].value).toBeFalsy();
    });

    it("label with value", () => {
        const attrs = attributeParser.parse(["#token", "=", "val"].map(t => ({text: t})));

        expect(attrs.length).toEqual(1);
        expect(attrs[0].type).toEqual('label');
        expect(attrs[0].name).toEqual('token');
        expect(attrs[0].value).toEqual("val");
    });

    it("relation", () => {
        let attrs = attributeParser.parse(["~token", "=", "#root/RclIpMauTOKS/NFi2gL4xtPxM"].map(t => ({text: t})));

        expect(attrs.length).toEqual(1);
        expect(attrs[0].type).toEqual('relation');
        expect(attrs[0].name).toEqual("token");
        expect(attrs[0].value).toEqual('NFi2gL4xtPxM');

        attrs = attributeParser.parse(["~token", "=", "#NFi2gL4xtPxM"].map(t => ({text: t})));

        expect(attrs.length).toEqual(1);
        expect(attrs[0].type).toEqual('relation');
        expect(attrs[0].name).toEqual("token");
        expect(attrs[0].value).toEqual('NFi2gL4xtPxM');
    });
});

describe("error cases", () => {
    it("error cases", () => {
        expect(() => attributeParser.lexAndParse('~token'))
            .toThrow('Relation "~token" in "~token" should point to a note.');

        expect(() => attributeParser.lexAndParse("#a&b/s"))
            .toThrow(`Attribute name "a&b/s" contains disallowed characters, only alphanumeric characters, colon and underscore are allowed.`);

        expect(() => attributeParser.lexAndParse("#"))
            .toThrow(`Attribute name is empty, please fill the name.`);
    });
});

execute();
