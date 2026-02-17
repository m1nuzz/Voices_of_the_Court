
const path = require('path');

module.exports = {
  packagerConfig: {
     executableName: 'voices-of-the-court',
     icon: path.join(__dirname, 'build', 'icons', 'icon'),
    //"asar":true
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: { 
        loadingGif: path.join(__dirname, 'build', 'icons', 'installerPic.png'),
        name: 'voices_of_the_court_setup'
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux', 'win32']
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          bin: 'voices-of-the-court'
        }
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          bin: 'voices-of-the-court'
        }
      },
    },
  ],
  hooks: {
    

  }


};
