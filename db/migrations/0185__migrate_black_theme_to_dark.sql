-- black theme has been removed, dark is closest replacement
UPDATE options SET value = 'dark' WHERE name = 'theme' AND value = 'black';

UPDATE options SET value = 'light' WHERE name = 'theme' AND value = 'white';
