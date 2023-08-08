SOURCE="$(dirname "$(readlink -f "$0")")"

file_name="backup_$(date '+%Y-%m-%d_%H').zip"
zip -r $file_name "$SOURCE/../data/data"
mv $file_name "$SOURCE/../data/backups/"