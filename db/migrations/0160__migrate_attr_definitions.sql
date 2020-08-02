UPDATE attributes SET type = 'label', name = 'label:' || name WHERE type = 'label-definition';
UPDATE attributes SET type = 'label', name = 'relation:' || name WHERE type = 'relation-definition';
