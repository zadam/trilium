#!/usr/bin/env bash

export GITHUB_REPO=trilium

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

LINUX_X64_BUILD=trilium-linux-x64-$VERSION.tar.xz
DEBIAN_X64_BUILD=trilium_${VERSION}_amd64.deb
WINDOWS_X64_BUILD=trilium-windows-x64-$VERSION.zip
MAC_X64_BUILD=trilium-mac-x64-$VERSION.zip
SERVER_BUILD=trilium-linux-x64-server-$VERSION.tar.xz

echo "Creating release in GitHub"

EXTRA=

if [[ $TAG == *"beta"* ]]; then
  EXTRA=--pre-release
fi

github-release release \
    --tag $TAG \
    --name "$TAG release" $EXTRA

echo "Uploading debian x64 package"

github-release upload \
    --tag $TAG \
    --name "$DEBIAN_X64_BUILD" \
    --file "dist/$DEBIAN_X64_BUILD"

echo "Uploading linux x64 build"

github-release upload \
    --tag $TAG \
    --name "$LINUX_X64_BUILD" \
    --file "dist/$LINUX_X64_BUILD"

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