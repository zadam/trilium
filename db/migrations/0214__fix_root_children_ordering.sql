UPDATE branches SET notePosition = notePosition - 999899999 WHERE parentNoteId = 'root' AND notePosition > 999999999;
