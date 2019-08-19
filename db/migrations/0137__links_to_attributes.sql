UPDATE links SET type = 'internal-link' WHERE type = 'hyper';
UPDATE links SET type = 'image-link' WHERE type = 'image';
UPDATE links SET type = 'relation-map-link' WHERE type = 'relation-map';

INSERT INTO attributes (attributeId, noteId, type, name, value, position, utcDateCreated, utcDateModified, isDeleted, hash, isInheritable)
SELECT linkId, noteId, 'relation', type, targetNoteId, 0, utcDateCreated, utcDateModified, isDeleted, hash, 0 FROM links;

UPDATE sync SET entityName = 'attributes' WHERE entityName = 'links';

DROP TABLE links;