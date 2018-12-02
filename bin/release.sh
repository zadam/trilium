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

git add package.json

echo 'module.exports = { buildDate:"'`date --iso-8601=seconds`'", buildRevision: "'`git log -1 --format="%H"`'" };' > src/services/build.js

git add src/services/build.js

TAG=v$VERSION

echo "Committing package.json version change"

git commit -m "release $VERSION"
git push

echo "Tagging commit with $TAG"

git tag $TAG
git push origin $TAG

bin/build.sh

LINUX_X64_BUILD=trilium-linux-x64-$VERSION.7z
LINUX_IA32_BUILD=trilium-linux-ia32-$VERSION.7z
WINDOWS_X64_BUILD=trilium-windows-x64-$VERSION.7z
MAC_X64_BUILD=trilium-mac-x64-$VERSION.7z
SERVER_BUILD=trilium-linux-x64-server-$VERSION.7z

echo "Creating release in GitHub"

EXTRA=

if [[ $TAG == *"beta"* ]]; then
  EXTRA=--pre-release
fi

github-release release \
    --tag $TAG \
    --name "$TAG release" $EXTRA

echo "Uploading linux x64 build"

github-release upload \
    --tag $TAG \
    --name "$LINUX_X64_BUILD" \
    --file "dist/$LINUX_X64_BUILD"

echo "Uploading linux ia32 build"

github-release upload \
    --tag $TAG \
    --name "$LINUX_IA32_BUILD" \
    --file "dist/$LINUX_IA32_BUILD"

echo "Uploading windows x64 build"

github-release upload \
    --tag $TAG \
    --name "$WINDOWS_X64_BUILD" \
    --file "dist/$WINDOWS_X64_BUILD"

echo "Uploading mac x64 build"

github-release upload \
    --tag $TAG \
    --name "$MAC_X64_BUILD" \
    --file "dist/$MAC_X64_BUILD"

echo "Uploading linux x64 server build"

github-release upload \
    --tag $TAG \
    --name "$SERVER_BUILD" \
    --file "dist/$SERVER_BUILD"

echo "Building docker image"

bin/build-docker.sh $VERSION

echo "Pushing docker image to dockerhub"

bin/push-docker-image.sh $VERSION

echo "Release finished!"