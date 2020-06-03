import attributeParser from '../src/public/app/services/attribute_parser.js';
import {describe, it, expect, execute} from './mini_test.js';

describe("Lexer fulltext", () => {
    it("simple label", () => {
        expect(attributeParser.lexer("#label")).toEqual(["#label"]);
    });
});

execute();
