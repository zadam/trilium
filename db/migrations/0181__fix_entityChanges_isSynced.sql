UPDATE entity_changes SET isSynced = COALESCE((
    SELECT options.isSynced
    FROM options
    WHERE options.name = entity_changes.entityId
), 0) WHERE entityName = 'options';
