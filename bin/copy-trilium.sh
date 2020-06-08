#!/usr/bin/env bash

if [[ $# -eq 0 ]] ; then
    echo "Missing argument of target directory"
    exit 1
fi

npm run webpack

DIR=$1

rm -rf $DIR
mkdir $DIR

echo "Copying Trilium to build directory $DIR"

cp -r images $DIR/
cp -r libraries $DIR/
cp -r src $DIR/
cp -r db $DIR/
cp -r package.json $DIR/
cp -r package-lock.json $DIR/
cp -r README.md $DIR/
cp -r LICENSE $DIR/
cp -r config-sample.ini $DIR/
cp -r electron.js $DIR/
cp webpack-* $DIR/

# run in subshell (so we return to original dir)
(cd $DIR && npm install --only=prod)

find $DIR/libraries -name "*.map" -type f -delete

rm -r $DIR/src/public/app

rm -r $DIR/node_modules/sqlite3/build
rm -r $DIR/node_modules/sqlite3/deps

sed -i -e 's/app\/desktop.js/app-dist\/desktop.js/g' $DIR/src/views/desktop.ejs
sed -i -e 's/app\/mobile.js/app-dist\/mobile.js/g' $DIR/src/views/mobile.ejs
sed -i -e 's/app\/setup.js/app-dist\/setup.js/g' $DIR/src/views/setup.ejs
