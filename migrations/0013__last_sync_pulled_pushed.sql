UPDATE options SET opt_name = 'last_synced_pull' WHERE opt_name = 'last_synced';

INSERT INTO options (opt_name, opt_value) VALUES ('last_synced_push', 0);