// Offscreen Document - MediaPipe Hand Detection

// MediaPipe型定義
declare const Hands: any;
declare const MediaPipeCamera: any;

interface Landmark {
    x: number;
    y: number;
    z: number;
}

interface HandResults {
    multiHandLandmarks: Landmark[][];
    multiHandedness: { label: string; score: number }[];
}

class OffscreenHandDetector {
    private hands: any = null;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private isInitialized = false;

    constructor() {
        this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.setupMessageListener();
        console.log('OffscreenHandDetector initialized');
    }

    private setupMessageListener(): void {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // オフスクリーン宛のメッセージのみ処理
            if (message.target !== 'offscreen') {
                return;
            }

            switch (message.action) {
                case 'initializeHandDetection':
                    this.initializeHandDetection().then(sendResponse);
                    return true; // 非同期レスポンス

                case 'processFrame':
                    this.processFrame(message.imageData).then(sendResponse);
                    return true; // 非同期レスポンス

                case 'stopHandDetection':
                    this.stopHandDetection();
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown offscreen action' });
            }
        });
    }

    private async initializeHandDetection(): Promise<any> {
        try {
            console.log('Initializing MediaPipe Hands in offscreen document...');

            this.hands = new Hands({
                locateFile: (file: string) => {
                    // オフスクリーンドキュメントでは相対パスが使える
                    const url = `libs/${file}`;
                    console.log(`MediaPipe locateFile: ${file} -> ${url}`);
                    return url;
                }
            });

            this.hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.3
            });

            this.hands.onResults((results: HandResults) => {
                // 結果をBackground Scriptに送信
                this.sendDetectionResults(results);
            });

            this.isInitialized = true;
            console.log('MediaPipe Hands initialized successfully in offscreen document');

            return { success: true, message: 'Hand detection initialized' };
        } catch (error) {
            console.error('Failed to initialize hand detection in offscreen:', error);
            return { success: false, error: (error as Error).message };
        }
    }

    private async processFrame(imageData: string): Promise<any> {
        if (!this.isInitialized || !this.hands) {
            console.warn('Hand detection not initialized for processing frame');
            return { success: false, error: 'Hand detection not initialized' };
        }

        try {
            console.log('Processing frame in offscreen document, data length:', imageData.length);
            
            // Base64画像データをCanvasに描画
            const img = new Image();
            img.onload = async () => {
                console.log('Image loaded in offscreen, size:', img.width, 'x', img.height);
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
                
                console.log('Sending image to MediaPipe Hands...');
                
                // MediaPipeで手の検知を実行
                await this.hands.send({ image: this.canvas });
                
                console.log('Frame sent to MediaPipe successfully');
            };
            
            img.onerror = (error) => {
                console.error('Failed to load image in offscreen:', error);
            };
            
            img.src = imageData;

            return { success: true, message: 'Frame processing started' };
        } catch (error) {
            console.error('Frame processing failed:', error);
            return { success: false, error: (error as Error).message };
        }
    }

    private stopHandDetection(): void {
        if (this.hands) {
            this.hands.close();
            this.hands = null;
        }
        this.isInitialized = false;
        console.log('Hand detection stopped in offscreen document');
    }

    private sendDetectionResults(results: HandResults): void {
        // 検知結果をContent Scriptに転送（Background Script経由）
        const processedResults = {
            hands: results.multiHandLandmarks || [],
            handedness: results.multiHandedness || [],
            timestamp: Date.now()
        };

        console.log('Hand detection results in offscreen:', {
            handCount: processedResults.hands.length,
            rawResults: results,
            processedResults: processedResults
        });

        // より詳細なログ
        if (processedResults.hands.length > 0) {
            console.log('Hands detected!', processedResults.hands.length, 'hands');
            for (let i = 0; i < processedResults.hands.length; i++) {
                const landmarks = processedResults.hands[i];
                console.log(`Hand ${i + 1} landmarks count:`, landmarks ? landmarks.length : 'undefined');
                if (landmarks && landmarks.length > 0) {
                    console.log(`Hand ${i + 1} first landmark:`, landmarks[0]);
                }
                const gesture = this.detectGesture(landmarks);
                if (gesture) {
                    console.log('Gesture detected in offscreen:', gesture);
                }
            }
        } else {
            console.log('No hands detected in offscreen');
        }

        // Background Scriptに結果を送信
        console.log('Sending results to background script...');
        chrome.runtime.sendMessage({
            action: 'handDetectionResults',
            results: processedResults
        }).then((response) => {
            console.log('Results sent successfully, response:', response);
        }).catch((error) => {
            console.error('Failed to send detection results:', error);
        });
    }

    private detectGesture(landmarks: Landmark[]): string | null {
        // simple-webと同じジェスチャ検知ロジック
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
}

// オフスクリーンドキュメントが読み込まれたら初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new OffscreenHandDetector();
    });
} else {
    new OffscreenHandDetector();
}