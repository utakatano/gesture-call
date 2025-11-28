# インストールガイド

## 前提条件

### システム要件

- **オペレーティングシステム**: Windows 10+, macOS 10.14+, Linux (Ubuntu 18.04+)
- **ブラウザ**: Google Chrome 88+ または Chromium系ブラウザ
- **Node.js**: v14.0.0 以上
- **npm**: v6.0.0 以上 (Node.jsに同梱)
- **Webカメラ**: 内蔵または外部Webカメラ

### ハードウェア要件

- **CPU**: Intel Core i3 相当以上 (MediaPipe処理のため)
- **メモリ**: 4GB RAM以上
- **Webカメラ**: 解像度 640×480 以上

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone https://github.com/your-repo/gesture-call.git
cd gesture-call
```

### 2. 依存関係のインストール

```bash
# プロジェクトルートでの共通依存関係
npm install

# Webアプリケーション版の依存関係
cd simple-web
npm install
cd ..

# Chrome拡張機能版の依存関係  
cd extension
npm install
cd ..
```

### 3. プロジェクトのビルド

```bash
# TypeScriptコンパイル
npm run build
```

## Webアプリケーション版のセットアップ

### 1. ローカルサーバーの起動

```bash
cd simple-web
npm start
```

### 2. ブラウザでアクセス

1. ブラウザで `http://localhost:3000` にアクセス
2. カメラアクセス許可のダイアログが表示されたら「許可」をクリック
3. Webカメラの映像が表示されることを確認

### 3. 動作確認

- 手をカメラに映すと緑色の線（手の骨格）と赤い点（ランドマーク）が表示される
- 以下のジェスチャーを試す：
  - **手を挙げる**: 5本の指を全て立てる
  - **人差し指**: 人差し指のみを立てる  
  - **親指**: 親指のみを立てる

## Chrome拡張機能版のセットアップ

### 1. 拡張機能の読み込み

1. Chrome ブラウザで `chrome://extensions/` にアクセス
2. 右上の「デベロッパーモード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `gesture-call/extension` フォルダを選択

### 2. 拡張機能の有効化確認

- 拡張機能一覧に「Gesture Call」が表示されることを確認
- エラーが表示されていないことを確認

### 3. 基本動作確認

1. **ポップアップの表示**
   - ブラウザ右上の拡張機能アイコンをクリック
   - ポップアップ画面が表示されることを確認

2. **カメラ機能のテスト**
   - ポップアップで「カメラ開始」をクリック
   - カメラアクセス許可を与える
   - ページ右上に小さなカメラ画面（240×160px）が表示されることを確認

3. **ジェスチャー認識のテスト**
   - カメラ画面に手をかざす
   - 緑色の線と赤い点が表示されることを確認
   - ジェスチャーが認識されることを確認

## 設定とカスタマイズ

### Chrome拡張機能の設定

1. **URL遷移の設定**
   - ポップアップで「設定」タブを開く
   - 「遷移先URL」に目的のURLを入力
   - 手を挙げるジェスチャーでページ遷移が実行される

2. **クリック対象の設定**
   - 「クリックセレクタ」にCSSセレクタを入力
   - 例: `button.submit`, `#login-btn`, `.nav-item:first-child`
   - 人差し指のジェスチャーで対象要素がクリックされる

3. **設定の保存**
   - 設定は自動的にブラウザに保存される
   - 他のデバイスでChromeにログインしている場合は同期される

## トラブルシューティング

### よくある問題と解決方法

#### 1. カメラが表示されない

**症状**: カメラアクセス許可を与えても映像が表示されない

**解決方法**:
```bash
# HTTPSまたはlocalhostでアクセスしているか確認
# Chrome設定でカメラのアクセスが許可されているか確認
chrome://settings/content/camera
```

#### 2. 依存関係のインストールエラー

**症状**: `npm install` でエラーが発生

**解決方法**:
```bash
# npm キャッシュをクリア
npm cache clean --force

# Node.jsのバージョン確認
node --version  # v14以上であることを確認

# package-lock.jsonを削除して再インストール
rm package-lock.json
npm install
```

#### 3. TypeScriptコンパイルエラー

**症状**: `npm run build` でコンパイルエラー

**解決方法**:
```bash
# TypeScriptを最新版に更新
npm install -g typescript

# プロジェクト依存関係を再インストール
npm ci

# 型定義ファイルが不足している場合
npm install @types/chrome --save-dev
```

#### 4. 拡張機能の読み込みエラー

**症状**: Chrome拡張機能の読み込み時にエラー

**解決方法**:
1. `manifest.json` の構文エラーを確認
2. ビルドが正常に完了しているか確認：
   ```bash
   ls extension/dist/src/
   # background.js, content_script.js, offscreen.js, popup.js があることを確認
   ```
3. 拡張機能を一度削除して再読み込み

#### 5. MediaPipe読み込みエラー

**症状**: 手の検知が動作しない

**解決方法**:
1. ネットワーク接続を確認（初回はMediaPipeモデルのダウンロードが必要）
2. ブラウザのコンソールでエラーを確認：
   ```javascript
   // F12 → Console タブでエラーを確認
   ```
3. `libs/` フォルダ内のMediaPipeファイルが存在することを確認

#### 6. 手の描画が表示されない

**症状**: カメラは表示されるが手の骨格線が描画されない

**解決方法**:
1. デベロッパーツールで以下のログを確認：
   - `"MediaPipe drawing functions loaded successfully"`
   - `"Hand detection results in offscreen"`
   - `"Hand landmarks drawn successfully"`

2. 照明条件を改善（明るい環境で試行）
3. 手をカメラに明確に映すように調整

### デバッグ手順

#### Chrome拡張機能のデバッグ

1. **Content Script**
   ```bash
   # 対象ページでF12 → Console
   # "ExtensionGestureDetector initialized" のメッセージを確認
   ```

2. **Background Script**
   ```bash
   # chrome://extensions/ → "Service Worker" をクリック
   # メッセージルーティングのログを確認
   ```

3. **Offscreen Document**
   ```bash
   # chrome://extensions/ → "offscreen.html" をクリック
   # MediaPipe処理のログを確認
   ```

#### ログレベルの調整

```typescript
// デバッグ用により詳細なログを有効化
console.log('Debug information:', {
    videoReady: this.video.readyState,
    videoSize: `${this.video.videoWidth}x${this.video.videoHeight}`,
    canvasSize: `${this.canvas.width}x${this.canvas.height}`,
    hasMediaPipeFunctions: !!drawConnectors && !!drawLandmarks
});
```

## 開発環境のセットアップ

開発を行う場合の追加セットアップ手順:

### 1. 開発用ツールのインストール

```bash
# TypeScript開発用ツール
npm install -g typescript ts-node

# コードフォーマッター
npm install -g prettier eslint
```

### 2. エディタ設定

**VSCode推奨拡張機能**:
- TypeScript and JavaScript Language Features
- Prettier - Code formatter
- ESLint
- Chrome Extension Development

### 3. ホットリロード設定

```bash
# ファイル変更を監視してビルド
npm run watch

# 拡張機能の自動リロード（開発時）
# chrome://extensions/ で「リロード」ボタンをクリック
```

## 次のステップ

インストールが完了したら:

1. [アーキテクチャドキュメント](architecture.md) でシステム設計を理解
2. カスタムジェスチャーやアクションの追加を検討
3. 本番デプロイメントのための拡張機能パッケージ化を実行