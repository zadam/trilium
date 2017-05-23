### Creating Custom Skins

1. Create a folder like this (recommended name: 'src/skin-custom-...')
2. For a start copy files from one of the existing skin folders (src/skin-...) 
   to the custom folder:
   - ui.fancytree.less  (required)
   - icons.gif (if needed)
   - loading.gif (if needed)
3. cd to your fancytree folder and run `grunt dev` from the connsole.<br>
   Note: NPM and Grunt are required. 
   Read [how to install the toolset](https://github.com/mar10/fancytree/wiki/HowtoContribute#install-the-source-code-and-tools-for-debugging-and-contributing).
4. Edit and save your ui.fancytree.less file.<br>
   The `ui.fancytree.css` will be generated and updated automatically from 
   the LESS file.
