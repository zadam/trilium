/**
 * The grammar of the `#sorted` label: comma-separated sort keys, each optionally followed by `asc`
 * or `desc`, the way a search's `orderBy` is written — `priority desc, dueDate, title`. A key is
 * `title`, `dateCreated`, `dateModified` or the name of a label on the child notes. A key followed by
 * `first` or `last` instead groups the children that have that label before or after the rest —
 * `archived last, title`.
 */

export interface SortCriterion {
    key: string;
    /** Set by an explicit `asc`/`desc` after the key; `undefined` follows `#sortDirection`. */
    descending?: boolean;
    /** Set by `first`/`last` after the key: groups by whether a child has the label. */
    group?: "first" | "last";
}

/** Parses a `#sorted` value into its levels; an empty value sorts by title. */
export function parseSortCriteria(value: string | null | undefined): SortCriterion[] {
    const criteria: SortCriterion[] = [];
    for (const level of (value ?? "").split(",")) {
        const words = level.trim().split(/\s+/);
        const last = words[words.length - 1].toLowerCase();
        if (words.length > 1 && (last === "first" || last === "last")) {
            criteria.push({ key: words.slice(0, -1).join(" "), group: last });
            continue;
        }
        const isDirection = words.length > 1 && (last === "asc" || last === "desc");
        const key = (isDirection ? words.slice(0, -1) : words).join(" ");
        if (key) {
            criteria.push({ key, descending: isDirection ? last === "desc" : undefined });
        }
    }
    return criteria.length > 0 ? criteria : [{ key: "title" }];
}

/** Writes levels back into the `#sorted` grammar; only a level without a direction or grouping is bare. */
export function serializeSortCriteria(criteria: SortCriterion[]) {
    return criteria
        .map(({ key, descending, group }) => {
            if (group) {
                return `${key} ${group}`;
            }
            if (descending === undefined) {
                return key;
            }
            return `${key} ${descending ? "desc" : "asc"}`;
        })
        .join(", ");
}
