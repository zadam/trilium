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
  EXTRA=--prerelease
fi

echo "$GITHUB_CLI_AUTH_TOKEN" | gh auth login --with-token

gh release create "$TAG" \
    --title "$TAG release" \
    --notes "" \
    $EXTRA \
    "dist/$DEBIAN_X64_BUILD" \
    "dist/$LINUX_X64_BUILD" \
    "dist/$WINDOWS_X64_BUILD" \
    "dist/$MAC_X64_BUILD" \
    "dist/$SERVER_BUILD"
