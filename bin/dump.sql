.mode insert branches
.out db/main_branches.sql
select * from branches;

.mode insert notes
.out db/main_notes.sql
select * from notes;

.mode insert images
.out db/main_images.sql
select * from images;

.mode insert note_images
.out db/main_note_images.sql
select * from note_images;