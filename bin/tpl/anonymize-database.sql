
UPDATE etapi_tokens SET tokenHash = 'API token hash value';
UPDATE notes SET title = 'title' WHERE title NOT IN ('root', 'hidden', 'share');
UPDATE note_contents SET content = 'text' WHERE content IS NOT NULL;
UPDATE note_revisions SET title = 'title';
UPDATE note_revision_contents SET content = 'text' WHERE content IS NOT NULL;

UPDATE attributes SET name = 'name', value = 'value' WHERE type = 'label' AND name NOT IN('inbox', 'disableVersioning', 'calendarRoot', 'archived', 'excludeFromExport', 'disableInclusion', 'appCss', 'appTheme', 'hidePromotedAttributes', 'readOnly', 'autoReadOnlyDisabled', 'hoistedCssClass', 'cssClass', 'iconClass', 'keyboardShortcut', 'run', 'runOnInstance', 'runAtHour', 'customRequestHandler', 'customResourceProvider', 'widget', 'noteInfoWidgetDisabled', 'linkMapWidgetDisabled', 'noteRevisionsWidgetDisabled', 'whatLinksHereWidgetDisabled', 'similarNotesWidgetDisabled', 'workspace', 'workspaceIconClass', 'workspaceTabBackgroundColor', 'searchHome', 'hoistedInbox', 'hoistedSearchHome', 'sqlConsoleHome', 'datePattern', 'pageSize', 'viewType', 'mapRootNoteId', 'bookmarked', 'bookmarkFolder', 'sorted', 'top', 'fullContentWidth', 'shareHiddenFromTree', 'shareAlias', 'shareOmitDefaultCss', 'shareRoot', 'shareDescription', 'internalLink', 'imageLink', 'relationMapLink', 'includeMapLink', 'runOnNoteCreation', 'runOnNoteTitleChange', 'runOnNoteChange', 'runOnChildNoteCreation', 'runOnAttributeCreation', 'runOnAttributeChange', 'template', 'widget', 'renderNote', 'shareCss', 'shareJs', 'shareFavicon');
UPDATE attributes SET name = 'name' WHERE type = 'relation' AND name NOT IN ('inbox', 'disableVersioning', 'calendarRoot', 'archived', 'excludeFromExport', 'disableInclusion', 'appCss', 'appTheme', 'hidePromotedAttributes', 'readOnly', 'autoReadOnlyDisabled', 'hoistedCssClass', 'cssClass', 'iconClass', 'keyboardShortcut', 'run', 'runOnInstance', 'runAtHour', 'customRequestHandler', 'customResourceProvider', 'widget', 'noteInfoWidgetDisabled', 'linkMapWidgetDisabled', 'noteRevisionsWidgetDisabled', 'whatLinksHereWidgetDisabled', 'similarNotesWidgetDisabled', 'workspace', 'workspaceIconClass', 'workspaceTabBackgroundColor', 'searchHome', 'hoistedInbox', 'hoistedSearchHome', 'sqlConsoleHome', 'datePattern', 'pageSize', 'viewType', 'mapRootNoteId', 'bookmarked', 'bookmarkFolder', 'sorted', 'top', 'fullContentWidth', 'shareHiddenFromTree', 'shareAlias', 'shareOmitDefaultCss', 'shareRoot', 'shareDescription', 'internalLink', 'imageLink', 'relationMapLink', 'includeMapLink', 'runOnNoteCreation', 'runOnNoteTitleChange', 'runOnNoteChange', 'runOnChildNoteCreation', 'runOnAttributeCreation', 'runOnAttributeChange', 'template', 'widget', 'renderNote', 'shareCss', 'shareJs', 'shareFavicon');
UPDATE branches SET prefix = 'prefix' WHERE prefix IS NOT NULL AND prefix != 'recovered';
UPDATE options SET value = 'anonymized' WHERE name IN
                    ('documentId', 'documentSecret', 'encryptedDataKey', 
                     'passwordVerificationHash', 'passwordVerificationSalt', 
                     'passwordDerivedKeySalt', 'username', 'syncServerHost', 'syncProxy') 
                      AND value != '';

VACUUM;
