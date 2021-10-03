#!/bin/bash
# v0.1 build.sh script for building a syntax highlighting compatible version of trilium
# Downloads all the sources required for syntax highlighting
# Integrates the syntax highlighter module into ckeditor5
# Integrates the custom ckeditor5 into trilium

# TO-DO:
# Tidy up directory switching (save original dir on startup)

# Download the latest release of trilium
echo "Cloning trilium..."
#git clone https://github.com/zadam/trilium.git

# Download trilium-ckeditor5
echo "Cloning trilium-ckeditor5..."
#git clone https://github.com/zadam/trilium-ckeditor5.git

# Download ckeditor5-code-block
echo "Cloning ckeditor5-CodeBlock-With-Syntax-Highlight..."
#git clone https://github.com/regischen/CKEditor5-CodeBlock-With-Syntax-Highlight.git

# Build a vanilla test ckeditor5
echo "Stepping into trilium-ckeditor5 balloon-block"
cd trilium-ckeditor5/packages/ckeditor5-build-balloon-block

# Confirm build works by opening sample/index.html (after building)
echo "Trying to perform a base install"
npm install
npm run build

# Place syntax-highlight module files in node_modules
echo "Going back to root directory and copying syntax highlighter module into src"
cd ../../../
cp CKEditor5-CodeBlock-With-Syntax-Highlight/src/* trilium-ckeditor5/packages/ckeditor5-build-balloon-block/node_modules/@ckeditor/ckeditor5-code-block/src

# Re-build the editor with highlighting enabled
echo "Re-Building trilium-ckeditor5 with the highlighter module"
cd trilium-ckeditor5/packages/ckeditor5-build-balloon-block
rm -rf node_modules/@ckeditor/ckeditor5-mention
cp -r ../ckeditor5-mention node_modules/@ckeditor/
npm install highlight.js
npm run build
# Confirm build works by opening sample/index.html (after building)

# On TRILIUM
echo "Stepping into trilium source and installing highlight.js"
cd ../../../trilium
echo "Switching to stable branch"
git checkout stable
npm install
# Confirm trilium build is working without syntax highlighting
#npm run start server

# Integrate custom ckeditor into trilium:
cd ../
echo "Integrating the modified ckeditor into trilium"
cd trilium-ckeditor5/packages/ckeditor5-build-balloon-block
sed -i -e 's/sourceMappingURL=ckeditor.js.map/sourceMappingURL=libraries\/ckeditor\/ckeditor.js.map/g' build/ckeditor.js
cp build/ckeditor.* ../../../trilium/libraries/ckeditor
cp node_modules/@ckeditor/ckeditor5-inspector/build/inspector.js ../../../trilium/libraries/ckeditor

# Fixing mime types for a couple examples
# plaintext, c, php, python
echo "Running mime_fix.sh"
cd ../../../
./mime_fix.sh

echo "All done! Try running trilium from the trilium folder using `npm run start-server`"