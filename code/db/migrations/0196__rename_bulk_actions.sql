UPDATE attributes SET value = replace(value, 'setLabelValue', 'updateLabelValue') WHERE name = 'action' AND type = 'label';
UPDATE attributes SET value = replace(value, 'setRelationTarget', 'updateRelationTarget') WHERE name = 'action' AND type = 'label';
