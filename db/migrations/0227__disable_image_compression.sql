-- emergency disabling of image compression since it appears to make problems in migration to 0.61
UPDATE options SET value = 'false' WHERE name = 'compressImages';
