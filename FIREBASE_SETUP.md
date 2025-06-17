# 🔥 Firebase Storage 設定手順

## 1. Firebase プロジェクト作成

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. 「プロジェクトを追加」をクリック
3. プロジェクト名を入力（例：`physics-quiz-app`）
4. Googleアナリティクスは無効でOK
5. 「プロジェクトを作成」をクリック

## 2. Firebase Storage 有効化

1. プロジェクトダッシュボードで「Storage」を選択
2. 「使ってみる」をクリック
3. セキュリティルールで「テストモードで開始」を選択
4. ロケーションを選択（日本：`asia-northeast1`推奨）
5. 「完了」をクリック

## 3. セキュリティルール設定

Storageのルールタブで以下に変更：

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // 提出フォルダ: 誰でも読み書き可能（学習用）
    match /submissions/{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

## 4. Web アプリ設定

1. プロジェクト設定（⚙️アイコン）→「全般」タブ
2. 「アプリを追加」→「Web」アプリを選択
3. アプリのニックネーム入力
4. 「アプリを登録」をクリック
5. 設定情報をコピー

## 5. アプリ設定ファイル更新

`app.js`の6行目付近の`firebaseConfig`を実際の設定に置き換える：

```javascript
// 現在（空の状態）
const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};

// ↓ 実際の設定に変更（例）
const firebaseConfig = {
    apiKey: "AIzaSyBxYYlG1RP0ZxFyZOuPQ3-YOUR-ACTUAL-KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:your-app-id"
};
```

⚠️ **重要**: Firebase Consoleの「プロジェクト設定」で表示される設定をそのままコピー&ペーストしてください。

## 6. 機能テスト

1. 学生として解答提出
2. 教員として「🔥 Firebase画像を一括ダウンロード」ボタンをクリック
3. ZIPファイルがダウンロードされることを確認

## フォルダ構造

```
Firebase Storage
└── submissions/
    ├── TEST001/
    │   ├── 20241001/
    │   │   ├── question1.png
    │   │   ├── question2.png
    │   │   └── metadata.json
    │   └── 20241002/
    └── TEST002/
```

## 💰 料金について

- **無料枠**: 1GB/月
- **画像ファイル**: 約50KB/枚
- **収容可能**: 約20,000枚/月

十分すぎる容量です！

## ⚠️ 注意事項

- 本番環境では適切なセキュリティルールを設定
- APIキーの管理に注意
- 定期的なデータバックアップを推奨 