module.exports = function(api) {
  const isTest = api.env('test');
  
  if (!isTest) {
    return {
      presets: ['next/babel'],
    };
  }
  
  return {
    presets: [
      ['@babel/preset-env', { targets: { node: 'current' } }],
      '@babel/preset-typescript',
    ],
  };
};