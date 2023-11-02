UPDATE etapi_tokens SET tokenHash = 'API token hash value';
UPDATE notes SET title = 'title'
             WHERE noteId NOT IN ('root', '_hidden', '_share')
               AND SUBSTR(noteId, 1, 8) != '_options'
               AND SUBSTR(noteId, 1, 3) != '_lb';
UPDATE blobs SET content = 'text' WHERE content IS NOT NULL;
UPDATE revisions SET title = 'title';

UPDATE attributes SET name  = 'name', value = 'value' WHERE type = 'label'
  AND name NOT IN
      ('inbox', 'disableVersioning', 'calendarRoot', 'archived', 'excludeFromExport', 'disableInclusion', 'appCss',
       'appTheme', 'hidePromotedAttributes', 'readOnly', 'autoReadOnlyDisabled', 'cssClass', 'iconClass',
       'keyboardShortcut', 'run', 'runOnInstance', 'runAtHour', 'customRequestHandler', 'customResourceProvider',
       'widget', 'noteInfoWidgetDisabled', 'linkMapWidgetDisabled', 'revisionsWidgetDisabled',
       'whatLinksHereWidgetDisabled', 'similarNotesWidgetDisabled', 'workspace', 'workspaceIconClass',
       'workspaceTabBackgroundColor', 'workspaceCalendarRoot', 'workspaceTemplate', 'searchHome', 'workspaceInbox',
       'workspaceSearchHome', 'sqlConsoleHome', 'datePattern', 'pageSize', 'viewType', 'mapRootNoteId',
       'bookmarkFolder', 'sorted', 'sortDirection', 'sortFoldersFirst', 'sortNatural', 'sortLocale', 'top',
       'fullContentWidth', 'shareHiddenFromTree', 'shareExternalLink', 'shareOmitDefaultCss', 'shareRoot', 'shareDescription',
       'shareRaw', 'shareDisallowRobotIndexing', 'shareIndex', 'displayRelations', 'hideRelations', 'titleTemplate',
       'template', 'toc', 'color', 'keepCurrentHoisting', 'executeButton', 'executeDescription', 'newNotesOnTop',
       'clipperInbox', 'internalLink', 'imageLink', 'relationMapLink', 'includeMapLink', 'runOnNoteCreation',
       'runOnNoteTitleChange', 'runOnNoteChange', 'runOnNoteContentChange', 'runOnNoteDeletion', 'runOnBranchCreation', 'runOnBranchChange',
       'runOnBranchDeletion', 'runOnChildNoteCreation', 'runOnAttributeCreation', 'runOnAttributeChange', 'template',
       'inherit', 'widget', 'renderNote', 'shareCss', 'shareJs', 'shareTemplate', 'shareFavicon');
UPDATE attributes SET name = 'name' WHERE type = 'relation'
  AND name NOT IN
      ('inbox', 'disableVersioning', 'calendarRoot', 'archived', 'excludeFromExport', 'disableInclusion', 'appCss',
       'appTheme', 'hidePromotedAttributes', 'readOnly', 'autoReadOnlyDisabled', 'cssClass', 'iconClass',
       'keyboardShortcut', 'run', 'runOnInstance', 'runAtHour', 'customRequestHandler', 'customResourceProvider',
       'widget', 'noteInfoWidgetDisabled', 'linkMapWidgetDisabled', 'revisionsWidgetDisabled',
       'whatLinksHereWidgetDisabled', 'similarNotesWidgetDisabled', 'workspace', 'workspaceIconClass',
       'workspaceTabBackgroundColor', 'workspaceCalendarRoot', 'workspaceTemplate', 'searchHome', 'workspaceInbox',
       'workspaceSearchHome', 'sqlConsoleHome', 'datePattern', 'pageSize', 'viewType', 'mapRootNoteId',
       'bookmarkFolder', 'sorted', 'sortDirection', 'sortFoldersFirst', 'sortNatural', 'sortLocale', 'top',
       'fullContentWidth', 'shareHiddenFromTree', 'shareExternalLink', 'shareOmitDefaultCss', 'shareRoot', 'shareDescription',
       'shareRaw', 'shareDisallowRobotIndexing', 'shareIndex', 'displayRelations', 'hideRelations', 'titleTemplate',
       'template', 'toc', 'color', 'keepCurrentHoisting', 'executeButton', 'executeDescription', 'newNotesOnTop',
       'clipperInbox', 'internalLink', 'imageLink', 'relationMapLink', 'includeMapLink', 'runOnNoteCreation',
       'runOnNoteTitleChange', 'runOnNoteChange', 'runOnNoteContentChange', 'runOnNoteDeletion', 'runOnBranchCreation', 'runOnBranchChange',
       'runOnBranchDeletion', 'runOnChildNoteCreation', 'runOnAttributeCreation', 'runOnAttributeChange', 'template',
       'inherit', 'widget', 'renderNote', 'shareCss', 'shareJs', 'shareTemplate', 'shareFavicon');
UPDATE branches SET prefix = 'prefix' WHERE prefix IS NOT NULL AND prefix != 'recovered';
UPDATE options SET value = 'anonymized' WHERE name IN
      ('documentId', 'documentSecret', 'encryptedDataKey',
       'passwordVerificationHash', 'passwordVerificationSalt',
       'passwordDerivedKeySalt', 'username', 'syncServerHost', 'syncProxy')
  AND value != '';

VACUUM;
