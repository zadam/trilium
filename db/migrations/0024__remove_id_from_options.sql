CREATE TABLE `options_mig` (
	`opt_name`	TEXT NOT NULL PRIMARY KEY,
	`opt_value`	TEXT,
	`date_modified` INT
);

INSERT INTO options_mig (opt_name, opt_value, date_modified)
    SELECT opt_name, opt_value, date_modified FROM options;

DROP TABLE options;
ALTER TABLE options_mig RENAME TO options;
