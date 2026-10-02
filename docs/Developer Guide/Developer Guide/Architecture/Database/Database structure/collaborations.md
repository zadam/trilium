# collaborations
A collaboration opens one note, or its whole subtree, to guests at `/collab/:collabId`. Each capability (viewing, editing, adding child notes) is either open to anyone with the link or gated by a password set by the host; only the scrypt hash and salt of each password are stored. Rows are synced like `etapi_tokens`, so every instance in the host's sync cluster can serve the link.

| Column Name | Data Type | Nullity | Default value | Description |
| --- | --- | --- | --- | --- |
| `collabId` | Text | Non-null |  | A unique ID of the collaboration (e.g. `aHmLr5BywvfJ`), which is also the public path segment. |
| `noteId` | Text | Non-null |  | The note the collaboration opens. |
| `includeSubtree` | Integer | Non-null | 0 | `1` if the note's descendants are in scope too, `0` if only the note itself. |
| `viewMode` | Text | Non-null |  | `open` (anyone with the link) or `password`. |
| `editMode` | Text | Non-null |  | `none`, `open` or `password`. |
| `createMode` | Text | Non-null |  | `none` or `password`; adding child notes is never open and needs `includeSubtree`. |
| `viewPasswordHash` | Text | Nullable | null | Base64 scrypt hash of the view password, when `viewMode` is `password`. |
| `viewPasswordSalt` | Text | Nullable | null | Base64 salt of the view password. |
| `editPasswordHash` | Text | Nullable | null | Base64 scrypt hash of the edit password, when `editMode` is `password`. |
| `editPasswordSalt` | Text | Nullable | null | Base64 salt of the edit password. |
| `createPasswordHash` | Text | Nullable | null | Base64 scrypt hash of the password for adding child notes, when `createMode` is `password`. |
| `createPasswordSalt` | Text | Nullable | null | Base64 salt of that password. |
| `slug` | Text | Nullable | null | An optional readable alias that can replace `collabId` in the link. |
| `maxGuests` | Integer | Non-null | 10 | How many guests can hold a connection at the same time; a guest with a session counts once, the host's own session never. |
| `hostName` | Text | Nullable | null | The name the host goes by on the guest pages and beside their cursor; `null` shows the translated default, “Host”. |
| `hostColor` | Text | Nullable | null | One of the people colors, the host's on the guest pages and on their cursor; `null` shows the first color of the palette. |
| `utcDateCreated` | Text | Non-null |  | Creation date in UTC format (e.g. `2023-11-08 16:43:44.204Z`) |
| `utcDateModified` | Text | Non-null |  | Modification date in UTC format (e.g. `2023-11-08 16:43:44.204Z`) |
| `isDeleted` | Integer | Non-null | 0 | `1` if the entity is [deleted](../../../Concepts/Deleted%20notes.md), `0` otherwise. |