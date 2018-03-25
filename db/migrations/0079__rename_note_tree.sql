CREATE TABLE "branches" (
  `branchId`	TEXT NOT NULL,
  `noteId`	TEXT NOT NULL,
  `parentNoteId`	TEXT NOT NULL,
  `notePosition`	INTEGER NOT NULL,
  `prefix`	TEXT,
  `isExpanded`	BOOLEAN,
  `isDeleted`	INTEGER NOT NULL DEFAULT 0,
  `dateModified`	TEXT NOT NULL,
  PRIMARY KEY(`branchId`)
);

INSERT INTO branches (branchId, noteId, parentNoteId, notePosition, prefix, isExpanded, isDeleted, dateModified)
    SELECT noteTreeId, noteId, parentNoteId, notePosition, prefix, isExpanded, isDeleted, dateModified FROM note_tree;

DROP TABLE note_tree;

CREATE INDEX `IDX_branches_noteId` ON `branches` (
  `noteId`
);

CREATE INDEX `IDX_branches_noteId_parentNoteId` ON `branches` (
  `noteId`,
  `parentNoteId`
);

CREATE TABLE `recent_notes_mig` (
  `branchId` TEXT NOT NULL PRIMARY KEY,
  `notePath` TEXT NOT NULL,
  `dateAccessed` TEXT NOT NULL,
  isDeleted INT
);

INSERT INTO recent_notes_mig (branchId, notePath, dateAccessed, isDeleted)
    SELECT noteTreeId, notePath, dateAccessed, isDeleted FROM recent_notes;

DROP TABLE recent_notes;
ALTER TABLE recent_notes_mig RENAME TO recent_notes;