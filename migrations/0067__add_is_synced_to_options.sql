ALTER TABLE options ADD COLUMN is_synced INTEGER NOT NULL DEFAULT 0;

UPDATE options SET is_synced = 1 WHERE opt_name IN ('username', 'password_verification_hash', 'password_verification_salt',
                                                    'password_derived_key_salt', 'encrypted_data_key', 'encrypted_data_key_iv',
                                                    'protected_session_timeout', 'history_snapshot_time_interval');