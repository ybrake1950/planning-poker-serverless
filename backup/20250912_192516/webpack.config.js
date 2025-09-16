// client/webpack.config.js
// Webpack configuration with Babel support for Planning Poker client

const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = {
  // Entry point - main JavaScript file
  entry: './src/app.js',
  
  // Output configuration
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    clean: true, // Clean dist folder before each build
    publicPath: '/'
  },
  
  // Development server configuration
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    port: 8080, // Changed from 3000 to avoid conflict
    open: true,
    hot: true,
    historyApiFallback: true, // Support for client-side routing
    // Allow connections from any host (needed for serverless dev)
    allowedHosts: 'all',
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
    }
  },
  
  // Plugins
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html',
      inject: true // Inject bundle script into HTML
    })
  ],
  
  // Module rules for different file types
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  browsers: ['> 1%', 'last 2 versions']
                }
              }]
            ]
          }
        }
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource'
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource'
      }
    ]
  },
  
  // Resolve configuration
  resolve: {
    extensions: ['.js', '.json'],
    modules: ['node_modules']
  },
  
  // Development tool for debugging
  devtool: 'eval-source-map',
  
  // Mode
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development'
};
