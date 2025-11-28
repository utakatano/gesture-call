// MediaPipe型定義
declare const Hands: any;
declare const Camera: any;
declare const drawConnectors: any;
declare const drawLandmarks: any;
declare const HAND_CONNECTIONS: any;

interface Landmark {
    x: number;
    y: number;
    z: number;
}

interface HandResults {
    multiHandLandmarks: Landmark[][];
    multiHandedness: { label: string; score: number }[];
}

class GestureDetector {
    private video: HTMLVideoElement;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private gestureOutput: HTMLElement;
    private status: HTMLElement;
    private hands: any;
    private camera: any;

    constructor() {
        this.video = document.getElementById('video') as HTMLVideoElement;
        this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.gestureOutput = document.getElementById('gestureOutput')!;
        this.status = document.getElementById('status')!;
        
        this.hands = new Hands({
            locateFile: (file: string) => {
                return `libs/${file}`;
            }
        });
        
        this.setupHands();
        this.setupCamera();
    }
    
    private setupHands(): void {
        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        this.hands.onResults((results: HandResults) => {
            this.onResults(results);
        });
    }
    
    private async setupCamera(): Promise<void> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: 1280, 
                    height: 720,
                    facingMode: 'user'
                }
            });
            
            this.video.srcObject = stream;
            this.video.addEventListener('loadedmetadata', () => {
                this.resizeCanvas();
                this.status.textContent = 'カメラ準備完了';
            });
            
            this.camera = new Camera(this.video, {
                onFrame: async () => {
                    await this.hands.send({image: this.video});
                },
                width: 1280,
                height: 720
            });
            
            this.camera.start();
            
        } catch (error) {
            console.error('カメラアクセスエラー:', error);
            this.status.textContent = 'カメラアクセスに失敗しました';
            this.gestureOutput.textContent = 'カメラを有効にしてください';
        }
    }
    
    private resizeCanvas(): void {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
    }
    
    private onResults(results: HandResults): void {
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                const handedness = results.multiHandedness[i];
                
                // 手の骨格を描画
                this.drawLandmarks(landmarks);
                
                // ジェスチャーを検知
                const gesture = this.detectGesture(landmarks);
                if (gesture) {
                    this.displayGesture(gesture, handedness.label);
                }
            }
        } else {
            this.gestureOutput.textContent = 'ジェスチャーを検知中...';
        }
        
        this.ctx.restore();
    }
    
    private drawLandmarks(landmarks: Landmark[]): void {
        // 手の骨格を描画
        drawConnectors(this.ctx, landmarks, HAND_CONNECTIONS, {
            color: '#00FF00',
            lineWidth: 2
        });
        
        drawLandmarks(this.ctx, landmarks, {
            color: '#FF0000',
            lineWidth: 1,
            radius: 2
        });
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
        // 各指の先端と関節の座標から指が立っているかを判定
        const fingerTips = [4, 8, 12, 16, 20];  // 各指の先端
        const fingerPips = [3, 6, 10, 14, 18];  // 各指の関節
        const fingerMcp = [2, 5, 9, 13, 17];   // 各指の付け根
        
        const fingers: number[] = [];
        
        // 親指の判定を改善
        // 手首(0)と親指の付け根(2)、親指の先端(4)の位置関係で判定
        const wrist = landmarks[0];
        const thumbMcp = landmarks[2];
        const thumbTip = landmarks[4];
        const thumbPip = landmarks[3];
        
        // 親指が手のひらより外側に出ているかと、上向きかを両方チェック
        const thumbDistance = Math.abs(thumbTip.x - wrist.x);
        const thumbMcpDistance = Math.abs(thumbMcp.x - wrist.x);
        const thumbIsExtended = thumbDistance > thumbMcpDistance * 1.3;
        const thumbIsUp = thumbTip.y < thumbPip.y;
        
        if (thumbIsExtended && thumbIsUp) {
            fingers.push(1);
        } else {
            fingers.push(0);
        }
        
        // その他の指（Y座標で判定、より厳密に）
        for (let i = 1; i < 5; i++) {
            // 指先が関節より上にあり、かつ付け根より十分上にある
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
    
    private displayGesture(gesture: string, handedness: string): void {
        const hand = handedness === 'Left' ? '左手' : '右手';
        this.gestureOutput.textContent = `${hand}: ${gesture}`;
        this.gestureOutput.style.backgroundColor = 'rgba(0, 255, 0, 0.7)';
        
        // 2秒後に元の色に戻す
        setTimeout(() => {
            this.gestureOutput.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        }, 2000);
    }
}

// ページ読み込み完了後に開始
document.addEventListener('DOMContentLoaded', () => {
    new GestureDetector();
});