export interface TokenData {
    token: string;
    inQuotes?: boolean;
    startIndex?: number;
    endIndex?: number;
}

export interface SearchParams {
    fastSearch?: boolean;
    includeArchivedNotes?: boolean;
    includeHiddenNotes?: boolean;
    ignoreHoistedNote?: boolean;
    ancestorNoteId?: string;
    ancestorDepth?: string;
    orderBy?: string;
    orderDirection?: string;
    limit?: number | null;
    debug?: boolean;
    fuzzyAttributeSearch?: boolean;
}