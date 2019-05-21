drop table recent_notes;

create table recent_notes
(
    noteId TEXT not null primary key,
    notePath TEXT not null,
    hash TEXT default "" not null,
    utcDateCreated TEXT not null,
    isDeleted INT
);

delete from sync where entityName = 'recent_notes';