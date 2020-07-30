UPDATE sync SET isSynced = 1 WHERE entityName != 'options' OR (
        entityName = 'options'
        AND 1 = (SELECT isSynced FROM options WHERE name = sync.entityId)
    )
