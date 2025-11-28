// Background Script - オフスクリーンドキュメントの管理

let offscreenDocumentCreated = false;

// 拡張機能起動時の初期化
chrome.runtime.onStartup.addListener(() => {
    console.log('Gesture Call extension started');
});

// オフスクリーンドキュメントを作成
async function createOffscreenDocument(): Promise<void> {
    if (offscreenDocumentCreated) return;

    try {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: [chrome.offscreen.Reason.WORKERS],
            justification: 'MediaPipe hand detection processing'
        });
        offscreenDocumentCreated = true;
        console.log('Offscreen document created successfully');
    } catch (error) {
        console.error('Failed to create offscreen document:', error);
    }
}

// オフスクリーンドキュメントを削除
async function closeOffscreenDocument(): Promise<void> {
    if (!offscreenDocumentCreated) return;

    try {
        await chrome.offscreen.closeDocument();
        offscreenDocumentCreated = false;
        console.log('Offscreen document closed');
    } catch (error) {
        console.error('Failed to close offscreen document:', error);
    }
}

// Content ScriptとOffscreen間のメッセージルーティング
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background Script received message:', message.action, 'from sender:', sender);
    
    switch (message.action) {
        case 'initializeHandDetection':
            handleInitializeHandDetection().then(sendResponse);
            return true; // 非同期レスポンス
            
        case 'processFrame':
            handleProcessFrame(message.imageData).then(sendResponse);
            return true; // 非同期レスポンス
            
        case 'stopHandDetection':
            handleStopHandDetection().then(sendResponse);
            return true; // 非同期レスポンス
            
        case 'handDetectionResults':
            handleHandDetectionResults(message.results, sender).then(sendResponse);
            return true; // 非同期レスポンス
            
        default:
            console.warn('Unknown action in background script:', message.action);
            sendResponse({ success: false, error: 'Unknown action' });
    }
});

async function handleInitializeHandDetection(): Promise<any> {
    try {
        await createOffscreenDocument();
        
        // オフスクリーンドキュメントに初期化メッセージを送信
        const response = await chrome.runtime.sendMessage({
            target: 'offscreen',
            action: 'initializeHandDetection'
        });
        
        return { success: true, data: response };
    } catch (error) {
        console.error('Failed to initialize hand detection:', error);
        return { success: false, error: (error as Error).message };
    }
}

async function handleProcessFrame(imageData: string): Promise<any> {
    try {
        const response = await chrome.runtime.sendMessage({
            target: 'offscreen',
            action: 'processFrame',
            imageData: imageData
        });
        
        return { success: true, data: response };
    } catch (error) {
        console.error('Failed to process frame:', error);
        return { success: false, error: (error as Error).message };
    }
}

async function handleStopHandDetection(): Promise<any> {
    try {
        await chrome.runtime.sendMessage({
            target: 'offscreen',
            action: 'stopHandDetection'
        });
        
        await closeOffscreenDocument();
        return { success: true };
    } catch (error) {
        console.error('Failed to stop hand detection:', error);
        return { success: false, error: (error as Error).message };
    }
}

async function handleHandDetectionResults(results: any, sender: chrome.runtime.MessageSender): Promise<any> {
    try {
        console.log('Forwarding hand detection results to content scripts:', results);
        
        // 全ての通常のタブを取得してContent Scriptに結果を転送
        const tabs = await chrome.tabs.query({});
        const validTabs = tabs.filter(tab => tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://'));
        
        if (validTabs.length > 0) {
            // 有効なタブすべてに結果を送信（カメラが有効なタブのみが応答する）
            const sendPromises = validTabs.map(async (tab) => {
                try {
                    await chrome.tabs.sendMessage(tab.id!, {
                        action: 'handDetectionResults',
                        results: results
                    });
                    return { tabId: tab.id, success: true };
                } catch (error) {
                    // タブにContent Scriptが注入されていない場合は無視
                    return { tabId: tab.id, success: false, error };
                }
            });
            
            const sendResults = await Promise.allSettled(sendPromises);
            const successCount = sendResults.filter(result => 
                result.status === 'fulfilled' && result.value.success
            ).length;
            
            console.log(`Hand detection results sent to ${successCount} tabs`);
            return { success: true, tabsSent: successCount };
        } else {
            console.warn('No valid tabs found to forward results');
            return { success: false, error: 'No valid tabs' };
        }
    } catch (error) {
        console.error('Failed to forward hand detection results:', error);
        return { success: false, error: (error as Error).message };
    }
}