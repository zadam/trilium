UPDATE branches SET branchId = 'hidden' where branchId = (
    SELECT branchId FROM branches
    WHERE parentNoteId = 'root'
      AND noteId = 'hidden'
      AND isDeleted = 0
    ORDER BY utcDateModified
    LIMIT 1
);
