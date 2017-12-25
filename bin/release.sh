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

jq '.version = "$VERSION"' package.json|sponge package.json

TAG=v$VERSION

git commit -m "$VERSION"
git push

git tag $TAG
git push origin $TAG

echo "Releasing Trilium $VERSION"

build

package

LINUX_BUILD=trilium-linux-$VERSION.7z
WINDOWS_BUILD=trilium-windows-$VERSION.7z

github-release release \
    --tag $TAG \
    --name "$TAG release"

github-release upload \
    --tag $TAG \
    --name "$LINUX_BUILD" \
    --file "dist/$LINUX_BUILD"

github-release upload \
    --tag $TAG \
    --name "$WINDOWS_BUILD" \
    --file "dist/$WINDOWS_BUILD"