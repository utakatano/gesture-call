# 開発ガイド

## 開発環境のセットアップ

### 必要なツール

```bash
# TypeScript開発用
npm install -g typescript ts-node

# コードフォーマット・リント
npm install -g prettier eslint

# プロジェクト依存関係
npm install
```

### VSCode推奨拡張機能

- **TypeScript and JavaScript Language Features**: TypeScript開発支援
- **Prettier - Code formatter**: コード自動フォーマット
- **ESLint**: コード品質チェック
- **Chrome Extension Development**: 拡張機能開発支援

## プロジェクト構成

```
gesture-call/
├── simple-web/                 # Webアプリケーション版
│   ├── src/
│   │   └── gesture-detection.ts    # メインロジック
│   ├── libs/                        # MediaPipeライブラリ
│   ├── index.html                   # エントリーポイント
│   └── server.ts                    # Express サーバー
│
├── extension/                   # Chrome拡張機能版
│   ├── src/
│   │   ├── background.ts            # Background Script
│   │   ├── content_script.ts        # Content Script  
│   │   ├── offscreen.ts             # Offscreen Document
│   │   └── popup.ts                 # Popup Script
│   ├── dist/                        # コンパイル済みJS
│   ├── libs/                        # MediaPipeライブラリ
│   ├── manifest.json                # 拡張機能設定
│   ├── popup.html                   # ポップアップUI
│   └── offscreen.html               # オフスクリーン処理
│
├── docs/                        # ドキュメント
└── CLAUDE.md                    # AI開発ガイダンス
```

## 開発ワークフロー

### 1. 機能開発の流れ

```bash
# 1. 機能ブランチを作成
git checkout -b feature/new-gesture

# 2. コード変更
# TypeScriptファイルを編集

# 3. ビルドとテスト
npm run build
npm test  # テストが実装されている場合

# 4. 動作確認
# Webアプリ版: npm start
# 拡張機能版: chrome://extensions/ でリロード

# 5. コミットとプッシュ
git add .
git commit -m "Add new gesture recognition"
git push origin feature/new-gesture
```

### 2. コード品質管理

```bash
# コードフォーマット
npx prettier --write "**/*.{ts,js,json,md}"

# リント実行
npx eslint "**/*.ts" --fix

# 型チェック
npx tsc --noEmit
```

## 主要コンポーネントの開発

### MediaPipe統合

```typescript
// 新しいジェスチャーパターンの追加例
private detectGesture(landmarks: Landmark[]): string | null {
    const fingers = this.getFingersUp(landmarks);
    
    // 既存のジェスチャー
    if (fingers.every(finger => finger === 1)) {
        return '手を挙げました';
    }
    
    // 新しいジェスチャー: 2本指 (人差し指 + 中指)
    if (fingers[1] === 1 && fingers[2] === 1 && 
        fingers[0] === 0 && fingers[3] === 0 && fingers[4] === 0) {
        return '2本指を上げました';
    }
    
    return null;
}
```

### Chrome拡張機能のメッセージ通信

```typescript
// Background Script での新しいアクションの追加
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'newCustomAction':
            handleNewCustomAction(message.data).then(sendResponse);
            return true;
    }
});

async function handleNewCustomAction(data: any): Promise<any> {
    // カスタムアクション実装
    return { success: true, result: 'action completed' };
}
```

### UI コンポーネントの追加

```typescript
// popup.ts での新しい設定項目追加
private setupEventListeners(): void {
    // 既存のイベントリスナー
    
    // 新しい設定項目
    const sensitivitySlider = document.getElementById('sensitivity') as HTMLInputElement;
    sensitivitySlider?.addEventListener('change', (e) => {
        this.updateSensitivity(parseFloat((e.target as HTMLInputElement).value));
    });
}

private async updateSensitivity(value: number): Promise<void> {
    await chrome.storage.sync.set({ gesturesSensitivity: value });
}
```

## デバッグとトラブルシューティング

### デバッグ環境の設定

```typescript
// 開発モード判定
const isDevelopment = !('update_url' in chrome.runtime.getManifest());

// デバッグログの条件出力
if (isDevelopment) {
    console.log('Debug info:', {
        timestamp: Date.now(),
        data: processedData
    });
}
```

### Chrome拡張機能のデバッグ

1. **Content Script**
   ```bash
   # 対象ページで F12 → Console
   # Content Script のログを確認
   ```

2. **Background Script** 
   ```bash
   # chrome://extensions/ → "Service Worker" をクリック
   # Background Script 専用のデベロッパーツールが開く
   ```

3. **Offscreen Document**
   ```bash
   # chrome://extensions/ → "offscreen.html" をクリック
   # Offscreen 処理のログを確認
   ```

### よくあるデバッグポイント

```typescript
// MediaPipe初期化の確認
console.log('MediaPipe status:', {
    handsInitialized: !!this.hands,
    drawFunctionsLoaded: !!(drawConnectors && drawLandmarks),
    canvasReady: !!(this.canvas && this.ctx)
});

// メッセージ通信の確認
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received:', {
        action: message.action,
        from: sender.tab ? 'content' : 'offscreen',
        timestamp: Date.now()
    });
});

// ジェスチャー検知の確認
private detectGesture(landmarks: Landmark[]): string | null {
    const fingers = this.getFingersUp(landmarks);
    console.log('Finger states:', fingers);  // [0,1,0,0,0] などを出力
    
    // 既存のロジック
}
```

## テスト戦略

### 単体テスト（将来実装予定）

```typescript
// gesture-detection.test.ts
import { GestureDetector } from '../src/gesture-detection';

describe('GestureDetector', () => {
    let detector: GestureDetector;
    
    beforeEach(() => {
        detector = new GestureDetector();
    });
    
    test('should detect raised hand gesture', () => {
        const mockLandmarks = createMockLandmarks([1,1,1,1,1]);
        const result = detector.detectGesture(mockLandmarks);
        expect(result).toBe('手を挙げました');
    });
});
```

### 統合テスト

```typescript
// extension-integration.test.ts
describe('Extension Integration', () => {
    test('should initialize all components', async () => {
        // Background Script初期化確認
        // Offscreen Document作成確認
        // Content Script通信確認
    });
});
```

### E2Eテスト（将来実装予定）

```javascript
// Puppeteer を使用したE2Eテスト
const puppeteer = require('puppeteer');

describe('Gesture Call E2E', () => {
    test('should detect gesture and trigger action', async () => {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        // 拡張機能の読み込み
        // ジェスチャーのシミュレーション
        // アクション実行の確認
        
        await browser.close();
    });
});
```

## パフォーマンス最適化

### メモリ管理

```typescript
// リソースの適切な解放
class ExtensionGestureDetector {
    private cleanup(): void {
        // メディアストリーム停止
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        // イベントリスナー削除
        if (this.detectionTimer) {
            clearInterval(this.detectionTimer);
            this.detectionTimer = null;
        }
        
        // DOM要素削除
        if (this.overlay) {
            document.body.removeChild(this.overlay);
            this.overlay = null;
        }
    }
}
```

### 処理負荷軽減

```typescript
// フレーム処理の最適化
private captureFrameAndSendToOffscreen(): void {
    // 前回処理から十分な時間が経過している場合のみ実行
    const now = Date.now();
    if (now - this.lastProcessTime < this.PROCESS_INTERVAL) {
        return;
    }
    this.lastProcessTime = now;
    
    // 画像圧縮率の調整
    const imageData = this.canvas.toDataURL('image/jpeg', 0.6); // 品質を下げて軽量化
    
    // 非同期送信でUIブロックを回避
    this.sendToOffscreen(imageData);
}
```

## セキュリティ考慮事項

### Content Security Policy対応

```typescript
// 動的スクリプト実行の回避
// ❌ NGパターン
eval('console.log("hello")');
new Function('console.log("hello")')();

// ✅ OKパターン
console.log("hello");
```

### 入力値検証

```typescript
// ユーザー入力の検証
private validateUserInput(input: string): boolean {
    // URLの検証
    try {
        new URL(input);
        return true;
    } catch {
        return false;
    }
}

// CSSセレクタの検証
private validateSelector(selector: string): boolean {
    try {
        document.querySelector(selector);
        return true;
    } catch {
        return false;
    }
}
```

## デプロイメント

### 拡張機能のパッケージ化

```bash
# プロダクションビルド
NODE_ENV=production npm run build

# 拡張機能パッケージ作成
cd extension
zip -r ../gesture-call-extension.zip . -x "node_modules/*" "*.ts" "tsconfig.json"
```

### Chrome Web Store公開

1. **開発者登録**
   - Chrome Web Store Developer Dashboard
   - $5の登録料が必要

2. **パッケージアップロード**
   - ZIP ファイルをアップロード
   - アプリ説明・スクリーンショットを追加

3. **レビュー申請**
   - Googleによる審査（通常数日）
   - 承認後にストア公開

## 継続的な改善

### メトリクス収集

```typescript
// パフォーマンス計測
const performanceMetrics = {
    frameProcessingTime: 0,
    gestureDetectionTime: 0,
    memoryUsage: 0
};

private measurePerformance<T>(operation: () => T, metricName: string): T {
    const start = performance.now();
    const result = operation();
    const end = performance.now();
    
    performanceMetrics[metricName] = end - start;
    return result;
}
```

### ユーザーフィードバック

```typescript
// エラーレポート機能
private reportError(error: Error, context: string): void {
    const errorReport = {
        message: error.message,
        stack: error.stack,
        context: context,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
    };
    
    // 匿名化されたエラーログを送信（実装予定）
    console.error('Error Report:', errorReport);
}
```

## リリースガイドライン

### バージョニング

- **メジャー**: APIの破壊的変更
- **マイナー**: 新機能追加  
- **パッチ**: バグフィックス

### チェンジログ

```markdown
## [1.1.0] - 2024-01-15

### Added
- 2本指ジェスチャーの認識
- ジェスチャー感度調整機能

### Changed  
- フレーム処理間隔を500msに最適化

### Fixed
- オフスクリーン処理での描画関数読み込み問題
```

これらのガイドラインに従って、機能拡張や保守を効率的に進めることができます。