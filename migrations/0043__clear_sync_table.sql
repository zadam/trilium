DELETE FROM sync;

UPDATE options SET opt_value = 0 WHERE opt_name IN ('last_synced_push', 'last_synced_pull');