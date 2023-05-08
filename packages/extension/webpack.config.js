/* eslint-disable @typescript-eslint/no-var-requires */
const webpack = require("webpack");
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
const fs = require("fs");

const isEnvDevelopment = process.env.NODE_ENV !== "production";
const isDisableSplitChunks = process.env.DISABLE_SPLIT_CHUNKS === "true";
const isEnvAnalyzer = process.env.ANALYZER === "true";
const commonResolve = (dir) => ({
  extensions: [".ts", ".tsx", ".js", ".jsx"],
  alias: {
    assets: path.resolve(__dirname, dir),
  },
});
const altResolve = () => {
  const p = path.resolve(__dirname, "./src/keplr-wallet-private/index.ts");

  if (fs.existsSync(p)) {
    return {
      alias: {
        "keplr-wallet-private": path.resolve(
          __dirname,
          "./src/keplr-wallet-private/index.ts"
        ),
      },
    };
  }

  return {};
};
const tsRule = { test: /\.tsx?$/, loader: "ts-loader" };
const fileRule = {
  test: /\.(svg|png|mp4|jpe?g|gif|woff|woff2|eot|ttf)$/i,
  type: "asset/resource",
  generator: {
    filename: "assets/[name][ext]",
  },
};

module.exports = {
  name: "extension",
  mode: isEnvDevelopment ? "development" : "production",
  // In development environment, turn on source map.
  devtool: isEnvDevelopment ? "cheap-source-map" : false,
  // In development environment, webpack watch the file changes, and recompile
  watch: isEnvDevelopment,
  entry: {
    popup: ["./src/index.tsx"],
    register: ["./src/register.tsx"],
    background: ["./src/background/background.ts"],
    contentScripts: ["./src/content-scripts/content-scripts.ts"],
    injectedScript: ["./src/content-scripts/inject/injected-script.ts"],
  },
  output: {
    path: path.resolve(__dirname, isEnvDevelopment ? "dist" : "build/chrome"),
    filename: "[name].bundle.js",
  },
  optimization: {
    splitChunks: {
      chunks(chunk) {
        if (isDisableSplitChunks) {
          return false;
        }

        return chunk.name === "popup" || chunk.name === "register";
      },
      cacheGroups: {
        popup: {
          maxSize: 3_000_000,
        },
      },
    },
  },
  resolve: {
    ...commonResolve("src/public/assets"),
    ...altResolve(),
    fallback: {
      os: require.resolve("os-browserify/browser"),
      buffer: require.resolve("buffer/"),
      http: require.resolve("stream-http"),
      https: require.resolve("https-browserify"),
      crypto: require.resolve("crypto-browserify"),
      stream: require.resolve("stream-browserify"),
      process: require.resolve("process/browser"),
    },
  },
  module: {
    rules: [
      tsRule,
      fileRule,
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false,
        },
      },
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: "process/browser",
      Buffer: ["buffer", "Buffer"],
    }),
    new webpack.EnvironmentPlugin({
      NODE_ENV: isEnvDevelopment ? "development" : "production",
      // XXX: SC_DISABLE_SPEEDY is used for force enabling speedy mode for styled-components.
      //      According to the document, styled-components injects stylings to <style /> tag for each class name if development mode.
      //      However, on production mode, it injects stylings by using CSSOM.
      //      Probably, if development mode, this difference makes the blinking styling for transition components which changes the styling by JS code.
      //      At present, rather than fixing this for development mode, We fix this by forcing cssom to be enabled, and will fix this later when we have time.
      SC_DISABLE_SPEEDY: false,
      KEPLR_EXT_ETHEREUM_ENDPOINT: "",
      KEPLR_EXT_AMPLITUDE_API_KEY: "",
    }),
    new ForkTsCheckerWebpackPlugin(),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "./src/manifest.json",
          to: "./",
        },
        {
          from: "../../node_modules/webextension-polyfill/dist/browser-polyfill.js",
          to: "./",
        },
      ],
    }),
    new HtmlWebpackPlugin({
      template: "./src/index.html",
      filename: "popup.html",
      chunks: ["popup"],
    }),
    new HtmlWebpackPlugin({
      template: "./src/index.html",
      filename: "register.html",
      chunks: ["register"],
    }),
    new BundleAnalyzerPlugin({
      analyzerMode: isEnvAnalyzer ? "server" : "disabled",
    }),
  ],
};
