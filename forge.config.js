module.exports = {
  packagerConfig: {
    asar: true,
    // icon will break once we add .dmg support, since the .ico & .icns have to be in same dir (see https://www.electronforge.io/guides/create-and-add-icons#windows-and-macos)
    icon: "./images/app-icons/win/icon"
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        setupIcon: "./images/app-icons/win/icon.ico",
        loadingGif: "./images/app-icons/win/setup-banner.gif"
      }
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
  ],
};
