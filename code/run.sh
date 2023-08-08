SOURCE="$(dirname "$(readlink -f "$0")")"

TRILIUM_DATA_DIR="$SOURCE/db-data" bash -c "npm run start-server-no-dir"

