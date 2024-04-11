#!/usr/bin/env bash

cloc HEAD \
    --git --md \
    --include-lang=javascript,typescript \
    --found=filelist.txt \
    --exclude-dir=public,libraries,views,docs

grep -R \.js$ filelist.txt
rm filelist.txt