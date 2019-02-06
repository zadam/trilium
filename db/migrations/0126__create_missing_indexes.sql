CREATE INDEX `IDX_attributes_noteId` ON `attributes` (`noteId`);
CREATE INDEX `IDX_attributes_name` ON `attributes` (`name`);
CREATE INDEX `IDX_attributes_value` ON `attributes` (`value`);

CREATE INDEX `IDX_event_log_noteId` ON `event_log` (`noteId`);

CREATE INDEX `IDX_links_noteId` ON `links` (`noteId`);
CREATE INDEX `IDX_links_targetNoteId` ON `links` (`targetNoteId`);
