const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: {
      contentScript: './src/contentScript/index.ts',
      popup: './src/popup/index.ts',
      options: './src/options/index.ts',
      background: './src/background/index.ts',
      history: './src/history/index.ts',
      'offscreen/audio': './src/offscreen/audio.ts'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader'
          ]
        }
      ]
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@popup': path.resolve(__dirname, 'src/popup'),
        '@options': path.resolve(__dirname, 'src/options'),
        '@contentScript': path.resolve(__dirname, 'src/contentScript'),
        '@background': path.resolve(__dirname, 'src/background'),
        '@history': path.resolve(__dirname, 'src/history')
      }
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: '[name].css'
      }),
      new HtmlWebpackPlugin({
        template: './src/popup/popup.html',
        filename: 'popup.html',
        chunks: ['popup']
      }),
      new HtmlWebpackPlugin({
        template: './src/options/options.html',
        filename: 'options.html',
        chunks: ['options']
      }),
      new HtmlWebpackPlugin({
        template: './src/history/history.html',
        filename: 'history.html',
        chunks: ['history']
      }),
      new HtmlWebpackPlugin({
        template: './src/offscreen/audio.html',
        filename: 'offscreen/audio.html',
        chunks: ['offscreen/audio']
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'manifest.json', to: 'manifest.json' },
          { 
            from: 'icons', 
            to: 'icons', 
            noErrorOnMissing: true,
            globOptions: { 
              ignore: ['**/iconRaw.png'] 
            }
          },
          { 
            from: 'sounds', 
            to: 'sounds', 
            noErrorOnMissing: true
          },
          { from: 'readme.md', to: 'readme.md' },
          { from: 'src/shared', to: 'shared', globOptions: { ignore: ['**/*.ts'] } }
        ]
      })
    ],
    devtool: isProduction ? 'source-map' : 'inline-source-map',
    optimization: {
      // Disable all code splitting to ensure each entry point is self-contained
      splitChunks: {
        chunks: () => false
      }
    }
  };
};