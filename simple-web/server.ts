import express from 'express';
import path from 'path';

const app = express();
const PORT = 8000;

// 静的ファイルを配信
app.use(express.static(path.join(__dirname)));

// ルートへのアクセス時にindex.htmlを返す
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`サーバーを起動しました: http://localhost:${PORT}`);
    console.log('ブラウザでアクセスしてください');
    console.log('終了するには Ctrl+C を押してください');
});

// グレースフルシャットダウン
process.on('SIGINT', () => {
    console.log('\nサーバーを停止しています...');
    process.exit(0);
});