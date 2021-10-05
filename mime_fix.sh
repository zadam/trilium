#!/bin/bash
# Version 4.2: Reduced language list + `c++` fix
while read p; 
	do 
		# Grab original definition from list
		hljs_alias=$(echo $p | cut -d "," -f2)
		# Grab new alias from list
		trilium_mime_def=$(echo $p | cut -d "," -f3)
		payload=$(echo $trilium_mime_def | cut -d "/" -f1)
		payload+="\\"
		payload+="/"
		payload+=$(echo $trilium_mime_def | cut -d "/" -f2)
		echo "Trying to fix $trilium_mime_def"
		grep -rl $trilium_mime_def ./trilium | xargs sed -i "s+$payload+$hljs_alias+g"
	done < mime_types_trilium_shortlist.txt
