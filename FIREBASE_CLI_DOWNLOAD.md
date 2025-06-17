# Firebase CLI 一括ダウンロード手順

## 概要
Firebase Consoleの UI では フォルダの一括ダウンロードができないため、Firebase CLI を使用して効率的にダウンロードします。

## 手順

### 1. Firebase CLI インストール
```bash
npm install -g firebase-tools
```

### 2. Firebase にログイン
```bash
firebase login
```
ブラウザが開き、Googleアカウントでログインします。

### 3. プロジェクトを設定
```bash
cd /path/to/your/directory
firebase use physics-quiz-app
```

### 4. ファイルダウンロード

#### 特定のテストコードのデータをダウンロード
```bash
firebase storage:download gs://physics-quiz-app.firebasestorage.app/submissions/ACOC92/ --recursive --dest ./downloads/
```

#### すべての提出データを一括ダウンロード
```bash
firebase storage:download gs://physics-quiz-app.firebasestorage.app/submissions/ --recursive --dest ./downloads/
```

### 5. 結果
`./downloads/` フォルダに以下の構造でファイルがダウンロードされます：
```
downloads/
├── submissions/
│   ├── ACOC92/
│   │   ├── 1123/
│   │   │   ├── question1.png
│   │   │   └── metadata.json
│   │   └── 5678/
│   └── 他のテストコード/
```

## トラブルシューティング

### Firebase CLI が見つからない場合
```bash
# Node.js をインストール後
npm install -g firebase-tools
```

### 権限エラーの場合
```bash
firebase login --reauth
```

## 個別ファイルダウンロードの場合
Firebase Console で以下の手順：
1. Storage → ファイル
2. submissions → テストコード → 学籍番号
3. 各ファイルをクリックしてダウンロード 