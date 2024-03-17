import { NoteType } from "../becca/entities/rows";

export interface NoteParams {
    /** optionally can force specific noteId */
    noteId?: string;
    parentNoteId: string;
    templateNoteId?: string;
    title: string;
    content: string;
    type: NoteType;
    /** default value is derived from default mimes for type */
    mime?: string;
    /** default is false */
    isProtected?: boolean;
    /** default is false */
    isExpanded?: boolean;
    /** default is empty string */
    prefix?: string;
    /** default is the last existing notePosition in a parent + 10 */
    notePosition?: number;
    dateCreated?: string;
    utcDateCreated?: string;
    ignoreForbiddenParents?: boolean;
    target?: "into";
}