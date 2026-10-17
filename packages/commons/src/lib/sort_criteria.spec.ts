import { describe, expect, it } from "vitest";

import { parseSortCriteria, serializeSortCriteria } from "./sort_criteria.js";

describe("sort criteria", () => {
    it("parses a #sorted value into its levels", () => {
        expect(parseSortCriteria("")).toEqual([{ key: "title" }]);
        expect(parseSortCriteria(null)).toEqual([{ key: "title" }]);
        expect(parseSortCriteria("myOrder")).toEqual([{ key: "myOrder", descending: undefined }]);
        expect(parseSortCriteria(" priority   DESC , , area asc, title ")).toEqual([
            { key: "priority", descending: true },
            { key: "area", descending: false },
            { key: "title", descending: undefined }
        ]);
        // A colon is an ordinary character of a label name.
        expect(parseSortCriteria("calendar:view desc,calendar:view")).toEqual([
            { key: "calendar:view", descending: true },
            { key: "calendar:view", descending: undefined }
        ]);
        // A direction word on its own is a key, not a direction.
        expect(parseSortCriteria("desc")).toEqual([{ key: "desc", descending: undefined }]);
    });

    it("parses a grouping level written as a key followed by `first` or `last`", () => {
        expect(parseSortCriteria("archived last, pinned FIRST, title")).toStrictEqual([
            { key: "archived", group: "last" },
            { key: "pinned", group: "first" },
            { key: "title", descending: undefined }
        ]);
        // A grouping word on its own is a key, not a grouping.
        expect(parseSortCriteria("last")).toStrictEqual([{ key: "last", descending: undefined }]);
    });

    it("writes levels back so that they parse to the same thing", () => {
        const criteria = [
            { key: "archived", group: "last" as const },
            { key: "priority", descending: true },
            { key: "dateCreated", descending: false },
            { key: "title", descending: undefined }
        ];
        const written = serializeSortCriteria(criteria);
        expect(written).toBe("archived last, priority desc, dateCreated asc, title");
        expect(parseSortCriteria(written)).toEqual(criteria);
    });
});
