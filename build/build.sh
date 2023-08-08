CURRENT_DIR="$(pwd)"

SOURCE="$(dirname "$(readlink -f "$0")")"

cd "$SOURCE"

docker build --no-cache -t note_server_bhead .
#docker build -t note_server_bhead .

cd "$CURRENT_DIR"