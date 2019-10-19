CREATE TABLE IF NOT EXISTS "mig_branches" (
                                          `branchId`	TEXT NOT NULL,
                                          `noteId`	TEXT NOT NULL,
                                          `parentNoteId`	TEXT NOT NULL,
                                          `notePosition`	INTEGER NOT NULL,
                                          `prefix`	TEXT,
                                          `isExpanded`	INTEGER NOT NULL DEFAULT 0,
                                          `isDeleted`	INTEGER NOT NULL DEFAULT 0,
                                          `utcDateModified`	TEXT NOT NULL,
                                          utcDateCreated TEXT NOT NULL,
                                          hash TEXT DEFAULT "" NOT NULL,
                                          PRIMARY KEY(`branchId`));

INSERT INTO mig_branches (branchId, noteId, parentNoteId, notePosition, prefix, isExpanded, isDeleted, utcDateModified, utcDateCreated, hash)
SELECT branchId, noteId, parentNoteId, notePosition, prefix, COALESCE(isExpanded, 0), isDeleted, utcDateModified, utcDateCreated, hash FROM branches;

DROP TABLE branches;
ALTER TABLE mig_branches RENAME TO branches;

CREATE INDEX `IDX_branches_noteId` ON `branches` (`noteId`);
CREATE INDEX `IDX_branches_noteId_parentNoteId` ON `branches` (`noteId`,`parentNoteId`);
CREATE INDEX IDX_branches_parentNoteId ON branches (parentNoteId);