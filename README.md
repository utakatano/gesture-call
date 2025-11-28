# Gesture Call

手の動きを検知してブラウザアクションをトリガーするジェスチャー認識システム

## 概要

Gesture Callは、MediaPipe Hand Landmarkを使用してWebカメラから手のジェスチャーを認識し、ブラウザ内で様々なアクションを実行するシステムです。WebアプリケーションとChrome拡張機能の2つの形態で提供されます。

## 特徴

- **リアルタイム手の検知**: MediaPipeを使用した高精度な手の認識
- **複数のジェスチャー対応**: 手を挙げる、人差し指、親指のジェスチャーを認識
- **CSP準拠**: Chrome拡張機能のContent Security Policy制約内で動作
- **デュアルプラットフォーム**: WebアプリケーションとChrome拡張機能で利用可能
- **オフスクリーン処理**: Chrome拡張機能ではオフスクリーンドキュメントでMediaPipe処理を実行

## プロジェクト構成

```
gesture-call/
├── simple-web/           # Webアプリケーション版
│   ├── src/
│   │   └── gesture-detection.ts
│   ├── libs/            # MediaPipeライブラリ
│   ├── index.html       # メイン画面
│   └── server.ts        # ローカルサーバー
│
├── extension/           # Chrome拡張機能版  
│   ├── src/
│   │   ├── background.ts      # Background Script
│   │   ├── content_script.ts  # Content Script
│   │   ├── offscreen.ts       # Offscreen Document
│   │   └── popup.ts           # Popup Script
│   ├── libs/                  # MediaPipeライブラリ
│   ├── manifest.json          # 拡張機能設定
│   ├── popup.html            # ポップアップ画面
│   └── offscreen.html        # オフスクリーン処理画面
│
└── docs/                # ドキュメント
    ├── architecture.md  # アーキテクチャ設計
    ├── install.md       # インストールガイド
    └── tasks.md         # 開発タスク
```

## 対応ジェスチャー

| ジェスチャー | 説明 | アクション |
|------------|------|----------|
| 手を挙げる | 5本の指を全て立てる | URL遷移（拡張機能版） |
| 人差し指 | 人差し指のみを立てる | 要素クリック（拡張機能版） |
| 親指 | 親指のみを立てる | カスタムアクション |

## システムアーキテクチャ

### Webアプリケーション版
- フロントエンドでMediaPipeを直接実行
- カメラ映像を全画面表示
- リアルタイムでジェスチャー検知と描画

### Chrome拡張機能版
- **Background Script**: オフスクリーンドキュメント管理、メッセージルーティング
- **Content Script**: カメラ表示、ユーザーインターフェース、アクション実行
- **Offscreen Document**: MediaPipe処理、手の検知処理
- **Popup Script**: 設定画面、カメラ制御

#### メッセージフロー
```
Content Script → Background Script → Offscreen Document
                              ↓
Offscreen Document → Background Script → Content Script
```

## 技術仕様

- **フレームワーク**: TypeScript, MediaPipe Hand Landmark
- **検知間隔**: 500ms（0.5秒ごと）
- **カメラ解像度**: 240x160px（拡張機能版）、1280x720px（Web版）
- **ブラウザ対応**: Chrome, Chromium系ブラウザ

## インストール

詳細なインストール手順は [docs/install.md](docs/install.md) を参照してください。

### 前提条件

- Node.js (v14以上)
- npm
- Chrome ブラウザ
- Webカメラ

### クイックスタート

```bash
# リポジトリをクローン
git clone https://github.com/your-repo/gesture-call.git
cd gesture-call

# 依存関係をインストール
npm install

# TypeScriptコンパイル
npm run build
```

#### Webアプリケーション版の起動

```bash
cd simple-web
npm start
# http://localhost:3000 でアクセス
```

#### Chrome拡張機能版の導入

1. `chrome://extensions/` にアクセス
2. 「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `extension/` フォルダを選択

## 使用方法

### Webアプリケーション版

1. ローカルサーバーを起動
2. ブラウザで http://localhost:3000 にアクセス
3. カメラ許可を与える
4. 手をかざしてジェスチャーを実行

### Chrome拡張機能版

1. 拡張機能アイコンをクリックしてポップアップを開く
2. 「カメラ開始」ボタンをクリック
3. 設定画面で対象URL・クリックセレクターを設定
4. ページ右上のカメラオーバーレイで手をかざす

## 開発

### ビルド

```bash
npm run build
```

### デバッグ

Chrome拡張機能のデバッグ方法：

1. Content Script: ページのデベロッパーツール
2. Background Script: `chrome://extensions/` の「Service Worker」をクリック  
3. Offscreen Document: `chrome://extensions/` の「offscreen.html」をクリック

### アーキテクチャ詳細

詳細なアーキテクチャ設計は [docs/architecture.md](docs/architecture.md) を参照してください。

## トラブルシューティング

### よくある問題

1. **カメラが表示されない**
   - ブラウザのカメラ許可を確認
   - HTTPSまたはlocalhostでアクセスしているか確認

2. **手の検知ができない**
   - 明るい環境で試行
   - 手を明確に映す
   - カメラの解像度を確認

3. **拡張機能が動作しない**
   - 拡張機能を再読み込み
   - デベロッパーツールでエラーログを確認

## ライセンス

MIT License

## 貢献

プルリクエストや Issue の報告を歓迎します。

## 今後の改善予定

- [ ] より多様なジェスチャーパターンの対応
- [ ] パフォーマンスの最適化
- [ ] UI/UXの改善
- [ ] 設定のカスタマイズ機能拡張
- [ ] エラーハンドリングの強化