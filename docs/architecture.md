# アーキテクチャ設計

## システム概要

Gesture Callは、MediaPipe Hand Landmarkを使用してリアルタイムで手のジェスチャーを検知し、ブラウザ内でアクションを実行するシステムです。WebアプリケーションとChrome拡張機能の2つのプラットフォームに対応しています。

## 全体アーキテクチャ

```
┌─────────────────┐    ┌─────────────────┐
│  Web Application │    │ Chrome Extension │
│                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Camera    │ │    │ │   Popup     │ │
│ │   Display   │ │    │ │   UI        │ │
│ └─────────────┘ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │  MediaPipe  │ │    │ │  Content    │ │
│ │  Processing │ │    │ │  Script     │ │
│ └─────────────┘ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │  Gesture    │ │    │ │ Background  │ │
│ │  Detection  │ │    │ │   Script    │ │
│ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    │ ┌─────────────┐ │
                       │ │ Offscreen   │ │
                       │ │ Document    │ │
                       │ └─────────────┘ │
                       └─────────────────┘
```

## Chrome拡張機能アーキテクチャ

### コンポーネント構成

#### 1. Background Script (`background.ts`)
- **役割**: メッセージルーティングハブ、オフスクリーンドキュメント管理
- **責任**:
  - オフスクリーンドキュメントの作成・削除
  - Content ScriptとOffscreen Document間のメッセージ転送
  - アクティブタブの特定と結果配信

#### 2. Content Script (`content_script.ts`)
- **役割**: ユーザーインターフェース、カメラ表示、アクション実行
- **責任**:
  - カメラオーバーレイの表示（240px × 160px）
  - フレームキャプチャとOffscreen Documentへの送信
  - 手の検知結果の描画
  - ジェスチャーに基づくDOMアクションの実行

#### 3. Offscreen Document (`offscreen.ts`)
- **役割**: MediaPipe処理エンジン
- **責任**:
  - MediaPipe Hand Landmarkの初期化と実行
  - 画像フレームの処理
  - 手のランドマーク検知
  - ジェスチャー認識ロジック

#### 4. Popup Script (`popup.ts`)
- **役割**: 設定画面とカメラ制御
- **責任**:
  - カメラの開始・停止制御
  - URL遷移先・クリック対象の設定
  - ユーザー設定の保存・読み込み

### データフロー

```
┌─────────────────┐  1. フレームキャプチャ  ┌─────────────────┐
│  Content Script │ ──────────────────────→ │ Background      │
│                 │                         │ Script          │
│ - カメラ表示     │  2. フレーム転送        │ - メッセージ     │
│ - UI制御        │ ──────────────────────→ │   ルーティング   │
│ - アクション実行  │                         └─────────────────┘
└─────────────────┘                                   │
         ↑                                            │ 3. MediaPipe処理
         │ 5. 検知結果                                   ↓
         │                                  ┌─────────────────┐
         │                                  │ Offscreen       │
         │ 4. 結果転送                       │ Document        │
         ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │                 │
                                           │ - MediaPipe     │
                                           │ - 手の検知       │
                                           │ - ジェスチャー   │
                                           │   認識          │
                                           └─────────────────┘
```

## メッセージ通信プロトコル

### 1. フレーム処理フロー

```typescript
// Content Script → Background Script
{
    action: 'processFrame',
    imageData: string (Base64)
}

// Background Script → Offscreen Document  
{
    target: 'offscreen',
    action: 'processFrame',
    imageData: string
}

// Offscreen Document → Background Script
{
    action: 'handDetectionResults',
    results: {
        hands: Landmark[][],
        handedness: HandednessResult[],
        timestamp: number
    }
}

// Background Script → Content Script
{
    action: 'handDetectionResults',
    results: HandDetectionResult
}
```

### 2. 初期化フロー

```typescript
// Content Script → Background Script
{
    action: 'initializeHandDetection'
}

// Background Script → Offscreen Document
{
    target: 'offscreen', 
    action: 'initializeHandDetection'
}
```

## MediaPipe処理

### Hand Landmark検知

```typescript
interface Landmark {
    x: number;      // 正規化座標 (0-1)
    y: number;      // 正規化座標 (0-1)  
    z: number;      // 深度情報
    visibility?: number;  // 可視性スコア
}
```

### ジェスチャー認識アルゴリズム

#### 指の状態判定

```typescript
private getFingersUp(landmarks: Landmark[]): number[] {
    const fingerTips = [4, 8, 12, 16, 20];    // 指先のインデックス
    const fingerPips = [3, 6, 10, 14, 18];    // 第一関節
    const fingerMcp = [2, 5, 9, 13, 17];      // 付け根関節
    
    // 親指: 横方向の拡張と上方向を判定
    // その他の指: Y座標の比較による判定
}
```

#### ジェスチャーパターン

| ジェスチャー | 指の状態 | 判定条件 |
|------------|---------|----------|
| 手を挙げる | [1,1,1,1,1] | 全ての指が立っている |
| 人差し指 | [0,1,0,0,0] | 人差し指のみが立っている |
| 親指 | [1,0,0,0,0] | 親指のみが立っている |

## パフォーマンス考慮事項

### 処理頻度

- **フレーム処理**: 500ms間隔（2fps相当）
- **描画更新**: 検知結果受信時のみ
- **MediaPipe処理**: オフスクリーンで非同期実行

### メモリ管理

- **ビデオストリーム**: 240×160px に制限してメモリ使用量を削減
- **フレームデータ**: Base64エンコード、JPEG圧縮（品質80%）
- **ランドマークデータ**: 21ポイント × 座標3次元 = 最小限のデータ転送

### CSP対応

- **スクリプト実行**: `'wasm-unsafe-eval'` でWebAssembly実行を許可
- **リソース読み込み**: `web_accessible_resources` で静的ファイルアクセス
- **動的評価**: `eval()` や `new Function()` を使用しない安全な実装

## セキュリティ考慮事項

### 権限管理

```json
{
    "permissions": [
        "activeTab",     // アクティブタブへのアクセス
        "storage",       // 設定データの保存
        "tabs",          // タブ情報の取得
        "offscreen"      // オフスクリーン処理
    ]
}
```

### データ保護

- **カメラデータ**: ローカル処理のみ、外部送信なし
- **ユーザー設定**: Chrome.storage.syncで安全に保存
- **メッセージ検証**: Content Security Policyに準拠

## 拡張性

### 新しいジェスチャーの追加

1. `detectGesture()` メソッドに新しいパターンを追加
2. `executeGestureAction()` にアクションハンドラーを実装
3. ポップアップUIに設定項目を追加

### 新しいアクションタイプ

1. Content Scriptにアクション実行ロジックを追加
2. 設定画面にUI要素を追加
3. Chrome.storageスキーマを拡張

### パフォーマンス調整

- `PROCESS_INTERVAL` の調整
- MediaPipe設定パラメータの最適化
- フレーム解像度の動的調整

## トラブルシューティング

### デバッグポイント

1. **Content Script**: ページのデベロッパーツール
2. **Background Script**: 拡張機能管理画面の「Service Worker」
3. **Offscreen Document**: 拡張機能管理画面の「offscreen.html」
4. **Popup**: ポップアップ右クリック→「検証」

### よくある問題

- **MediaPipe読み込みエラー**: ライブラリファイルのパス確認
- **メッセージ通信エラー**: Background Scriptのルーティング確認
- **カメラアクセスエラー**: HTTPSまたはlocalhostでの実行確認