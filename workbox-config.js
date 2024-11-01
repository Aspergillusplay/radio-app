module.exports = {
  globDirectory: 'build/',
  globPatterns: [
    '**/*.{html,js,css,png,jpg,svg,json,tsx,ts,jsx}',
  ],
  globIgnores: [
    'sw.js',
  ],
  swDest: 'build/sw.js',
};