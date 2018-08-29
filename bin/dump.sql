.mode insert branches
.out db/main_branches.sql
select * from branches where isDeleted = 0;

.mode insert notes
.out db/main_notes.sql
select * from notes where isDeleted = 0;

.mode insert images
.out db/main_images.sql
select * from images where isDeleted = 0;

.mode insert note_images
.out db/main_note_images.sql
select * from note_images where isDeleted = 0;

.mode insert attributes
.out db/main_attributes.sql
select * from attributes where isDeleted = 0;