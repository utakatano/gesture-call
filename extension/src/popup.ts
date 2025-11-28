// ポップアップスクリプト - 拡張機能の設定UI

interface PopupExtensionSettings {
    targetUrl: string;
    clickSelector: string;
    cameraActive: boolean;
}

class PopupController {
    private targetUrlInput: HTMLInputElement;
    private clickSelectorInput: HTMLInputElement;
    private startCameraBtn: HTMLButtonElement;
    private stopCameraBtn: HTMLButtonElement;
    private cameraStatus: HTMLElement;

    constructor() {
        this.targetUrlInput = document.getElementById('targetUrl') as HTMLInputElement;
        this.clickSelectorInput = document.getElementById('clickSelector') as HTMLInputElement;
        this.startCameraBtn = document.getElementById('startCamera') as HTMLButtonElement;
        this.stopCameraBtn = document.getElementById('stopCamera') as HTMLButtonElement;
        this.cameraStatus = document.getElementById('cameraStatus')!;

        this.initialize();
    }

    private async initialize(): Promise<void> {
        // 保存された設定を読み込み
        await this.loadSettings();
        
        // イベントリスナーを設定
        this.setupEventListeners();
        
        // 現在の状態を更新
        await this.updateStatus();
    }

    private setupEventListeners(): void {
        // URL・セレクタ入力の保存
        this.targetUrlInput.addEventListener('blur', () => this.saveSettings());
        this.clickSelectorInput.addEventListener('blur', () => this.saveSettings());

        // カメラ制御ボタン
        this.startCameraBtn.addEventListener('click', () => this.startCamera());
        this.stopCameraBtn.addEventListener('click', () => this.stopCamera());
    }

    private async loadSettings(): Promise<void> {
        try {
            const result = await chrome.storage.sync.get(['targetUrl', 'clickSelector']);
            
            this.targetUrlInput.value = result.targetUrl || '';
            this.clickSelectorInput.value = result.clickSelector || '';
        } catch (error) {
            console.error('設定の読み込みに失敗:', error);
        }
    }

    private async saveSettings(): Promise<void> {
        try {
            const settings: Partial<PopupExtensionSettings> = {
                targetUrl: this.targetUrlInput.value,
                clickSelector: this.clickSelectorInput.value
            };

            await chrome.storage.sync.set(settings);
        } catch (error) {
            console.error('設定の保存に失敗:', error);
        }
    }

    private async startCamera(): Promise<void> {
        try {
            // アクティブなタブを取得
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const activeTab = tabs[0];

            if (!activeTab.id) {
                throw new Error('アクティブなタブが見つかりません');
            }

            // コンテンツスクリプトにカメラ開始を指示
            await chrome.tabs.sendMessage(activeTab.id, {
                action: 'startCamera'
            });

            // 設定を保存
            await chrome.storage.sync.set({ cameraActive: true });
            
            await this.updateStatus();
        } catch (error) {
            console.error('カメラ開始に失敗:', error);
            this.showError('カメラの開始に失敗しました');
        }
    }

    private async stopCamera(): Promise<void> {
        try {
            // アクティブなタブを取得
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const activeTab = tabs[0];

            if (!activeTab.id) {
                throw new Error('アクティブなタブが見つかりません');
            }

            // コンテンツスクリプトにカメラ停止を指示
            await chrome.tabs.sendMessage(activeTab.id, {
                action: 'stopCamera'
            });

            // 設定を保存
            await chrome.storage.sync.set({ cameraActive: false });
            
            await this.updateStatus();
        } catch (error) {
            console.error('カメラ停止に失敗:', error);
            this.showError('カメラの停止に失敗しました');
        }
    }

    private async updateStatus(): Promise<void> {
        try {
            const result = await chrome.storage.sync.get(['cameraActive']);
            const isActive = result.cameraActive || false;

            this.cameraStatus.textContent = isActive ? 'カメラ動作中' : 'カメラ停止中';
            this.cameraStatus.className = `status ${isActive ? 'active' : 'inactive'}`;

            // ボタンの状態を更新
            this.startCameraBtn.disabled = isActive;
            this.stopCameraBtn.disabled = !isActive;
        } catch (error) {
            console.error('ステータス更新に失敗:', error);
        }
    }

    private showError(message: string): void {
        this.cameraStatus.textContent = message;
        this.cameraStatus.className = 'status inactive';
    }
}

// ポップアップが読み込まれたら初期化
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});