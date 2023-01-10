# Cloud LaTeX CLI

**CLI interface is under development. Check [VSCode CloudLaTeX Extension](https://github.com/cloudlatex-team/cloudlatex-vscode-extension/tree/master) if you are a VSCode user.**

*** Write locally and compile on cloud service.

Cloud LaTeX CLI is an official tool written in nodejs to write tex files locally and compile with [Cloud LaTeX](https://cloudlatex.io/).

You can write tex files with your favorite editor and compile them without installing very large latex compiler!

If you use VSCode, you can use [Cloud LaTeX VSCode Extension](https://github.com/cloudlatex-team/cloudlatex-vscode-extension).

<details>
<summary>⚠Following sections is under development and not completed. </summary>

## このレポジトリは[cloudlatex-cli-plugin](https://github.com/cloudlatex-team/cloudlatex-cli-plugin)からフォークされています

[issues/27](https://github.com/cloudlatex-team/cloudlatex-cli-plugin/issues/27)にしたがって以下の点が変更されています．

* 隠しファイルの同期をスキップ
* node_modulesの同期をスキップ

フォーク元ではなく本レポジトリを使用した場合の一切の責任を負いません．また，本レポジトリの使用はcloudlatex-teamさんの許可をとっていません．そのため，予告なく削除される場合があります．

### 本レポジトリの使用手順

```bash
git clone https://github.com/xryuseix/cloudlatex-cli-plugin
git clone https://github.com/cloudlatex-team/cloudlatex-vscode-extension
cd cloudlatex-cli-plugin
yarn && yarn build
cd ../cloudlatex-vscode-extension
yarn
cp -y -r ../cloudlatex-cli-plugin/dist node_modules/cloudlatex-cli-plugin
yarn vsce
```

VSCodeの「拡張機能」→「VSIXからインストール」より，`build/cloudlatex-2.0.0.vsix`をインストールしてください．

## Features
- Multi-platform
- Offline support


## Installation (Not Released yet)
```
npm install -g cloudlatex-cli
```

## Account Settings
If you have no Cloud LaTeX account, you need to create your account from [here](https://cloudlatex.io/).

Create your project which you want to edit locally on the [web page](https://cloudlatex.io/projects). 

Generate client id and token from [Account name] -> [Extension] at the [project page](https://cloudlatex.io/projects) and record them.


## Usage
On your latex directory, run the following command.

＊ For the first time, the directory should be empty, otherwise local files on the directory will be overwritten.
```
cloudlatex-cli --path ./  \
  --outdir ./workspace \
  --project [Your ProjectId] \
  --email [Your email address used for CloudLaTeX account] \
  --client [Your client id] \
  --token [Your token] 
```


Then, your project files will be downloaded.
Local file changes will synchronized with the Cloud LaTeX server and compilation is fired on the server.

After the second time, run the same command as before.

＊ File changes when this tool is not running are not synchronized.

</details>

# License
Apache License 2.0
