import attributeParser from '../src/public/app/services/attribute_parser.js';
import {describe, it, expect, execute} from './mini_test.js';

describe("Lexer", () => {
    it("simple label", () => {
        expect(attributeParser.lexer("#label")).toEqual(["#label"]);
    });

    it("label with value", () => {
        expect(attributeParser.lexer("#label=Hallo")).toEqual(["#label", "=", "Hallo"]);
    });

    it("relation with value", () => {
        expect(attributeParser.lexer('~relation=<a class="reference-link" href="#root/RclIpMauTOKS/NFi2gL4xtPxM" data-note-path="root/RclIpMauTOKS/NFi2gL4xtPxM">note</a>')).toEqual(["~relation", "=", "#root/RclIpMauTOKS/NFi2gL4xtPxM"]);
    });

    it("use quotes to define value", () => {
        expect(attributeParser.lexer("#'label a'='hello\"` world'"))
            .toEqual(["#label a", "=", 'hello"` world']);

        expect(attributeParser.lexer('#"label a" = "hello\'` world"'))
            .toEqual(["#label a", "=", "hello'` world"]);

        expect(attributeParser.lexer('#`label a` = `hello\'" world`'))
            .toEqual(["#label a", "=", "hello'\" world"]);
    });
});

describe("Parser", () => {
    it("simple label", () => {
        const attrs = attributeParser.parser(["#token"]);

        expect(attrs.length).toEqual(1);
        expect(attrs[0].type).toEqual('label');
        expect(attrs[0].name).toEqual('token');
        expect(attrs[0].value).toBeFalsy();
    });

    it("label with value", () => {
        const attrs = attributeParser.parser(["#token", "=", "val"]);

        expect(attrs.length).toEqual(1);
        expect(attrs[0].type).toEqual('label');
        expect(attrs[0].name).toEqual('token');
        expect(attrs[0].value).toEqual("val");
    });

    it("relation", () => {
        const attrs = attributeParser.parser(["~token", "=", "#root/RclIpMauTOKS/NFi2gL4xtPxM"]);

        expect(attrs.length).toEqual(1);
        expect(attrs[0].type).toEqual('relation');
        expect(attrs[0].name).toEqual("token");
        expect(attrs[0].value).toEqual('#root/RclIpMauTOKS/NFi2gL4xtPxM');
    });

    it("error cases", () => {
        expect(() => attributeParser.parser(["~token"])).toThrow('Relation "~token" should point to a note.');
    });
});

execute();
