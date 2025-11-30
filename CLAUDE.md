# CLAUDE.md

このファイルは、このリポジトリでコードを扱う際のClaude Code (claude.ai/code) へのガイダンスを提供します。

## 言語設定

ドキュメントとClaude Codeのメッセージ・レスポンスは日本語を使用してください。

## プロジェクト概要

Gesture Callは、MediaPipe Hand Landmarkを使用してWebカメラから手のジェスチャーを検知し、ブラウザ内でアクションを実行する完全実装済みのシステムです。以下の2つの形態で提供されています：

1. **Webアプリケーション** (`simple-web/`): 全画面でジェスチャー検知を行うスタンドアロン版
2. **Chrome拡張機能** (`extension/`): ページオーバーレイとして動作する拡張機能版

## 技術アーキテクチャ

### Webアプリケーション版
- **フロントエンド**: TypeScript + MediaPipe直接実行
- **サーバー**: Express.js (TypeScript)
- **カメラ**: 1280x720px全画面表示
- **処理**: リアルタイムジェスチャー検知と描画

### Chrome拡張機能版
- **Background Script**: オフスクリーンドキュメント管理、メッセージルーティング
- **Content Script**: 240x160pxカメラオーバーレイ、DOMアクション実行
- **Offscreen Document**: MediaPipe処理（CSP制約回避）
- **Popup Script**: 設定画面、カメラ制御

## 実装済み機能

### ジェスチャー認識
- **手を挙げる** (5本指): URL遷移（拡張機能版）
- **人差し指**: DOM要素クリック（拡張機能版）  
- **親指**: カスタムアクション
- リアルタイム手の描画（緑色骨格線、赤いランドマーク）

### Chrome拡張機能
- ポップアップ設定画面（URL遷移先、クリックセレクター設定）
- カメラ開始/停止制御
- オーバーレイカメラ表示（ページ右上）
- オフスクリーンMediaPipe処理（CSP準拠）

## プロジェクト構造

```
gesture-call/
├── simple-web/              # Webアプリケーション版
│   ├── src/
│   │   └── gesture-detection.ts
│   ├── libs/                # MediaPipeライブラリ
│   ├── index.html
│   └── server.ts            # Expressサーバー
├── extension/               # Chrome拡張機能版  
│   ├── src/
│   │   ├── background.ts    # Background Script
│   │   ├── content_script.ts # Content Script
│   │   ├── offscreen.ts     # Offscreen Document
│   │   └── popup.ts         # Popup Script
│   ├── libs/                # MediaPipeライブラリ
│   ├── manifest.json        # V3マニフェスト
│   ├── popup.html           # ポップアップUI
│   └── offscreen.html       # オフスクリーン処理
└── docs/                    # ドキュメント
    ├── architecture.md      # アーキテクチャ設計
    └── development.md       # 開発ガイド
```

## 開発コマンド

### ビルド
```bash
npm run build               # 全体ビルド
```

### Webアプリケーション
```bash
cd simple-web
npm start                  # http://localhost:3000
```

### Chrome拡張機能
1. `chrome://extensions/` でデベロッパーモード有効化
2. `extension/` フォルダを読み込み

## パフォーマンス仕様

- **処理間隔**: 500ms（バランスの取れた応答性）
- **画像品質**: JPEG 80%圧縮
- **カメラ解像度**: 240x160px（拡張機能）、1280x720px（Web版）
- **MediaPipe**: Hand Landmarkモデル（21ポイント検知）

## 重要な実装詳細

### CSP対応
Chrome拡張機能でのMediaPipe実行のため、オフスクリーンドキュメントを使用してCSP制約を回避。

### メッセージフロー
```
Content Script → Background Script → Offscreen Document
                             ↓
Offscreen Document → Background Script → Content Script
```

### デバッグ
- **Content Script**: ページのデベロッパーツール
- **Background Script**: `chrome://extensions/` の「Service Worker」
- **Offscreen Document**: `chrome://extensions/` の「offscreen.html」