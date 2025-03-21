const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'C:\Users\funct\OneDrive\ドキュメント\e-gate\data.json'); // ルートの data.json を参照

// 永続データの初期化（data.json から読み込み）
let data = { users: [], chatHistory: {} };
if (fs.existsSync(DATA_FILE)) {
  try {
    const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
    data = JSON.parse(fileContent);
  } catch (err) {
    console.error('Error reading data.json:', err);
  }
} else {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.use(express.json());

// ヘルパー：データの確実な保存
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// API エンドポイント

// ユーザー登録
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (data.users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'ユーザー名は既に存在します' });
  }
  const newUser = { username, password, birthday: null, approvedFriends: [], friendRequests: [] };
  data.users.push(newUser);
  saveData();
  res.json({ message: '登録成功', user: newUser });
});

// ログイン
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = data.users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ error: '認証失敗' });
  }
  res.json({ message: 'ログイン成功', user });
});

// ユーザー一覧取得
app.get('/users', (req, res) => {
  const { username } = req.query;
  const userList = data.users.filter(u => u.username !== username).map(u => u.username);
  res.json({ users: userList });
});

// 友達追加リクエスト送信
app.post('/sendFriendRequest', (req, res) => {
  const { from, to } = req.body;
  const target = data.users.find(u => u.username === to);
  if (!target) {
    return res.status(404).json({ error: '対象ユーザーが見つかりません' });
  }
  if (target.friendRequests.includes(from)) {
    return res.status(400).json({ error: '既にリクエストを送信済みです' });
  }
  target.friendRequests.push(from);
  saveData();
  res.json({ message: '友達追加リクエストを送信しました' });
});

// 友達リクエスト取得
app.get('/friendRequests', (req, res) => {
  const { username } = req.query;
  const user = data.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });
  res.json({ friendRequests: user.friendRequests });
});

// 友達リクエスト応答
app.post('/respondFriendRequest', (req, res) => {
  const { username, from, response } = req.body;
  const user = data.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });
  const index = user.friendRequests.indexOf(from);
  if (index === -1) return res.status(400).json({ error: 'リクエストが存在しません' });
  user.friendRequests.splice(index, 1);
  let replyMsg = '';
  if (response === 'accept') {
    if (!user.approvedFriends.includes(from)) {
      user.approvedFriends.push(from);
    }
    const fromUser = data.users.find(u => u.username === from);
    if (fromUser && !fromUser.approvedFriends.includes(username)) {
      fromUser.approvedFriends.push(username);
    }
    replyMsg = '友達追加リクエストを承認しました';
    res.json({ message: replyMsg });
  } else {
    replyMsg = '友達追加リクエストを拒否しました';
    res.json({ message: replyMsg });
  }
  saveData();
});

// 承認済み友達一覧取得
app.get('/approvedFriends', (req, res) => {
  const { username } = req.query;
  const user = data.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });
  res.json({ approvedFriends: user.approvedFriends });
});

// ユーザー情報更新（設定）
app.post('/updateUser', (req, res) => {
  const { username, newUsername, newPassword, birthday } = req.body;
  const user = data.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });
  if (newUsername) user.username = newUsername;
  if (newPassword) user.password = newPassword;
  if (birthday) user.birthday = birthday;
  saveData();
  res.json({ message: 'ユーザー情報を更新しました', user });
});

// チャット履歴取得
app.get('/chatHistory', (req, res) => {
  const { user1, user2 } = req.query;
  if (!user1 || !user2) return res.status(400).json({ error: 'user1 and user2 are required' });
  const convKey = [user1, user2].sort().join('|');
  const history = data.chatHistory[convKey] || [];
  res.json({ chatHistory: history });
});

// ※ Netlify Functions では WebSocket 接続は通常の方法ではサポートされないため、以下は API 用のエンドポイントのみとなります。
// クライアント側はポーリングや再接続等でリアルタイム更新を実現する必要があります。

module.exports.handler = require('serverless-http')(app);
