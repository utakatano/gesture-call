// ポップアップスクリプト - 拡張機能の設定UI

interface PopupExtensionSettings {
    targetUrl: string;
    clickSelector: string;
    stopSelector: string;
    cameraActive: boolean;
    coverVisible: boolean;
    cameraActiveForTabs: { [tabId: number]: boolean };
}

class PopupController {
    private targetUrlInput: HTMLInputElement;
    private clickSelectorInput: HTMLInputElement;
    private stopSelectorInput: HTMLInputElement;
    private toggleCameraBtn: HTMLButtonElement;
    private privacyModeCheckbox: HTMLInputElement;

    constructor() {
        this.targetUrlInput = document.getElementById('targetUrl') as HTMLInputElement;
        this.clickSelectorInput = document.getElementById('clickSelector') as HTMLInputElement;
        this.stopSelectorInput = document.getElementById('stopSelector') as HTMLInputElement;
        this.toggleCameraBtn = document.getElementById('toggleCamera') as HTMLButtonElement;
        this.privacyModeCheckbox = document.getElementById('coverVisible') as HTMLInputElement;

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
        this.stopSelectorInput.addEventListener('blur', () => this.saveSettings());

        // カメラ制御ボタン
        this.toggleCameraBtn.addEventListener('click', () => this.toggleCamera());

        // プライバシーモードの切り替え
        this.privacyModeCheckbox.addEventListener('change', () => this.togglePrivacyMode());
    }

    private async loadSettings(): Promise<void> {
        try {
            const result = await chrome.storage.sync.get(['targetUrl', 'clickSelector', 'stopSelector', 'coverVisible']);
            console.log('Popup loaded settings:', result);
            
            this.targetUrlInput.value = result.targetUrl || 'https://chatgpt.com/';
            this.clickSelectorInput.value = result.clickSelector || 'button[aria-label=\'音声モードを開始する\']';
            this.stopSelectorInput.value = result.stopSelector || 'button[aria-label=\'End voice mode\']';
            
            // カバー表示の初期値をONに設定（未設定の場合）
            const coverVisibleWasUndefined = result.coverVisible === undefined;
            if (coverVisibleWasUndefined) {
                result.coverVisible = true;
            }
            this.privacyModeCheckbox.checked = result.coverVisible;
            
            console.log('Input values set to:', {
                targetUrl: this.targetUrlInput.value,
                clickSelector: this.clickSelectorInput.value,
                stopSelector: this.stopSelectorInput.value,
                coverVisible: this.privacyModeCheckbox.checked
            });
            
            // 初期値が設定された場合は自動保存
            if (!result.targetUrl || !result.clickSelector || !result.stopSelector || coverVisibleWasUndefined) {
                console.log('Setting initial values, saving...');
                await this.saveSettings();
            }
        } catch (error) {
            console.error('設定の読み込みに失敗:', error);
        }
    }

    private async saveSettings(): Promise<void> {
        try {
            const settings: Partial<PopupExtensionSettings> = {
                targetUrl: this.targetUrlInput.value,
                clickSelector: this.clickSelectorInput.value,
                stopSelector: this.stopSelectorInput.value,
                coverVisible: this.privacyModeCheckbox.checked
            };

            console.log('Saving settings:', settings);
            await chrome.storage.sync.set(settings);
            console.log('Settings saved successfully');
            
            // 保存後の確認
            const saved = await chrome.storage.sync.get(['targetUrl', 'clickSelector', 'stopSelector', 'coverVisible']);
            console.log('Verified saved settings:', saved);
        } catch (error) {
            console.error('設定の保存に失敗:', error);
        }
    }

    private async togglePrivacyMode(): Promise<void> {
        try {
            const visible = this.privacyModeCheckbox.checked;
            await this.saveSettings();
            
            // アクティブなタブを取得
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const activeTab = tabs[0];

            if (activeTab.id) {
                // コンテンツスクリプトにプライバシーモード状態を送信
                await chrome.tabs.sendMessage(activeTab.id, {
                    action: 'toggleCover',
                    visible: visible
                });
            }
        } catch (error) {
            console.error('プライバシーモードの切り替えに失敗:', error);
        }
    }

    private async toggleCamera(): Promise<void> {
        try {
            // アクティブなタブを取得
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const activeTab = tabs[0];

            if (!activeTab.id) {
                throw new Error('アクティブなタブが見つかりません');
            }

            // タブ固有の現在の状態を取得
            const result = await chrome.storage.sync.get(['cameraActiveForTabs']);
            const cameraActiveForTabs = result.cameraActiveForTabs || {};
            const isActive = cameraActiveForTabs[activeTab.id] || false;

            if (isActive) {
                // カメラ停止
                await chrome.tabs.sendMessage(activeTab.id, {
                    action: 'stopCamera'
                });
                // このタブの状態を停止に更新
                cameraActiveForTabs[activeTab.id] = false;
            } else {
                // カメラ開始
                await chrome.tabs.sendMessage(activeTab.id, {
                    action: 'startCamera'
                });
                // このタブの状態を開始に更新
                cameraActiveForTabs[activeTab.id] = true;
            }
            
            // タブ固有の状態を保存
            await chrome.storage.sync.set({ cameraActiveForTabs: cameraActiveForTabs });
            
            await this.updateStatus();
        } catch (error) {
            console.error('カメラの切り替えに失敗:', error);
            this.showError('カメラの切り替えに失敗しました');
        }
    }

    private async updateStatus(): Promise<void> {
        try {
            // アクティブなタブを取得
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const activeTab = tabs[0];

            if (!activeTab.id) {
                this.toggleCameraBtn.textContent = 'タブが見つかりません';
                this.toggleCameraBtn.disabled = true;
                return;
            }

            // タブ固有の状態を取得
            const result = await chrome.storage.sync.get(['cameraActiveForTabs', 'targetUrl']);
            const cameraActiveForTabs = result.cameraActiveForTabs || {};
            const isActive = cameraActiveForTabs[activeTab.id] || false;

            // ボタンのテキストとスタイルを更新
            this.toggleCameraBtn.textContent = isActive ? 'カメラ停止' : 'カメラ開始';
            this.toggleCameraBtn.className = isActive ? 'btn btn-danger' : 'btn btn-primary';
            this.toggleCameraBtn.disabled = false;
        } catch (error) {
            console.error('ステータス更新に失敗:', error);
        }
    }


    private showError(message: string): void {
        // エラーをコンソールに記録
        console.error('Error:', message);
        
        // ボタンを元の状態に戻す
        this.updateStatus();
    }
}

// ポップアップが読み込まれたら初期化
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});