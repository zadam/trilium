# API Reference
External Trilium API

## Authentication

### `EtapiTokenAuth`

API key in the `Authorization` header.

### `EtapiBasicAuth`

HTTP `basic` authentication.

Basic Auth where username is arbitrary string (e.g. "trilium", not checked), username is the ETAPI token. To emphasize, do not use Trilium password here (won't work), only the generated ETAPI token (from Options -> ETAPI)

## Endpoints

### `POST /create-note`

Create a note and place it into the note tree

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Request body** (required)

*   `application/json`: `CreateNoteDef`

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `parentNoteId` | `EntityId` | Yes | Note ID of the parent note in the tree |
| `title` | `string` | Yes |  |
| `type` | `string` | Yes | One of `text`, `code`, `file`, `image`, `search`, `book`, `relationMap`, `render`. |
| `mime` | `string` | No | this needs to be specified only for note types 'code', 'file', 'image'. |
| `content` | `string` | Yes |  |
| `notePosition` | `integer` | No | Position of the note in the parent. Normal ordering is 10, 20, 30 ... So if you want to create a note on the first position, use e.g. 5, for second position 15, for last e.g. 1000000 |
| `prefix` | `string` | No | Prefix is branch (placement) specific title prefix for the note. Let's say you have your note placed into two different places in the tree, but you want to change the title a bit in one of the placements. For this you can use prefix. |
| `isExpanded` | `boolean` | No | true if this note (as a folder) should appear expanded |
| `noteId` | `EntityId` | No | DON'T specify unless you want to force a specific noteId |
| `branchId` | `EntityId` | No | DON'T specify unless you want to force a specific branchId |
| `dateCreated` | `LocalDateTime` | No | Local timestap of the note creation. Specify only if you want to override the default (current datetime in the current timezone/offset). |
| `utcDateCreated` | `UtcDateTime` | No | UTC timestap of the note creation. Specify only if you want to override the default (current datetime). |
| `utcDateModified` | `UtcDateTime` | No | UTC timestamp of the note's last modification, e.g. to keep the date of a note being migrated from another application. The local dateModified is derived from it. Specify only if you want to override the default (current datetime). |

**Responses**

*   `201`: note created (`NoteWithBranch`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `note` | `Note` | No |  |
| `branch` | `Branch` | No | Branch places the note into the tree, it represents the relationship between a parent note and child note |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /notes`

Search notes

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `search` | query | `string` | Yes | search query string as described in [https://triliumnext.github.io/Docs/Wiki/search.html](https://triliumnext.github.io/Docs/Wiki/search.html) |
| `fastSearch` | query | `boolean` | No | enable fast search (fulltext doesn't look into content) |
| `includeArchivedNotes` | query | `boolean` | No | search by default ignores archived notes. Set to 'true' to includes archived notes into search results. |
| `ancestorNoteId` | query | `EntityId` | No | search only in a subtree identified by the subtree noteId. By default whole tree is searched. |
| `ancestorDepth` | query | `string` | No | define how deep in the tree should the notes be searched |
| `orderBy` | query | `string` | No | name of the property/label to order search results by |
| `orderDirection` | query | `string` | No | order direction, ascending or descending. One of `asc`, `desc`. |
| `limit` | query | `integer` | No | limit the number of results you want to receive |
| `debug` | query | `boolean` | No | set to true to get debug information in the response (search query parsing) |

**Responses**

*   `200`: search response (`SearchResponse`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `results` | `array of Note` | Yes |  |
| `debugInfo` | `object` | No | debugging info on parsing the search query enabled with &debug=true parameter |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /notes/{noteId}`

Returns a note identified by its ID

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `noteId` | path | `EntityId` | Yes |  |

**Responses**

*   `200`: note response (`Note`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `noteId` | `EntityId` | No |  |
| `title` | `string` | No | Title of the note. Returned as "\[protected\]" for protected notes, since ETAPI cannot open a protected session. |
| `type` | `string` | No | One of `text`, `code`, `render`, `file`, `image`, `search`, `relationMap`, `book`, `noteMap`, `mermaid`, `webView`, `shortcut`, `doc`, `contentWidget`, `launcher`. |
| `mime` | `string` | No |  |
| `isProtected` | `boolean` | No |  |
| `blobId` | `string` | No | ID of the blob object which effectively serves as a content hash |
| `attributes` | `AttributeList` | No |  |
| `parentNoteIds` | `EntityIdList` | No |  |
| `childNoteIds` | `EntityIdList` | No |  |
| `parentBranchIds` | `EntityIdList` | No |  |
| `childBranchIds` | `EntityIdList` | No |  |
| `dateCreated` | `LocalDateTime` | No |  |
| `dateModified` | `LocalDateTime` | No |  |
| `utcDateCreated` | `UtcDateTime` | No |  |
| `utcDateModified` | `UtcDateTime` | No | Writable through PATCH, e.g. to restore a migrated note's date after its content was rewritten. The local dateModified is derived from it. |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `DELETE /notes/{noteId}`

deletes a single note based on the noteId supplied

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `noteId` | path | `EntityId` | Yes |  |

**Responses**

*   `204`: note deleted
*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `PATCH /notes/{noteId}`

patch a note identified by the noteId with changes in the body

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `noteId` | path | `EntityId` | Yes |  |

**Request body** (required)

*   `application/json`: `Note`

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `noteId` | `EntityId` | No |  |
| `title` | `string` | No | Title of the note. Returned as "\[protected\]" for protected notes, since ETAPI cannot open a protected session. |
| `type` | `string` | No | One of `text`, `code`, `render`, `file`, `image`, `search`, `relationMap`, `book`, `noteMap`, `mermaid`, `webView`, `shortcut`, `doc`, `contentWidget`, `launcher`. |
| `mime` | `string` | No |  |
| `isProtected` | `boolean` | No |  |
| `blobId` | `string` | No | ID of the blob object which effectively serves as a content hash |
| `attributes` | `AttributeList` | No |  |
| `parentNoteIds` | `EntityIdList` | No |  |
| `childNoteIds` | `EntityIdList` | No |  |
| `parentBranchIds` | `EntityIdList` | No |  |
| `childBranchIds` | `EntityIdList` | No |  |
| `dateCreated` | `LocalDateTime` | No |  |
| `dateModified` | `LocalDateTime` | No |  |
| `utcDateCreated` | `UtcDateTime` | No |  |
| `utcDateModified` | `UtcDateTime` | No | Writable through PATCH, e.g. to restore a migrated note's date after its content was rewritten. The local dateModified is derived from it. |

**Responses**

*   `200`: note updated (`Note`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `noteId` | `EntityId` | No |  |
| `title` | `string` | No | Title of the note. Returned as "\[protected\]" for protected notes, since ETAPI cannot open a protected session. |
| `type` | `string` | No | One of `text`, `code`, `render`, `file`, `image`, `search`, `relationMap`, `book`, `noteMap`, `mermaid`, `webView`, `shortcut`, `doc`, `contentWidget`, `launcher`. |
| `mime` | `string` | No |  |
| `isProtected` | `boolean` | No |  |
| `blobId` | `string` | No | ID of the blob object which effectively serves as a content hash |
| `attributes` | `AttributeList` | No |  |
| `parentNoteIds` | `EntityIdList` | No |  |
| `childNoteIds` | `EntityIdList` | No |  |
| `parentBranchIds` | `EntityIdList` | No |  |
| `childBranchIds` | `EntityIdList` | No |  |
| `dateCreated` | `LocalDateTime` | No |  |
| `dateModified` | `LocalDateTime` | No |  |
| `utcDateCreated` | `UtcDateTime` | No |  |
| `utcDateModified` | `UtcDateTime` | No | Writable through PATCH, e.g. to restore a migrated note's date after its content was rewritten. The local dateModified is derived from it. |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /notes/{noteId}/content`

Returns note content identified by its ID

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `noteId` | path | `EntityId` | Yes |  |

**Responses**

*   `200`: note content, served with the note's MIME type as `Content-Type` (`string (binary)`)

### `PUT /notes/{noteId}/content`

Updates note content identified by its ID

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `noteId` | path | `EntityId` | Yes |  |

**Request body** (required)

New content of the note. Send text (such as the HTML of a text note) as `text/plain` and binary data (such as the file of an image or file note) as `application/octet-stream`; other content types are not accepted.

*   `text/plain`: `string`
*   `application/octet-stream`: `string (binary)`

**Responses**

*   `204`: note content updated

### `GET /notes/{noteId}/export`

Exports ZIP file export of a given note subtree. To export whole document, use "root" for noteId

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `noteId` | path | `EntityId` | Yes |  |
| `format` | query | `any` | No | One of `html`, `markdown`, `share`. |

**Responses**

*   `200`: export ZIP file (`string (binary)`)
*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `POST /notes/{noteId}/import`

Imports ZIP file into a given note.

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `noteId` | path | `EntityId` | Yes |  |

**Responses**

*   `201`: note created (`NoteWithBranch`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `note` | `Note` | No |  |
| `branch` | `Branch` | No | Branch places the note into the tree, it represents the relationship between a parent note and child note |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `POST /notes/{noteId}/revision`

Create a note revision for the given note

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `noteId` | path | `EntityId` | Yes |  |
| `format` | query | `any` | No | One of `html`, `markdown`. |

**Responses**

*   `204`: revision has been created
*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /notes/{noteId}/revisions`

Returns the revisions of a note identified by its ID. Protected revisions are omitted, since they cannot be read through ETAPI individually either.

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `noteId` | path | `EntityId` | Yes |  |

**Responses**

*   `200`: list of revisions (`array of Revision`)
*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /notes/{noteId}/attachments`

Returns all attachments for a note identified by its ID

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `noteId` | path | `EntityId` | Yes |  |

**Responses**

*   `200`: list of attachments (`array of Attachment`)
*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `POST /notes/{noteId}/undelete`

Restore a deleted note. The note must be deleted and must have at least one undeleted parent.

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `noteId` | path | `EntityId` | Yes |  |

**Responses**

*   `200`: note restored successfully (`object`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `success` | `boolean` | No |  |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /notes/history`

Returns recent changes including note creations, modifications, and deletions

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `ancestorNoteId` | query | `EntityId` | No | Limit changes to a subtree identified by this note ID. Defaults to "root" (all notes). |

**Responses**

*   `200`: list of recent changes (`array of RecentChange`)
*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /revisions/{revisionId}`

Returns a revision identified by its ID

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `revisionId` | path | `EntityId` | Yes |  |

**Responses**

*   `200`: revision response (`Revision`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `revisionId` | `EntityId` | No |  |
| `noteId` | `EntityId` | No |  |
| `type` | `string` | No | One of `text`, `code`, `render`, `file`, `image`, `search`, `relationMap`, `book`, `noteMap`, `mermaid`, `webView`, `shortcut`, `doc`, `contentWidget`, `launcher`. |
| `mime` | `string` | No |  |
| `isProtected` | `boolean` | No |  |
| `title` | `string` | No |  |
| `blobId` | `string` | No | ID of the blob object which effectively serves as a content hash |
| `dateLastEdited` | `LocalDateTime` | No |  |
| `dateCreated` | `LocalDateTime` | No |  |
| `utcDateLastEdited` | `UtcDateTime` | No |  |
| `utcDateCreated` | `UtcDateTime` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |
| `contentLength` | `integer (int32)` | No |  |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /revisions/{revisionId}/content`

Returns revision content identified by its ID

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `revisionId` | path | `EntityId` | Yes |  |

**Responses**

*   `200`: revision content response (`string`)
*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `POST /branches`

Create a branch (clone a note to a different location in the tree). In case there is a branch between parent note and child note already, then this will update the existing branch with prefix, notePosition and isExpanded.

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Request body** (required)

*   `application/json`: `Branch`

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `branchId` | `EntityId` | No |  |
| `noteId` | `EntityId` | No | identifies the child note |
| `parentNoteId` | `EntityId` | No | identifies the parent note |
| `prefix` | `string` | No |  |
| `notePosition` | `integer (int32)` | No |  |
| `isExpanded` | `boolean` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |

**Responses**

*   `200`: branch updated (branch between parent note and child note already existed) (`Branch`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `branchId` | `EntityId` | No |  |
| `noteId` | `EntityId` | No | identifies the child note |
| `parentNoteId` | `EntityId` | No | identifies the parent note |
| `prefix` | `string` | No |  |
| `notePosition` | `integer (int32)` | No |  |
| `isExpanded` | `boolean` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |

*   `201`: branch created (`Branch`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `branchId` | `EntityId` | No |  |
| `noteId` | `EntityId` | No | identifies the child note |
| `parentNoteId` | `EntityId` | No | identifies the parent note |
| `prefix` | `string` | No |  |
| `notePosition` | `integer (int32)` | No |  |
| `isExpanded` | `boolean` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /branches/{branchId}`

Returns a branch identified by its ID

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `branchId` | path | `EntityId` | Yes |  |

**Responses**

*   `200`: branch response (`Branch`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `branchId` | `EntityId` | No |  |
| `noteId` | `EntityId` | No | identifies the child note |
| `parentNoteId` | `EntityId` | No | identifies the parent note |
| `prefix` | `string` | No |  |
| `notePosition` | `integer (int32)` | No |  |
| `isExpanded` | `boolean` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `DELETE /branches/{branchId}`

deletes a branch based on the branchId supplied. If this is the last branch of the (child) note, then the note is deleted as well.

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `branchId` | path | `EntityId` | Yes |  |

**Responses**

*   `204`: branch deleted
*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `PATCH /branches/{branchId}`

patch a branch identified by the branchId with changes in the body. Only prefix and notePosition can be updated. If you want to update other properties, you need to delete the old branch and create a new one.

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `branchId` | path | `EntityId` | Yes |  |

**Request body** (required)

*   `application/json`: `Branch`

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `branchId` | `EntityId` | No |  |
| `noteId` | `EntityId` | No | identifies the child note |
| `parentNoteId` | `EntityId` | No | identifies the parent note |
| `prefix` | `string` | No |  |
| `notePosition` | `integer (int32)` | No |  |
| `isExpanded` | `boolean` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |

**Responses**

*   `200`: branch updated (`Branch`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `branchId` | `EntityId` | No |  |
| `noteId` | `EntityId` | No | identifies the child note |
| `parentNoteId` | `EntityId` | No | identifies the parent note |
| `prefix` | `string` | No |  |
| `notePosition` | `integer (int32)` | No |  |
| `isExpanded` | `boolean` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `POST /attachments`

create an attachment

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Request body** (required)

*   `application/json`: `CreateAttachment`

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `ownerId` | `EntityId` | No | identifies the owner of the attachment, is either noteId or revisionId |
| `role` | `string` | No |  |
| `mime` | `string` | No |  |
| `title` | `string` | No |  |
| `content` | `string` | No | Text content of the attachment, stored as-is. To store binary content, create the attachment without it, then upload the data with `PUT /attachments/{attachmentId}/content`. |
| `position` | `integer (int32)` | No |  |

**Responses**

*   `201`: attachment created (`Attachment`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `attachmentId` | `EntityId` | No |  |
| `ownerId` | `EntityId` | No | identifies the owner of the attachment, is either noteId or revisionId |
| `role` | `string` | No |  |
| `mime` | `string` | No |  |
| `title` | `string` | No | Title of the attachment. Returned as "\[protected\]" for protected attachments, since ETAPI cannot open a protected session. |
| `position` | `integer (int32)` | No |  |
| `blobId` | `string` | No | ID of the blob object which effectively serves as a content hash |
| `dateModified` | `LocalDateTime` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |
| `utcDateScheduledForErasureSince` | `UtcDateTime` | No |  |
| `contentLength` | `integer (int32)` | No |  |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /attachments/{attachmentId}`

Returns an attachment identified by its ID

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `attachmentId` | path | `EntityId` | Yes |  |

**Responses**

*   `200`: attachment response (`Attachment`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `attachmentId` | `EntityId` | No |  |
| `ownerId` | `EntityId` | No | identifies the owner of the attachment, is either noteId or revisionId |
| `role` | `string` | No |  |
| `mime` | `string` | No |  |
| `title` | `string` | No | Title of the attachment. Returned as "\[protected\]" for protected attachments, since ETAPI cannot open a protected session. |
| `position` | `integer (int32)` | No |  |
| `blobId` | `string` | No | ID of the blob object which effectively serves as a content hash |
| `dateModified` | `LocalDateTime` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |
| `utcDateScheduledForErasureSince` | `UtcDateTime` | No |  |
| `contentLength` | `integer (int32)` | No |  |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `DELETE /attachments/{attachmentId}`

deletes an attachment based on the attachmentId supplied.

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `attachmentId` | path | `EntityId` | Yes |  |

**Responses**

*   `204`: attachment deleted
*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `PATCH /attachments/{attachmentId}`

patch an attachment identified by the attachmentId with changes in the body. Only role, mime, title, and position are patchable.

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `attachmentId` | path | `EntityId` | Yes |  |

**Request body** (required)

*   `application/json`: `Attachment`

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `attachmentId` | `EntityId` | No |  |
| `ownerId` | `EntityId` | No | identifies the owner of the attachment, is either noteId or revisionId |
| `role` | `string` | No |  |
| `mime` | `string` | No |  |
| `title` | `string` | No | Title of the attachment. Returned as "\[protected\]" for protected attachments, since ETAPI cannot open a protected session. |
| `position` | `integer (int32)` | No |  |
| `blobId` | `string` | No | ID of the blob object which effectively serves as a content hash |
| `dateModified` | `LocalDateTime` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |
| `utcDateScheduledForErasureSince` | `UtcDateTime` | No |  |
| `contentLength` | `integer (int32)` | No |  |

**Responses**

*   `200`: attribute updated (`Attachment`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `attachmentId` | `EntityId` | No |  |
| `ownerId` | `EntityId` | No | identifies the owner of the attachment, is either noteId or revisionId |
| `role` | `string` | No |  |
| `mime` | `string` | No |  |
| `title` | `string` | No | Title of the attachment. Returned as "\[protected\]" for protected attachments, since ETAPI cannot open a protected session. |
| `position` | `integer (int32)` | No |  |
| `blobId` | `string` | No | ID of the blob object which effectively serves as a content hash |
| `dateModified` | `LocalDateTime` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |
| `utcDateScheduledForErasureSince` | `UtcDateTime` | No |  |
| `contentLength` | `integer (int32)` | No |  |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /attachments/{attachmentId}/content`

Returns attachment content identified by its ID

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `attachmentId` | path | `EntityId` | Yes |  |

**Responses**

*   `200`: attachment content, served with the attachment's MIME type as `Content-Type` (`string (binary)`)

### `PUT /attachments/{attachmentId}/content`

Updates attachment content identified by its ID

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `attachmentId` | path | `EntityId` | Yes |  |

**Request body** (required)

New content of the attachment. Send text as `text/plain` and binary data (such as an image or a PDF) as `application/octet-stream`; other content types are not accepted.

*   `text/plain`: `string`
*   `application/octet-stream`: `string (binary)`

**Responses**

*   `204`: attachment content updated

### `POST /attributes`

create an attribute for a given note

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Request body** (required)

*   `application/json`: `Attribute`

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `attributeId` | `EntityId` | No |  |
| `noteId` | `EntityId` | No | identifies the child note |
| `type` | `string` | No | One of `label`, `relation`. |
| `name` | `string` | No |  |
| `value` | `string` | No |  |
| `position` | `integer (int32)` | No |  |
| `isInheritable` | `boolean` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |

**Responses**

*   `201`: attribute created (`Attribute`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `attributeId` | `EntityId` | No |  |
| `noteId` | `EntityId` | No | identifies the child note |
| `type` | `string` | No | One of `label`, `relation`. |
| `name` | `string` | No |  |
| `value` | `string` | No |  |
| `position` | `integer (int32)` | No |  |
| `isInheritable` | `boolean` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /attributes/{attributeId}`

Returns an attribute identified by its ID

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `attributeId` | path | `EntityId` | Yes |  |

**Responses**

*   `200`: attribute response (`Attribute`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `attributeId` | `EntityId` | No |  |
| `noteId` | `EntityId` | No | identifies the child note |
| `type` | `string` | No | One of `label`, `relation`. |
| `name` | `string` | No |  |
| `value` | `string` | No |  |
| `position` | `integer (int32)` | No |  |
| `isInheritable` | `boolean` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `DELETE /attributes/{attributeId}`

deletes an attribute based on the attributeId supplied.

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `attributeId` | path | `EntityId` | Yes |  |

**Responses**

*   `204`: attribute deleted
*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `PATCH /attributes/{attributeId}`

patch an attribute identified by the attributeId with changes in the body. For labels, only value and position can be updated. For relations, only position can be updated. If you want to modify other properties, you need to delete the old attribute and create a new one.

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `attributeId` | path | `EntityId` | Yes |  |

**Request body** (required)

*   `application/json`: `Attribute`

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `attributeId` | `EntityId` | No |  |
| `noteId` | `EntityId` | No | identifies the child note |
| `type` | `string` | No | One of `label`, `relation`. |
| `name` | `string` | No |  |
| `value` | `string` | No |  |
| `position` | `integer (int32)` | No |  |
| `isInheritable` | `boolean` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |

**Responses**

*   `200`: attribute updated (`Attribute`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `attributeId` | `EntityId` | No |  |
| `noteId` | `EntityId` | No | identifies the child note |
| `type` | `string` | No | One of `label`, `relation`. |
| `name` | `string` | No |  |
| `value` | `string` | No |  |
| `position` | `integer (int32)` | No |  |
| `isInheritable` | `boolean` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `POST /refresh-note-ordering/{parentNoteId}`

notePositions in branches are not automatically pushed to connected clients and need a specific instruction. If you want your changes to be in effect immediately, call this service after setting branches' notePosition. Note that you need to supply "parentNoteId" of branch(es) with changed positions.

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `parentNoteId` | path | `EntityId` | Yes |  |

**Responses**

*   `204`: note ordering will be asynchronously updated in all connected clients
*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /inbox/{date}`

returns an "inbox" note, into which note can be created. Date will be used depending on whether the inbox is a fixed note (identified with #inbox label) or a day note in a journal. A database with neither returns the root note, and ignores the date, rather than creating a journal to hold a day note.

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `date` | path | `string (date)` | Yes |  |

**Responses**

*   `200`: inbox note (`Note`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `noteId` | `EntityId` | No |  |
| `title` | `string` | No | Title of the note. Returned as "\[protected\]" for protected notes, since ETAPI cannot open a protected session. |
| `type` | `string` | No | One of `text`, `code`, `render`, `file`, `image`, `search`, `relationMap`, `book`, `noteMap`, `mermaid`, `webView`, `shortcut`, `doc`, `contentWidget`, `launcher`. |
| `mime` | `string` | No |  |
| `isProtected` | `boolean` | No |  |
| `blobId` | `string` | No | ID of the blob object which effectively serves as a content hash |
| `attributes` | `AttributeList` | No |  |
| `parentNoteIds` | `EntityIdList` | No |  |
| `childNoteIds` | `EntityIdList` | No |  |
| `parentBranchIds` | `EntityIdList` | No |  |
| `childBranchIds` | `EntityIdList` | No |  |
| `dateCreated` | `LocalDateTime` | No |  |
| `dateModified` | `LocalDateTime` | No |  |
| `utcDateCreated` | `UtcDateTime` | No |  |
| `utcDateModified` | `UtcDateTime` | No | Writable through PATCH, e.g. to restore a migrated note's date after its content was rewritten. The local dateModified is derived from it. |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /calendar/days/{date}`

returns a day note for a given date. Gets created if doesn't exist.

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `date` | path | `string (date)` | Yes |  |

**Responses**

*   `200`: day note (`Note`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `noteId` | `EntityId` | No |  |
| `title` | `string` | No | Title of the note. Returned as "\[protected\]" for protected notes, since ETAPI cannot open a protected session. |
| `type` | `string` | No | One of `text`, `code`, `render`, `file`, `image`, `search`, `relationMap`, `book`, `noteMap`, `mermaid`, `webView`, `shortcut`, `doc`, `contentWidget`, `launcher`. |
| `mime` | `string` | No |  |
| `isProtected` | `boolean` | No |  |
| `blobId` | `string` | No | ID of the blob object which effectively serves as a content hash |
| `attributes` | `AttributeList` | No |  |
| `parentNoteIds` | `EntityIdList` | No |  |
| `childNoteIds` | `EntityIdList` | No |  |
| `parentBranchIds` | `EntityIdList` | No |  |
| `childBranchIds` | `EntityIdList` | No |  |
| `dateCreated` | `LocalDateTime` | No |  |
| `dateModified` | `LocalDateTime` | No |  |
| `utcDateCreated` | `UtcDateTime` | No |  |
| `utcDateModified` | `UtcDateTime` | No | Writable through PATCH, e.g. to restore a migrated note's date after its content was rewritten. The local dateModified is derived from it. |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /calendar/week-first-day/{date}`

Get the day note starting the week

Returns the day note for the first day of the week containing the given date, honouring the configured first day of week. The note is created if it doesn't exist. This returns a day note, not a week note, so unlike /calendar/weeks/{week} it does not require the enableWeekNote label on the calendar root.

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `date` | path | `string (date)` | Yes | Any date within the week, in the format YYYY-MM-DD. |

**Responses**

*   `200`: day note starting the week (`Note`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `noteId` | `EntityId` | No |  |
| `title` | `string` | No | Title of the note. Returned as "\[protected\]" for protected notes, since ETAPI cannot open a protected session. |
| `type` | `string` | No | One of `text`, `code`, `render`, `file`, `image`, `search`, `relationMap`, `book`, `noteMap`, `mermaid`, `webView`, `shortcut`, `doc`, `contentWidget`, `launcher`. |
| `mime` | `string` | No |  |
| `isProtected` | `boolean` | No |  |
| `blobId` | `string` | No | ID of the blob object which effectively serves as a content hash |
| `attributes` | `AttributeList` | No |  |
| `parentNoteIds` | `EntityIdList` | No |  |
| `childNoteIds` | `EntityIdList` | No |  |
| `parentBranchIds` | `EntityIdList` | No |  |
| `childBranchIds` | `EntityIdList` | No |  |
| `dateCreated` | `LocalDateTime` | No |  |
| `dateModified` | `LocalDateTime` | No |  |
| `utcDateCreated` | `UtcDateTime` | No |  |
| `utcDateModified` | `UtcDateTime` | No | Writable through PATCH, e.g. to restore a migrated note's date after its content was rewritten. The local dateModified is derived from it. |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /calendar/weeks/{week}`

Get a week note

Returns a week note for a given ISO week (format YYYY-Www, e.g., 2025-W01). The note is created if it doesn't exist.

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `week` | path | `string` | Yes | The ISO 8601 week identifier (YYYY-Www). |

**Responses**

*   `200`: week note (`Note`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `noteId` | `EntityId` | No |  |
| `title` | `string` | No | Title of the note. Returned as "\[protected\]" for protected notes, since ETAPI cannot open a protected session. |
| `type` | `string` | No | One of `text`, `code`, `render`, `file`, `image`, `search`, `relationMap`, `book`, `noteMap`, `mermaid`, `webView`, `shortcut`, `doc`, `contentWidget`, `launcher`. |
| `mime` | `string` | No |  |
| `isProtected` | `boolean` | No |  |
| `blobId` | `string` | No | ID of the blob object which effectively serves as a content hash |
| `attributes` | `AttributeList` | No |  |
| `parentNoteIds` | `EntityIdList` | No |  |
| `childNoteIds` | `EntityIdList` | No |  |
| `parentBranchIds` | `EntityIdList` | No |  |
| `childBranchIds` | `EntityIdList` | No |  |
| `dateCreated` | `LocalDateTime` | No |  |
| `dateModified` | `LocalDateTime` | No |  |
| `utcDateCreated` | `UtcDateTime` | No |  |
| `utcDateModified` | `UtcDateTime` | No | Writable through PATCH, e.g. to restore a migrated note's date after its content was rewritten. The local dateModified is derived from it. |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /calendar/months/{month}`

Get a month note

Returns a month note for a given month (format YYYY-MM, e.g., 2022-02). The note is created if it doesn't exist.

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `month` | path | `string` | Yes |  |

**Responses**

*   `200`: month note (`Note`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `noteId` | `EntityId` | No |  |
| `title` | `string` | No | Title of the note. Returned as "\[protected\]" for protected notes, since ETAPI cannot open a protected session. |
| `type` | `string` | No | One of `text`, `code`, `render`, `file`, `image`, `search`, `relationMap`, `book`, `noteMap`, `mermaid`, `webView`, `shortcut`, `doc`, `contentWidget`, `launcher`. |
| `mime` | `string` | No |  |
| `isProtected` | `boolean` | No |  |
| `blobId` | `string` | No | ID of the blob object which effectively serves as a content hash |
| `attributes` | `AttributeList` | No |  |
| `parentNoteIds` | `EntityIdList` | No |  |
| `childNoteIds` | `EntityIdList` | No |  |
| `parentBranchIds` | `EntityIdList` | No |  |
| `childBranchIds` | `EntityIdList` | No |  |
| `dateCreated` | `LocalDateTime` | No |  |
| `dateModified` | `LocalDateTime` | No |  |
| `utcDateCreated` | `UtcDateTime` | No |  |
| `utcDateModified` | `UtcDateTime` | No | Writable through PATCH, e.g. to restore a migrated note's date after its content was rewritten. The local dateModified is derived from it. |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /calendar/years/{year}`

Get a year note

Returns a year note for a given year (format YYYY, e.g., 2022). The note is created if it doesn't exist.

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `year` | path | `string` | Yes |  |

**Responses**

*   `200`: year note (`Note`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `noteId` | `EntityId` | No |  |
| `title` | `string` | No | Title of the note. Returned as "\[protected\]" for protected notes, since ETAPI cannot open a protected session. |
| `type` | `string` | No | One of `text`, `code`, `render`, `file`, `image`, `search`, `relationMap`, `book`, `noteMap`, `mermaid`, `webView`, `shortcut`, `doc`, `contentWidget`, `launcher`. |
| `mime` | `string` | No |  |
| `isProtected` | `boolean` | No |  |
| `blobId` | `string` | No | ID of the blob object which effectively serves as a content hash |
| `attributes` | `AttributeList` | No |  |
| `parentNoteIds` | `EntityIdList` | No |  |
| `childNoteIds` | `EntityIdList` | No |  |
| `parentBranchIds` | `EntityIdList` | No |  |
| `childBranchIds` | `EntityIdList` | No |  |
| `dateCreated` | `LocalDateTime` | No |  |
| `dateModified` | `LocalDateTime` | No |  |
| `utcDateCreated` | `UtcDateTime` | No |  |
| `utcDateModified` | `UtcDateTime` | No | Writable through PATCH, e.g. to restore a migrated note's date after its content was rewritten. The local dateModified is derived from it. |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `POST /auth/login`

get an ETAPI token based on password for further use with ETAPI

**Authorization**: none

**Request body** (required)

*   `application/json`: `object`

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `password` | `string` | No | user's password used to e.g. login to Trilium server and/or protect notes |

**Responses**

*   `201`: auth token (`object`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `authToken` | `string` | No |  |

*   `429`: Client IP has been blacklisted because too many requests (possibly failed authentications) were made within a short time frame, try again later
*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `POST /auth/logout`

logout (delete/deactivate) an ETAPI token

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Responses**

*   `204`: logout successful
*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /app-info`

returns information about the running Trilium instance

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Responses**

*   `200`: app info (`AppInfo`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `appVersion` | `string` | No | Trilium version |
| `dbVersion` | `integer (int32)` | No | DB version |
| `syncVersion` | `integer (int32)` | No | Sync protocol version |
| `buildDate` | `string (date-time)` | No | build date |
| `buildRevision` | `string` | No | git build revision |
| `dataDirectory` | `string` | No | data directory where Trilium stores files |
| `clipperProtocolVersion` | `string` | No | version of the supported Trilium Web Clipper protocol |
| `utcDateTime` | `string` | No | current UTC date time |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `PUT /backup/{backupName}`

Create a database backup under a given name

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `backupName` | path | `StringId` | Yes | If the backupName is e.g. "now", then the backup will be written to "backup-now.db" file |

**Responses**

*   `204`: backup has been created
*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `GET /metrics`

Get instance metrics

Returns instance and database metrics for monitoring: note, attachment, revision, branch, attribute and blob counts, note and attachment type breakdowns, version information and database size. Counts only — no note titles, content or attributes.

The same data is served by GET /api/metrics to the web session.

**Authorization**: `EtapiTokenAuth` or `EtapiBasicAuth`

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `format` | query | `string` | No | Response format. Defaults to Prometheus text. One of `prometheus`, `json`. |

**Responses**

*   `200`: instance metrics (`string`, `Metrics`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `version` | `object` | No |  |
| `database` | `object` | No |  |
| `noteTypes` | `object` | No | Number of active notes per note type |
| `attachmentTypes` | `object` | No | Number of active attachments per MIME type |
| `statistics` | `object` | No |  |
| `timestamp` | `string` | No |  |

*   `default`: unexpected error (`Error`)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

## Schemas

### `CreateNoteDef`

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `parentNoteId` | `EntityId` | Yes | Note ID of the parent note in the tree |
| `title` | `string` | Yes |  |
| `type` | `string` | Yes | One of `text`, `code`, `file`, `image`, `search`, `book`, `relationMap`, `render`. |
| `mime` | `string` | No | this needs to be specified only for note types 'code', 'file', 'image'. |
| `content` | `string` | Yes |  |
| `notePosition` | `integer` | No | Position of the note in the parent. Normal ordering is 10, 20, 30 ... So if you want to create a note on the first position, use e.g. 5, for second position 15, for last e.g. 1000000 |
| `prefix` | `string` | No | Prefix is branch (placement) specific title prefix for the note. Let's say you have your note placed into two different places in the tree, but you want to change the title a bit in one of the placements. For this you can use prefix. |
| `isExpanded` | `boolean` | No | true if this note (as a folder) should appear expanded |
| `noteId` | `EntityId` | No | DON'T specify unless you want to force a specific noteId |
| `branchId` | `EntityId` | No | DON'T specify unless you want to force a specific branchId |
| `dateCreated` | `LocalDateTime` | No | Local timestap of the note creation. Specify only if you want to override the default (current datetime in the current timezone/offset). |
| `utcDateCreated` | `UtcDateTime` | No | UTC timestap of the note creation. Specify only if you want to override the default (current datetime). |
| `utcDateModified` | `UtcDateTime` | No | UTC timestamp of the note's last modification, e.g. to keep the date of a note being migrated from another application. The local dateModified is derived from it. Specify only if you want to override the default (current datetime). |

### `Note`

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `noteId` | `EntityId` | No |  |
| `title` | `string` | No | Title of the note. Returned as "\[protected\]" for protected notes, since ETAPI cannot open a protected session. |
| `type` | `string` | No | One of `text`, `code`, `render`, `file`, `image`, `search`, `relationMap`, `book`, `noteMap`, `mermaid`, `webView`, `shortcut`, `doc`, `contentWidget`, `launcher`. |
| `mime` | `string` | No |  |
| `isProtected` | `boolean` | No |  |
| `blobId` | `string` | No | ID of the blob object which effectively serves as a content hash |
| `attributes` | `AttributeList` | No |  |
| `parentNoteIds` | `EntityIdList` | No |  |
| `childNoteIds` | `EntityIdList` | No |  |
| `parentBranchIds` | `EntityIdList` | No |  |
| `childBranchIds` | `EntityIdList` | No |  |
| `dateCreated` | `LocalDateTime` | No |  |
| `dateModified` | `LocalDateTime` | No |  |
| `utcDateCreated` | `UtcDateTime` | No |  |
| `utcDateModified` | `UtcDateTime` | No | Writable through PATCH, e.g. to restore a migrated note's date after its content was rewritten. The local dateModified is derived from it. |

### `Branch`

Branch places the note into the tree, it represents the relationship between a parent note and child note

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `branchId` | `EntityId` | No |  |
| `noteId` | `EntityId` | No | identifies the child note |
| `parentNoteId` | `EntityId` | No | identifies the parent note |
| `prefix` | `string` | No |  |
| `notePosition` | `integer (int32)` | No |  |
| `isExpanded` | `boolean` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |

### `NoteWithBranch`

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `note` | `Note` | No |  |
| `branch` | `Branch` | No | Branch places the note into the tree, it represents the relationship between a parent note and child note |

### `Attachment`

Attachment is owned by a note, has title and content

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `attachmentId` | `EntityId` | No |  |
| `ownerId` | `EntityId` | No | identifies the owner of the attachment, is either noteId or revisionId |
| `role` | `string` | No |  |
| `mime` | `string` | No |  |
| `title` | `string` | No | Title of the attachment. Returned as "\[protected\]" for protected attachments, since ETAPI cannot open a protected session. |
| `position` | `integer (int32)` | No |  |
| `blobId` | `string` | No | ID of the blob object which effectively serves as a content hash |
| `dateModified` | `LocalDateTime` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |
| `utcDateScheduledForErasureSince` | `UtcDateTime` | No |  |
| `contentLength` | `integer (int32)` | No |  |

### `CreateAttachment`

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `ownerId` | `EntityId` | No | identifies the owner of the attachment, is either noteId or revisionId |
| `role` | `string` | No |  |
| `mime` | `string` | No |  |
| `title` | `string` | No |  |
| `content` | `string` | No | Text content of the attachment, stored as-is. To store binary content, create the attachment without it, then upload the data with `PUT /attachments/{attachmentId}/content`. |
| `position` | `integer (int32)` | No |  |

### `Attribute`

Attribute (Label, Relation) is a key-value record attached to a note.

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `attributeId` | `EntityId` | No |  |
| `noteId` | `EntityId` | No | identifies the child note |
| `type` | `string` | No | One of `label`, `relation`. |
| `name` | `string` | No |  |
| `value` | `string` | No |  |
| `position` | `integer (int32)` | No |  |
| `isInheritable` | `boolean` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |

### `AttributeList`

Type: `array of Attribute`

### `SearchResponse`

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `results` | `array of Note` | Yes |  |
| `debugInfo` | `object` | No | debugging info on parsing the search query enabled with &debug=true parameter |

### `EntityId`

Type: `string`

### `StringId`

Type: `string`

### `EntityIdList`

Type: `array of EntityId`

### `LocalDateTime`

Type: `string`

### `UtcDateTime`

Type: `string`

### `AppInfo`

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `appVersion` | `string` | No | Trilium version |
| `dbVersion` | `integer (int32)` | No | DB version |
| `syncVersion` | `integer (int32)` | No | Sync protocol version |
| `buildDate` | `string (date-time)` | No | build date |
| `buildRevision` | `string` | No | git build revision |
| `dataDirectory` | `string` | No | data directory where Trilium stores files |
| `clipperProtocolVersion` | `string` | No | version of the supported Trilium Web Clipper protocol |
| `utcDateTime` | `string` | No | current UTC date time |

### `Error`

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `integer (int32)` | Yes | HTTP status, identical to the one given in HTTP response |
| `code` | `string` | Yes | stable string constant |
| `message` | `string` | Yes | Human readable error, potentially with more details, |

### `Revision`

Revision represents a snapshot of note's title and content at some point in the past.

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `revisionId` | `EntityId` | No |  |
| `noteId` | `EntityId` | No |  |
| `type` | `string` | No | One of `text`, `code`, `render`, `file`, `image`, `search`, `relationMap`, `book`, `noteMap`, `mermaid`, `webView`, `shortcut`, `doc`, `contentWidget`, `launcher`. |
| `mime` | `string` | No |  |
| `isProtected` | `boolean` | No |  |
| `title` | `string` | No |  |
| `blobId` | `string` | No | ID of the blob object which effectively serves as a content hash |
| `dateLastEdited` | `LocalDateTime` | No |  |
| `dateCreated` | `LocalDateTime` | No |  |
| `utcDateLastEdited` | `UtcDateTime` | No |  |
| `utcDateCreated` | `UtcDateTime` | No |  |
| `utcDateModified` | `UtcDateTime` | No |  |
| `contentLength` | `integer (int32)` | No |  |

### `RecentChange`

Represents a recent change event (creation, modification, or deletion).

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `noteId` | `EntityId` | No |  |
| `title` | `string` | No | Title at the time of the change (may be "\[protected\]" for protected notes) |
| `current_title` | `string` | No | Current title of the note (may be "\[protected\]" for protected notes) |
| `current_isDeleted` | `boolean` | No | Whether the note is currently deleted |
| `current_deleteId` | `string` | No | Delete ID if the note is deleted |
| `current_isProtected` | `boolean` | No | Whether the note is protected |
| `utcDate` | `UtcDateTime` | No | UTC timestamp of the change |
| `date` | `LocalDateTime` | No | Local timestamp of the change |
| `canBeUndeleted` | `boolean` | No | Whether the note can be undeleted (only present for deleted notes) |

### `Metrics`

Instance and database metrics, as served by GET /etapi/metrics?format=json

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `version` | `object` | No |  |
| `database` | `object` | No |  |
| `noteTypes` | `object` | No | Number of active notes per note type |
| `attachmentTypes` | `object` | No | Number of active attachments per MIME type |
| `statistics` | `object` | No |  |
| `timestamp` | `string` | No |  |