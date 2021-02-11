UPDATE entity_changes SET isSynced = (
    SELECT options.isSynced
    FROM options
    WHERE options.name = entity_changes.entityId
) WHERE entityName = 'options';
