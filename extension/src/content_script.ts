// Chrome拡張機能のコンテンツスクリプト（オフスクリーン方式）

// 名前空間の分離とエラー防止
(function() {
    'use strict';
    
    // MediaPipe関数の宣言とアクセス
    let drawConnectors: any, drawLandmarks: any, HAND_CONNECTIONS: any;
    
    // MediaPipeライブラリが読み込まれるまで待機する関数
    function waitForMediaPipe(): Promise<void> {
        return new Promise((resolve) => {
            const checkMediaPipe = () => {
                const windowAny = window as any;
                if (windowAny.drawConnectors && windowAny.drawLandmarks && windowAny.HAND_CONNECTIONS) {
                    drawConnectors = windowAny.drawConnectors;
                    drawLandmarks = windowAny.drawLandmarks;
                    HAND_CONNECTIONS = windowAny.HAND_CONNECTIONS;
                    console.log('MediaPipe drawing functions loaded successfully');
                    resolve();
                } else {
                    console.log('MediaPipe functions not yet available, retrying in 100ms');
                    setTimeout(checkMediaPipe, 100);
                }
            };
            checkMediaPipe();
        });
    }

interface ContentExtensionSettings {
    targetUrl?: string;
    clickSelector?: string;
    stopSelector?: string;
    cameraActive?: boolean;
    coverVisible?: boolean;
}

interface HandDetectionResult {
    hands: any[];
    handedness: any[];
    timestamp: number;
}

class ExtensionGestureDetector {
    private video: HTMLVideoElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private overlay: HTMLElement | null = null;
    private coverDiv: HTMLElement | null = null;
    private coverStatusOutput: HTMLElement | null = null;
    private gestureOutput: HTMLElement | null = null;
    private mediaStream: MediaStream | null = null;
    private isActive = false;
    private settings: ContentExtensionSettings = {};
    private lastProcessTime = 0;
    private readonly PROCESS_INTERVAL = 500; // 0.5秒間隔
    private detectionTimer: number | null = null;

    constructor() {
        this.setupMessageListener();
        this.loadSettings();
        this.setupHandDetectionResultListener();
        this.setupUrlChangeListener();
        
        // MediaPipeライブラリの読み込みを待機
        waitForMediaPipe().then(() => {
            console.log('ExtensionGestureDetector initialized with MediaPipe');
        }).catch((error) => {
            console.error('Failed to load MediaPipe functions:', error);
        });
    }

    private setupUrlChangeListener(): void {
        // URL変更を検知するためのイベントリスナー
        let currentUrl = window.location.href;
        
        // popstate イベント（ブラウザの戻る/進むボタン）
        window.addEventListener('popstate', () => {
            this.handleUrlChange(currentUrl, window.location.href);
            currentUrl = window.location.href;
        });

        // pushState/replaceState の検知（プログラムによるURL変更）
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function(...args) {
            originalPushState.apply(history, args);
            window.dispatchEvent(new CustomEvent('urlchange'));
        };

        history.replaceState = function(...args) {
            originalReplaceState.apply(history, args);
            window.dispatchEvent(new CustomEvent('urlchange'));
        };

        window.addEventListener('urlchange', () => {
            this.handleUrlChange(currentUrl, window.location.href);
            currentUrl = window.location.href;
        });
    }

    private async handleUrlChange(oldUrl: string, newUrl: string): Promise<void> {
        if (oldUrl === newUrl) return;
        
        console.log('URL changed detected:', { from: oldUrl, to: newUrl });
        
        // 新しいURLで自動起動チェック
        await this.checkAndAutoStartCamera();
    }

    private isUrlAllowed(currentUrl: string, targetUrl: string): boolean {
        if (!targetUrl) {
            console.log('No target URL configured, allowing camera');
            return true;
        }

        try {
            const current = new URL(currentUrl);
            const target = new URL(targetUrl);
            
            console.log('Domain check:', {
                currentDomain: current.hostname,
                targetDomain: target.hostname
            });
            
            // 同じドメインかどうかをチェック
            const sameDomain = current.hostname === target.hostname;
            console.log('Same domain check result:', sameDomain);
            
            return sameDomain;
        } catch (error) {
            console.error('URL parsing error in isUrlAllowed:', error);
            return false;
        }
    }

    private setupMessageListener(): void {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.action) {
                case 'startCamera':
                    this.startCamera();
                    sendResponse({ success: true });
                    break;
                case 'stopCamera':
                    this.stopCamera();
                    sendResponse({ success: true });
                    break;
                case 'handDetectionResults':
                    this.handleHandDetectionResults(message.results);
                    sendResponse({ success: true });
                    break;
                case 'toggleCover':
                    this.toggleCover(message.visible);
                    sendResponse({ success: true });
                    break;
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        });
    }

    private setupHandDetectionResultListener(): void {
        // Background Scriptからの手の検知結果を受信
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'handDetectionResults') {
                this.handleHandDetectionResults(message.results);
                sendResponse({ success: true });
            }
        });
    }

    private async loadSettings(): Promise<void> {
        try {
            const result = await chrome.storage.sync.get(['targetUrl', 'clickSelector', 'stopSelector', 'cameraActive', 'coverVisible']);
            console.log('Loaded settings from storage:', result);
            this.settings = result as ContentExtensionSettings;
            
            // カバー表示の初期値をONに設定（未設定の場合）
            if (this.settings.coverVisible === undefined) {
                this.settings.coverVisible = true;
            }
            
            console.log('Settings applied to this.settings:', this.settings);
            
            // 遷移先URLのドメインかどうかをチェックして自動起動
            await this.checkAndAutoStartCamera();
            
            // カバーの表示状態を適用
            if (this.coverDiv !== null) {
                this.updateCoverVisibility();
            }
        } catch (error) {
            console.error('設定の読み込みに失敗:', error);
        }
    }

    private async checkAndAutoStartCamera(): Promise<void> {
        try {
            // 現在のURLと遷移先URLを比較
            const currentUrl = window.location.href;
            const targetUrl = this.settings.targetUrl;
            
            if (!targetUrl) {
                console.log('No target URL configured, skipping auto start');
                return;
            }

            // ドメインが一致するかチェック
            if (this.isUrlAllowed(currentUrl, targetUrl)) {
                console.log('Current domain matches target domain, checking camera state', {
                    current: currentUrl,
                    target: targetUrl
                });
                
                // タブIDを取得
                const response = await chrome.runtime.sendMessage({ action: 'getCurrentTabId' });
                if (response.tabId) {
                    // タブ固有の状態をチェック
                    const result = await chrome.storage.sync.get(['cameraActiveForTabs']);
                    const cameraActiveForTabs = result.cameraActiveForTabs || {};
                    const isStoredAsActive = cameraActiveForTabs[response.tabId] || false;
                    
                    console.log('Camera state check:', {
                        tabId: response.tabId,
                        storedAsActive: isStoredAsActive,
                        actuallyActive: this.isActive
                    });
                    
                    // ストレージでは起動済みだが実際には動作していない場合、または
                    // ストレージで未起動で実際にも動作していない場合に起動
                    if (isStoredAsActive && !this.isActive) {
                        console.log('Storage shows active but camera not running, restarting...');
                        await this.startCamera();
                    } else if (!isStoredAsActive && !this.isActive) {
                        console.log('Auto-starting camera for target domain...');
                        await this.startCamera();
                        // タブ固有の状態を更新
                        cameraActiveForTabs[response.tabId] = true;
                        await chrome.storage.sync.set({ cameraActiveForTabs: cameraActiveForTabs });
                    } else {
                        console.log('Camera already in correct state, no action needed');
                    }
                }
            } else {
                console.log('Current domain does not match target domain, not auto-starting camera', {
                    current: currentUrl,
                    target: targetUrl
                });
            }
        } catch (error) {
            console.error('Auto start check failed:', error);
        }
    }

    private async startCamera(): Promise<void> {
        if (this.isActive) return;

        try {
            this.createOverlay();
            await this.setupCamera();
            await this.initializeHandDetection();
            this.isActive = true;
            console.log('Camera started successfully');
        } catch (error) {
            console.error('カメラの開始に失敗:', error);
            this.removeOverlay();
        }
    }

    private async stopCamera(): Promise<void> {
        if (!this.isActive) return;

        this.isActive = false;
        
        // タイマーを停止
        this.stopHandDetectionTimer();
        
        // オフスクリーンドキュメントに停止通知
        try {
            await chrome.runtime.sendMessage({
                action: 'stopHandDetection'
            });
        } catch (error) {
            console.error('Failed to stop hand detection:', error);
        }

        // メディアストリームを停止
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        if (this.video) {
            this.video.srcObject = null;
        }

        this.removeOverlay();
    }

    private async initializeHandDetection(): Promise<void> {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'initializeHandDetection'
            });
            
            if (response.success) {
                console.log('Hand detection initialized via offscreen document');
            } else {
                throw new Error(response.error || 'Failed to initialize hand detection');
            }
        } catch (error) {
            console.error('Failed to initialize hand detection:', error);
        }
    }

    private async handleHandDetectionResults(results: HandDetectionResult): Promise<void> {
        console.log('Received hand detection results in content script:', {
            handCount: results.hands ? results.hands.length : 0,
            timestamp: results.timestamp,
            canvasSize: this.canvas ? `${this.canvas.width}x${this.canvas.height}` : 'no canvas'
        });

        // キャンバスをクリア
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        if (!results.hands || results.hands.length === 0) {
            if (this.gestureOutput) {
                this.gestureOutput.textContent = '検知中...';
            }
            if (this.coverStatusOutput) {
                this.coverStatusOutput.textContent = '検知中...';
            }
            console.log('No hands detected - clearing canvas');
            return;
        }

        console.log('Processing', results.hands.length, 'detected hands');

        // 手が検知された場合の処理
        for (let i = 0; i < results.hands.length; i++) {
            const landmarks = results.hands[i];
            const handedness = results.handedness[i]?.label || 'Unknown';

            console.log(`Processing hand ${i + 1}:`, {
                landmarkCount: landmarks ? landmarks.length : 0,
                handedness: handedness,
                firstLandmark: landmarks && landmarks.length > 0 ? landmarks[0] : 'none'
            });

            if (landmarks && landmarks.length > 0) {
                // 手の描画を先に実行
                this.drawLandmarks(landmarks);

                // ジェスチャーを検知
                const gesture = this.detectGesture(landmarks);
                if (gesture) {
                    console.log('Gesture detected in content script:', gesture);
                    this.displayGesture(gesture, handedness);
                    await this.executeGestureAction(gesture);
                }
            } else {
                console.warn('Invalid landmarks data for hand', i + 1);
            }
        }
    }

    private createOverlay(): void {
        // オーバーレイコンテナを作成
        this.overlay = document.createElement('div');
        this.overlay.id = 'gesture-call-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 180px;
            height: 120px;
            z-index: 10000;
            border: 2px solid #007cba;
            border-radius: 8px;
            overflow: hidden;
            background-color: black;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            opacity: 0.2;
            pointer-events: none;
            transition: opacity 0.2s ease-in-out;
        `;

        // ビデオ要素を作成
        this.video = document.createElement('video');
        this.video.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
        `;
        this.video.autoplay = true;
        this.video.playsInline = true;
        this.video.muted = true;

        // カバーdivを作成（透過度1.0 = 完全透明）
        this.coverDiv = document.createElement('div');
        this.coverDiv.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: black;
            opacity: 1.0;
            pointer-events: none;
            z-index: 1;
            transition: opacity 0.2s ease-in-out;
        `;

        // カバー内のステータス出力要素を作成
        this.coverStatusOutput = document.createElement('div');
        this.coverStatusOutput.style.cssText = `
            position: absolute;
            bottom: 5px;
            left: 5px;
            right: 5px;
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 5px;
            font-size: 12px;
            text-align: center;
            border-radius: 3px;
            font-family: Arial, sans-serif;
            z-index: 2;
        `;
        this.coverStatusOutput.textContent = '検知中...';

        // キャンバス要素を作成
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        `;
        this.ctx = this.canvas.getContext('2d');

        // ジェスチャー出力要素を作成
        this.gestureOutput = document.createElement('div');
        this.gestureOutput.style.cssText = `
            position: absolute;
            bottom: 5px;
            left: 5px;
            right: 5px;
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 5px;
            font-size: 12px;
            text-align: center;
            border-radius: 3px;
            font-family: Arial, sans-serif;
        `;
        this.gestureOutput.textContent = '検知中...';

        // 要素を組み立て
        this.overlay.appendChild(this.video);
        this.coverDiv.appendChild(this.coverStatusOutput);
        this.overlay.appendChild(this.coverDiv);
        this.overlay.appendChild(this.canvas);
        this.overlay.appendChild(this.gestureOutput);
        
        // カバーの表示状態を適用（初期値はON）
        if (this.settings.coverVisible === undefined) {
            this.settings.coverVisible = true;
        }
        this.updateCoverVisibility();


        // ページに追加
        document.body.appendChild(this.overlay);
    }

    private removeOverlay(): void {
        if (this.overlay) {
            document.body.removeChild(this.overlay);
            this.overlay = null;
            this.video = null;
            this.coverDiv = null;
            this.coverStatusOutput = null;
            this.canvas = null;
            this.ctx = null;
            this.gestureOutput = null;
        }
    }

    private toggleCover(visible?: boolean): void {
        if (visible !== undefined) {
            this.settings.coverVisible = visible;
        } else {
            this.settings.coverVisible = !this.settings.coverVisible;
        }
        this.updateCoverVisibility();
    }

    private updateCoverVisibility(): void {
        if (this.coverDiv) {
            const isVisible = this.settings.coverVisible !== false; // デフォルトはtrue
            this.coverDiv.style.display = isVisible ? 'block' : 'none';
            // カバーが非表示の場合は、カバーのステータスも非表示にする
            if (this.coverStatusOutput) {
                this.coverStatusOutput.style.display = isVisible ? 'block' : 'none';
            }
        }
    }


    private async setupCamera(): Promise<void> {
        if (!this.video) throw new Error('Video element not found');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: 180, 
                    height: 120,
                    facingMode: 'user'
                }
            });

            this.mediaStream = stream;
            this.video.srcObject = stream;
            
            return new Promise((resolve, reject) => {
                if (!this.video) {
                    reject(new Error('Video element is null'));
                    return;
                }
                
                this.video.addEventListener('loadedmetadata', () => {
                    this.resizeCanvas();
                    
                    // ジェスチャ検知用のタイマーを設定
                    this.startHandDetectionTimer();
                    
                    console.log('Camera setup completed - video is playing');
                    resolve(void 0);
                });

                this.video.addEventListener('error', reject);
            });

        } catch (error) {
            console.error('カメラアクセスエラー:', error);
            throw error;
        }
    }

    private startHandDetectionTimer(): void {
        if (this.detectionTimer) {
            clearInterval(this.detectionTimer);
        }
        
        this.detectionTimer = window.setInterval(() => {
            if (this.isActive && this.video) {
                console.log('Processing hand detection frame at:', new Date().toLocaleTimeString());
                this.captureFrameAndSendToOffscreen();
            }
        }, this.PROCESS_INTERVAL);
        
        console.log('Hand detection timer started with interval:', this.PROCESS_INTERVAL);
    }

    private stopHandDetectionTimer(): void {
        if (this.detectionTimer) {
            clearInterval(this.detectionTimer);
            this.detectionTimer = null;
            console.log('Hand detection timer stopped');
        }
    }

    private captureFrameAndSendToOffscreen(): void {
        if (!this.canvas || !this.ctx || !this.video) {
            console.warn('Missing elements for frame capture:', {
                hasCanvas: !!this.canvas,
                hasCtx: !!this.ctx,
                hasVideo: !!this.video
            });
            return;
        }

        console.log('Capturing frame - video ready:', this.video.readyState, 'video size:', this.video.videoWidth + 'x' + this.video.videoHeight);

        try {
            // ビデオフレームをCanvasに描画
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // CanvasをBase64に変換
            const imageData = this.canvas.toDataURL('image/jpeg', 0.8);
            
            console.log('Frame captured, data length:', imageData.length, 'sending to offscreen...');
            
            // オフスクリーンドキュメントに送信
            chrome.runtime.sendMessage({
                action: 'processFrame',
                imageData: imageData
            }).then((response) => {
                console.log('Frame processing response:', response);
            }).catch((error) => {
                console.warn('Failed to send frame to offscreen:', error);
            });
            
        } catch (error) {
            console.warn('Frame capture failed:', error);
        }
    }

    private resizeCanvas(): void {
        if (!this.canvas || !this.video) return;
        
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
    }

    private onResults(results: HandResults): void {
        if (!this.ctx || !this.canvas) return;

        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                const handedness = results.multiHandedness[i];

                // 手の骨格を描画
                this.drawLandmarks(landmarks);

                // ジェスチャーを検知してアクション実行
                const gesture = this.detectGesture(landmarks);
                if (gesture) {
                    this.displayGesture(gesture, handedness.label);
                    this.executeGestureAction(gesture);
                }
            }
        } else {
            if (this.gestureOutput) {
                this.gestureOutput.textContent = '検知中...';
            }
            if (this.coverStatusOutput) {
                this.coverStatusOutput.textContent = '検知中...';
            }
        }

        this.ctx.restore();
    }

    private drawLandmarks(landmarks: any[]): void {
        if (!this.ctx || !landmarks || landmarks.length === 0) {
            console.warn('Cannot draw landmarks: missing context, landmarks, or empty landmarks', {
                hasCtx: !!this.ctx,
                hasLandmarks: !!landmarks,
                landmarkCount: landmarks ? landmarks.length : 0
            });
            return;
        }

        console.log('Attempting to draw landmarks:', {
            landmarkCount: landmarks.length,
            hasDrawConnectors: !!drawConnectors,
            hasDrawLandmarks: !!drawLandmarks,
            hasHandConnections: !!HAND_CONNECTIONS
        });

        try {
            // キャンバスサイズを確認
            if (this.canvas && (this.canvas.width === 0 || this.canvas.height === 0)) {
                console.warn('Canvas has zero dimensions:', this.canvas.width, 'x', this.canvas.height);
                return;
            }

            // 手の関節を線で描画
            if (drawConnectors && HAND_CONNECTIONS) {
                console.log('Drawing connectors...');
                drawConnectors(this.ctx, landmarks, HAND_CONNECTIONS, {
                    color: '#00FF00',
                    lineWidth: 2
                });
                console.log('Connectors drawn successfully');
            } else {
                console.warn('Cannot draw connectors:', {
                    hasDrawConnectors: !!drawConnectors,
                    hasHandConnections: !!HAND_CONNECTIONS
                });
            }

            // 手のランドマークを点で描画
            if (drawLandmarks) {
                console.log('Drawing landmarks...');
                drawLandmarks(this.ctx, landmarks, {
                    color: '#FF0000',
                    lineWidth: 2,
                    radius: 3
                });
                console.log('Landmarks drawn successfully');
            } else {
                console.warn('Cannot draw landmarks: drawLandmarks function not available');
            }
            
            console.log('Hand landmarks drawing completed, count:', landmarks.length);
        } catch (error) {
            console.error('Drawing landmarks failed:', error);
        }
    }

    private detectGesture(landmarks: Landmark[]): string | null {
        const fingers = this.getFingersUp(landmarks);

        // 手を挙げる（手のひらを開いている）
        if (fingers.every(finger => finger === 1)) {
            return '手を挙げました';
        }

        // 人差し指を上げる（人差し指のみ）
        if (fingers[1] === 1 && fingers[0] === 0 && fingers[2] === 0 && fingers[3] === 0 && fingers[4] === 0) {
            return '人差し指を上げました';
        }

        // 親指を上げる（親指のみ）
        if (fingers[0] === 1 && fingers[1] === 0 && fingers[2] === 0 && fingers[3] === 0 && fingers[4] === 0) {
            return '親指を上げました';
        }

        return null;
    }

    private getFingersUp(landmarks: Landmark[]): number[] {
        const fingerTips = [4, 8, 12, 16, 20];
        const fingerPips = [3, 6, 10, 14, 18];
        const fingerMcp = [2, 5, 9, 13, 17];

        const fingers: number[] = [];

        // 親指の判定
        const wrist = landmarks[0];
        const thumbMcp = landmarks[2];
        const thumbTip = landmarks[4];
        const thumbPip = landmarks[3];

        const thumbDistance = Math.abs(thumbTip.x - wrist.x);
        const thumbMcpDistance = Math.abs(thumbMcp.x - wrist.x);
        const thumbIsExtended = thumbDistance > thumbMcpDistance * 1.3;
        const thumbIsUp = thumbTip.y < thumbPip.y;

        if (thumbIsExtended && thumbIsUp) {
            fingers.push(1);
        } else {
            fingers.push(0);
        }

        // その他の指
        for (let i = 1; i < 5; i++) {
            const tipY = landmarks[fingerTips[i]].y;
            const pipY = landmarks[fingerPips[i]].y;
            const mcpY = landmarks[fingerMcp[i]].y;

            if (tipY < pipY && tipY < mcpY * 0.9) {
                fingers.push(1);
            } else {
                fingers.push(0);
            }
        }

        return fingers;
    }

    private async executeGestureAction(gesture: string): Promise<void> {
        console.log('Executing gesture action:', gesture);
        
        // 設定を再読み込みして最新の値を取得
        await this.loadSettings();
        
        console.log('Current settings:', this.settings);
        console.log('Current URL:', window.location.href);
        
        switch (gesture) {
            case '手を挙げました':
                // URL遷移アクション
                if (this.settings.targetUrl) {
                    console.log('Target URL:', this.settings.targetUrl);
                    
                    // URLの判定ロジック
                    const currentUrl = window.location.href;
                    const targetUrl = this.settings.targetUrl;
                    const shouldNavigate = this.shouldNavigateToUrl(currentUrl, targetUrl);
                    
                    if (shouldNavigate) {
                        console.log('Navigating to target URL, preserving camera state');
                        
                        // ページ遷移前にカメラが動作していた場合、状態を保持
                        if (this.isActive) {
                            try {
                                const response = await chrome.runtime.sendMessage({ action: 'getCurrentTabId' });
                                if (response.tabId) {
                                    const result = await chrome.storage.sync.get(['cameraActiveForTabs']);
                                    const cameraActiveForTabs = result.cameraActiveForTabs || {};
                                    cameraActiveForTabs[response.tabId] = true;
                                    await chrome.storage.sync.set({ cameraActiveForTabs: cameraActiveForTabs });
                                    console.log('Camera state preserved for navigation');
                                }
                            } catch (error) {
                                console.error('Failed to preserve camera state:', error);
                            }
                        }
                        
                        window.location.href = targetUrl;
                    } else {
                        console.log('Already on target domain/URL, checking for click action');
                        // 同じドメイン/URLの場合、セレクタがあればクリック実行
                        if (this.settings.clickSelector) {
                            console.log('Executing click action');
                            this.executeClickAction();
                        } else {
                            console.log('No click selector configured');
                        }
                    }
                } else {
                    console.log('No target URL configured');
                }
                break;
            case '人差し指を上げました':
                // クリックアクション
                console.log('Executing click action for index finger');
                this.executeClickAction();
                break;
            case '親指を上げました':
                // 音声停止アクション
                if (this.settings.stopSelector) {
                    console.log('Executing stop action');
                    this.executeStopAction();
                } else {
                    console.log('No stop selector configured');
                }
                break;
        }
    }

    private executeClickAction(): void {
        if (!this.settings.clickSelector) return;

        try {
            const elements = document.querySelectorAll(this.settings.clickSelector);
            if (elements.length > 0) {
                const element = elements[0] as HTMLElement;
                element.click();
                console.log(`要素をクリックしました: ${this.settings.clickSelector}`);
            }
        } catch (error) {
            console.error('クリックアクションの実行に失敗:', error);
        }
    }

    private executeStopAction(): void {
        if (!this.settings.stopSelector) return;

        try {
            const elements = document.querySelectorAll(this.settings.stopSelector);
            if (elements.length > 0) {
                const element = elements[0] as HTMLElement;
                element.click();
                console.log(`音声停止要素をクリックしました: ${this.settings.stopSelector}`);
            }
        } catch (error) {
            console.error('音声停止アクションの実行に失敗:', error);
        }
    }

    private shouldNavigateToUrl(currentUrl: string, targetUrl: string): boolean {
        try {
            const current = new URL(currentUrl);
            const target = new URL(targetUrl);
            
            console.log('URL comparison:', {
                currentDomain: current.hostname,
                targetDomain: target.hostname,
                currentPath: current.pathname,
                targetPath: target.pathname
            });
            
            // ChatGPTのドメインの場合は、ドメインが同じであれば遷移しない
            if (target.hostname === 'chatgpt.com' || target.hostname === 'chat.openai.com') {
                const sameDomain = current.hostname === target.hostname;
                console.log('ChatGPT domain detected, same domain:', sameDomain);
                return !sameDomain; // 同じドメインの場合は遷移しない
            }
            
            // その他のサイトの場合は完全なURLマッチで判定
            const sameUrl = currentUrl === targetUrl;
            console.log('Non-ChatGPT domain, same URL:', sameUrl);
            return !sameUrl; // 同じURLの場合は遷移しない
            
        } catch (error) {
            console.error('URL parsing error:', error);
            // URLの解析に失敗した場合は文字列比較にフォールバック
            return currentUrl !== targetUrl;
        }
    }

    private displayGesture(gesture: string, handedness: string): void {
        if (!this.gestureOutput) return;

        const hand = handedness === 'Left' ? '左手' : '右手';
        const statusText = `${hand}: ${gesture}`;
        
        // 通常のステータス出力を更新
        this.gestureOutput.textContent = statusText;
        this.gestureOutput.style.backgroundColor = 'rgba(0, 255, 0, 0.8)';

        // カバーのステータス出力も更新
        if (this.coverStatusOutput) {
            this.coverStatusOutput.textContent = statusText;
            this.coverStatusOutput.style.backgroundColor = 'rgba(0, 255, 0, 0.8)';
        }

        setTimeout(() => {
            if (this.gestureOutput) {
                this.gestureOutput.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            }
            if (this.coverStatusOutput) {
                this.coverStatusOutput.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            }
        }, 2000);
    }

}

// コンテンツスクリプトが読み込まれたら初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ExtensionGestureDetector();
    });
} else {
    new ExtensionGestureDetector();
}

})(); // 名前空間の終了