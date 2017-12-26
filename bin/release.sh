#!/usr/bin/env bash

if [[ $# -eq 0 ]] ; then
    echo "Missing argument of new version"
    exit 1
fi

VERSION=$1

if ! [[ ${VERSION} =~ ^[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{1,2}(-.+)?$ ]] ;
then
    echo "Version ${VERSION} isn't in format X.Y.Z"
    exit 1
fi

if ! git diff-index --quiet HEAD --; then
    echo "There are uncommitted changes"
    exit 1
fi

echo "Releasing Trilium $VERSION"

jq '.version = "'$VERSION'"' package.json|sponge package.json

echo 'module.exports = { build_date:"'`date --iso-8601=seconds`'", build_revision: "'`git log -1 --format="%H"`'" };' > services/build.js

TAG=v$VERSION

echo "Committing package.json version change"

git commit -m "release $VERSION"
git push

echo "Tagging commit with $TAG"

git tag $TAG
git push origin $TAG

bin/build.sh

bin/package.sh

LINUX_BUILD=trilium-linux-$VERSION.7z
WINDOWS_BUILD=trilium-windows-$VERSION.7z

echo "Creating release in GitHub"

github-release release \
    --tag $TAG \
    --name "$TAG release"

echo "Uploading linux build"

github-release upload \
    --tag $TAG \
    --name "$LINUX_BUILD" \
    --file "dist/$LINUX_BUILD"

echo "Uploading windows build"

github-release upload \
    --tag $TAG \
    --name "$WINDOWS_BUILD" \
    --file "dist/$WINDOWS_BUILD"

echo "Release finished!"