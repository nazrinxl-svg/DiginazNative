require('dotenv').config({path: '.env'});

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['transform-inline-environment-variables'],
};
