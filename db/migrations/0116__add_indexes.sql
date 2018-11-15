create index IDX_links_noteId_index
  on links (noteId);

create index IDX_links_targetNoteId_index
  on links (targetNoteId);

create index IDX_attributes_name_index
  on attributes (name);

create index IDX_attributes_noteId_index
  on attributes (noteId);

create index IDX_attributes_value_index
  on attributes (value);
