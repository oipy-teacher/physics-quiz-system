// グローバル変数
let currentScreen = 'login';
let currentQuestionIndex = 0;
let startTime = null;
let timerInterval = null;
let violationCount = 0;
let studentId = '';
let testData = {
    answers: [],
    violations: []
};

// 新しいテストシステム用の変数
let currentStudentId = '';
let currentTestCode = '';
let currentTestData = null;
let testStartTime = null;
let userAnswers = [];
let isTabSwitched = false;
let isDevToolsOpen = false;

// 問題データ
let questions = [];
let answerExamples = []; // 解答例画像データ
let testEnabled = false;

// Canvas関連の変数
let canvas = null;
let ctx = null;
let isDrawing = false;
let currentTool = 'pen';
let penSize = 3;
let canvasData = [];
let inputMethod = 'canvas'; // 'canvas' または 'text'

// 採点関連の変数
let ocrResults = [];
let gradingResults = [];

// 管理者パスワード（実際の運用では環境変数やサーバー側で管理）
const ADMIN_PASSWORD = 'physics2024';

// 初期化
window.onload = function() {
    // ローカルストレージから問題データを読み込む
    loadSavedQuestions();
    
    // 学籍番号入力フィールドのイベント設定
    const studentIdInput = document.getElementById('studentId');
    if (studentIdInput) {
        studentIdInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                studentLogin();
            }
        });
    }

    // 管理者パスワード入力フィールドのイベント設定
    const adminPasswordInput = document.getElementById('adminPassword');
    if (adminPasswordInput) {
        adminPasswordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                adminLogin();
            }
        });
    }

    // Canvas初期化
    initCanvas();

    // 不正検知イベントの設定
    setupViolationDetection();
    
    // ドラッグ＆ドロップ設定
    setupDragAndDrop();
};

// ログイン切り替え
function showAdminLogin() {
    document.getElementById('studentLoginDiv').style.display = 'none';
    document.getElementById('adminLoginDiv').style.display = 'block';
    document.getElementById('adminPassword').focus();
}

function showStudentLogin() {
    document.getElementById('adminLoginDiv').style.display = 'none';
    document.getElementById('testCodeLoginDiv').style.display = 'none';
    document.getElementById('studentLoginDiv').style.display = 'block';
    document.getElementById('studentId').focus();
}

function showTestCodeLogin() {
    document.getElementById('studentLoginDiv').style.display = 'none';
    document.getElementById('testCodeLoginDiv').style.display = 'block';
    document.getElementById('adminLoginDiv').style.display = 'none';
    document.getElementById('testCodeInput').focus();
}

async function testCodeLogin() {
    const testCode = document.getElementById('testCodeInput').value.trim().toUpperCase();
    const studentIdInput = document.getElementById('studentIdForCode').value.trim();
    const errorDiv = document.getElementById('loginError');

    // バリデーション
    if (!/^[A-Z0-9]{6}$/.test(testCode)) {
        errorDiv.textContent = 'テストコードは6桁の英数字で入力してください';
        errorDiv.style.display = 'block';
        return;
    }

    if (!/^\d{4}$/.test(studentIdInput)) {
        errorDiv.textContent = '学籍番号は4桁の数字で入力してください';
        errorDiv.style.display = 'block';
        return;
    }

    // テストコードからデータを読み込み
    errorDiv.textContent = 'テストデータを読み込み中...';
    errorDiv.style.display = 'block';

    try {
        let data = null;
        
        // まずローカルストレージから確認（同一端末の場合）
        const testKey = `testCode_${testCode}`;
        const localData = localStorage.getItem(testKey);
        
        if (localData) {
            const parsedLocal = JSON.parse(localData);
            
            if (parsedLocal.questions) {
                data = parsedLocal;
                console.log('Data loaded from local storage:', data);
            } else if (parsedLocal.dataUrl) {
                // データURLがある場合は、そのURLにリダイレクト
                errorDiv.textContent = 'テストページにリダイレクト中...';
                window.location.href = parsedLocal.dataUrl;
                return;
            }
        }
        
        // データが見つからない場合の対処
        if (!data) {
            errorDiv.innerHTML = `
                <div style="text-align: left;">
                    <strong>テストコードが見つかりません。</strong><br><br>
                    <strong>解決方法：</strong><br>
                    1. 教員から受け取ったQRコードをスキャンしてください<br>
                    2. または、教員から受け取った完全なURLにアクセスしてください<br>
                    3. テストコードのみでは別端末からアクセスできません<br><br>
                    <em>※ QRコードまたは完全URLにテストデータが含まれています</em>
                </div>
            `;
            errorDiv.style.display = 'block';
            return;
        }
        
        if (!data.questions || data.questions.length === 0) {
            errorDiv.textContent = 'テストデータが無効です。教員に確認してください。';
            errorDiv.style.display = 'block';
            return;
        }

        // データを設定
        questions = data.questions;
        answerExamples = data.answerExamples || [];
        testEnabled = data.testEnabled || false;
        
        // 新しい変数にも設定
        currentStudentId = studentIdInput;
        currentTestCode = testCode;
        currentTestData = data;
        studentId = studentIdInput; // 後方互換性のため

        errorDiv.style.display = 'none';
        showScreen('test');
        startTest();
    } catch (error) {
        console.error('Test code login error:', error);
        errorDiv.textContent = 'テストデータの読み込みに失敗しました。ネットワーク接続を確認してください。';
        errorDiv.style.display = 'block';
    }
}

// 学生ログイン
async function studentLogin() {
    const inputId = document.getElementById('studentId').value;
    const errorDiv = document.getElementById('loginError');

    // 学籍番号入力を完全に無効化
    errorDiv.innerHTML = `
        <div style="text-align: left; background: #fff3cd; padding: 20px; border-radius: 8px; border: 1px solid #ffeaa7;">
            <h4 style="color: #856404; margin-top: 0;">⚠️ 学籍番号のみでの受験は無効です</h4>
            <p style="color: #856404; margin: 10px 0;">
                <strong>正しいアクセス方法：</strong>
            </p>
            <ol style="color: #856404; margin: 10px 0; padding-left: 20px;">
                <li><strong>教員から配布されたQRコードをスキャン</strong></li>
                <li><strong>または、教員から受け取った完全なURLにアクセス</strong></li>
            </ol>
            <p style="color: #856404; margin: 10px 0; font-size: 14px;">
                ※ セキュリティ上、学籍番号のみでの受験は禁止されています
            </p>
            <div style="margin-top: 15px;">
                <button onclick="showTestCodeLogin()" style="background: #007aff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                    📱 テストコードでログイン
                </button>
            </div>
        </div>
    `;
    errorDiv.style.display = 'block';
    return;
}

// 管理者ログイン
function adminLogin() {
    const password = document.getElementById('adminPassword').value;
    
    if (password === ADMIN_PASSWORD) {
        showScreen('admin');
        loadSavedQuestions();
    } else {
        showAdminError('パスワードが正しくありません。');
    }
}

// 画面切り替え
function showScreen(screen) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminScreen').style.display = 'none';
    document.getElementById('testScreen').style.display = 'none';
    document.getElementById('resultScreen').style.display = 'none';

    switch(screen) {
        case 'login':
            document.getElementById('loginScreen').style.display = 'flex';
            break;
        case 'admin':
            document.getElementById('adminScreen').style.display = 'block';
            break;
        case 'test':
            document.getElementById('testScreen').style.display = 'flex';
            // テスト画面表示時にCanvas初期化を確実に実行
            setTimeout(() => {
                console.log('Test screen displayed, initializing canvas...');
                initCanvas();
                setInputMethod('canvas');
            }, 200);
            break;
        case 'result':
            document.getElementById('resultScreen').style.display = 'flex';
            break;
    }
    currentScreen = screen;
}

// ========== 教員用機能 ==========

// 画像圧縮関数（localStorageの容量制限対策）
function compressImage(dataUrl, callback, quality = 0.3, maxWidth = 400, maxHeight = 300) {
    const img = new Image();
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // アスペクト比を保持してリサイズ
        let { width, height } = img;
        
        if (width > height) {
            if (width > maxWidth) {
                height = height * (maxWidth / width);
                width = maxWidth;
            }
        } else {
            if (height > maxHeight) {
                width = width * (maxHeight / height);
                height = maxHeight;
            }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // 画像を描画
        ctx.drawImage(img, 0, 0, width, height);
        
        // 圧縮されたデータURLを取得
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        
        console.log(`Image compressed: ${Math.round(dataUrl.length/1024)}KB → ${Math.round(compressedDataUrl.length/1024)}KB`);
        
        callback(compressedDataUrl);
    };
    img.src = dataUrl;
}

// ドラッグ＆ドロップ設定
function setupDragAndDrop() {
    // 問題画像のドラッグ＆ドロップ
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            handleFiles(e.dataTransfer.files);
        });
    }

    // 解答例画像のドラッグ＆ドロップ
    const answerUploadArea = document.getElementById('answerUploadArea');
    if (answerUploadArea) {
        answerUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            answerUploadArea.classList.add('dragover');
        });

        answerUploadArea.addEventListener('dragleave', () => {
            answerUploadArea.classList.remove('dragover');
        });

        answerUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            answerUploadArea.classList.remove('dragover');
            handleAnswerFiles(e.dataTransfer.files);
        });
    }
}

// ファイル選択
function selectFile() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.click();
    }
}

function handleFileSelect(event) {
    handleFiles(event.target.files);
}

// 解答例ファイル選択
function selectAnswerFile() {
    const fileInput = document.getElementById('answerFileInput');
    if (fileInput) {
        fileInput.click();
    }
}

function handleAnswerFileSelect(event) {
    handleAnswerFiles(event.target.files);
}

// ファイル処理
function handleFiles(files) {
    if (files.length === 0) return;

    for (let file of files) {
        if (!file.type.match(/image\/(jpeg|jpg|png)/)) {
            showAdminError('JPG、PNG形式の画像ファイルをアップロードしてください。');
            continue;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            // 画像を圧縮してからaddQuestion
            compressImage(e.target.result, (compressedImage) => {
                addQuestion(compressedImage);
            });
        };
        reader.readAsDataURL(file);
    }
}

// 解答例ファイル処理
function handleAnswerFiles(files) {
    if (files.length === 0) return;

    for (let file of files) {
        if (!file.type.match(/image\/(jpeg|jpg|png)/)) {
            showAdminError('JPG、PNG形式の画像ファイルをアップロードしてください。');
            continue;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            // 画像を圧縮してからaddAnswerExample
            compressImage(e.target.result, (compressedImage) => {
                addAnswerExample(compressedImage);
            });
        };
        reader.readAsDataURL(file);
    }
}

// 問題追加
function addQuestion(imageData) {
    // 容量チェック
    if (!checkStorageUsage()) {
        return;
    }
    
    const questionId = `q${questions.length + 1}`;
    const question = {
        id: questionId,
        number: questions.length + 1,
        image: imageData,
        patterns: []
    };

    questions.push(question);
    renderQuestionList();
    showAdminSuccess(`問題を追加しました (${Math.round(imageData.length/1024)}KB)。正解パターンを設定してください。`);
}

// 解答例追加
function addAnswerExample(imageData) {
    const answerExample = {
        id: Date.now(),
        image: imageData,
        questionIndex: answerExamples.length // 問題の順番に対応
    };
    
    answerExamples.push(answerExample);
    renderAnswerExampleList();
    showAdminSuccess('解答例画像を追加しました。');
}

// 解答例リスト表示
function renderAnswerExampleList() {
    // 既存の解答例表示エリアがあれば更新、なければ作成
    let container = document.getElementById('answerExampleList');
    if (!container) {
        container = document.createElement('div');
        container.id = 'answerExampleList';
        container.className = 'answer-example-list';
        
        const answerUploadArea = document.getElementById('answerUploadArea');
        if (answerUploadArea && answerUploadArea.parentNode) {
            answerUploadArea.parentNode.insertBefore(container, answerUploadArea.nextSibling);
        }
    }
    
    if (answerExamples.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = `
        <h3>アップロード済み解答例</h3>
        <div class="answer-example-grid">
            ${answerExamples.map((example, index) => `
                <div class="answer-example-item">
                    <div class="example-number">解答例 ${index + 1}</div>
                    <img src="${example.image}" class="example-image" alt="解答例${index + 1}">
                    <button onclick="removeAnswerExample(${index})" class="remove-example-btn">削除</button>
                </div>
            `).join('')}
        </div>
    `;
}

// 解答例削除
function removeAnswerExample(index) {
    if (confirm('この解答例を削除しますか？')) {
        answerExamples.splice(index, 1);
        renderAnswerExampleList();
        showAdminSuccess('解答例を削除しました。');
    }
}

// 問題リスト表示
function renderQuestionList() {
    const container = document.getElementById('questionList');
    if (!container) return;
    
    container.innerHTML = '';

    questions.forEach((question, index) => {
        const item = document.createElement('div');
        item.className = 'question-item';
        item.innerHTML = `
            <div class="question-number">${question.number}</div>
            <div class="question-content">
                <img src="${question.image}" class="question-image" alt="問題${question.number}">
                <div class="answer-patterns">
                    <h3>正解パターン（複数設定可能）</h3>
                    <div class="pattern-input-group">
                        <input type="text" class="pattern-input" id="patternInput_${question.id}" 
                               placeholder="例: 6N, 6, 6ニュートン" 
                               onkeypress="handlePatternKeyPress(event, '${question.id}')">
                        <button class="add-pattern-button" onclick="addPattern('${question.id}')">追加</button>
                    </div>
                    <div class="pattern-list" id="patterns_${question.id}">
                        ${renderPatterns(question)}
                    </div>
                </div>
                <button onclick="removeQuestion(${index})" style="background-color: #ff3b30; color: white; padding: 10px; border: none; border-radius: 8px; margin-top: 10px;">この問題を削除</button>
            </div>
        `;
        container.appendChild(item);
    });
}

// 正解パターン表示
function renderPatterns(question) {
    if (!question.patterns || question.patterns.length === 0) {
        return '<span style="color: #999;">正解パターンが設定されていません</span>';
    }

    return question.patterns.map((pattern, index) => `
        <div class="pattern-tag">
            <span>${pattern}</span>
            <button onclick="removePattern('${question.id}', ${index})" title="削除">×</button>
        </div>
    `).join('');
}

// Enterキー押下時の処理
function handlePatternKeyPress(event, questionId) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addPattern(questionId);
    }
}

// 正解パターン追加
function addPattern(questionId) {
    const input = document.getElementById(`patternInput_${questionId}`);
    if (!input) {
        console.error('Input element not found:', `patternInput_${questionId}`);
        return;
    }
    
    const pattern = input.value.trim();
    
    if (pattern === '') {
        showAdminError('正解パターンを入力してください。');
        return;
    }

    const question = questions.find(q => q.id === questionId);
    if (!question) {
        console.error('Question not found:', questionId);
        return;
    }
    
    // 重複チェック
    if (question.patterns.includes(pattern)) {
        showAdminError('同じパターンが既に登録されています。');
        return;
    }
    
    // パターンを追加
    question.patterns.push(pattern);
    input.value = '';
    
    // 表示を更新
    updatePatternDisplay(questionId, question);
    
    showAdminSuccess(`正解パターン「${pattern}」を追加しました。`);
}

// 正解パターン削除
function removePattern(questionId, patternIndex) {
    const question = questions.find(q => q.id === questionId);
    if (!question) {
        console.error('Question not found:', questionId);
        return;
    }
    
    if (patternIndex < 0 || patternIndex >= question.patterns.length) {
        console.error('Invalid pattern index:', patternIndex);
        return;
    }
    
    const removedPattern = question.patterns[patternIndex];
    question.patterns.splice(patternIndex, 1);
    
    // 表示を更新
    updatePatternDisplay(questionId, question);
    
    showAdminSuccess(`正解パターン「${removedPattern}」を削除しました。`);
}

// パターン表示のみを更新（全体を再描画しない）
function updatePatternDisplay(questionId, question) {
    const patternContainer = document.getElementById(`patterns_${questionId}`);
    if (patternContainer) {
        patternContainer.innerHTML = renderPatterns(question);
    }
}

// 問題削除
function removeQuestion(index) {
    if (confirm('この問題を削除しますか？')) {
        questions.splice(index, 1);
        // 問題番号を再設定
        questions.forEach((q, i) => {
            q.number = i + 1;
            q.id = `q${i + 1}`;
        });
        renderQuestionList();
        updateTestStatus();
        showAdminSuccess('問題を削除しました。');
    }
}

// 問題設定保存
async function saveQuestions() {
    if (questions.length === 0) {
        showAdminError('問題が設定されていません。');
        return;
    }

    // 全ての問題に正解パターンが設定されているかチェック
    const incompleteQuestions = questions.filter(q => !q.patterns || q.patterns.length === 0);
    if (incompleteQuestions.length > 0) {
        showAdminError(`問題${incompleteQuestions.map(q => q.number).join(', ')}に正解パターンが設定されていません。`);
        return;
    }

    // データを準備
    const dataToSave = {
        questions: questions,
        answerExamples: answerExamples,
        testEnabled: true,
        lastUpdated: new Date().toISOString(),
        teacherId: Date.now() // 教員セッションID
    };

    try {
        // ローカルストレージに保存
        localStorage.setItem('physicsQuizQuestions', JSON.stringify(questions));
        localStorage.setItem('physicsQuizAnswerExamples', JSON.stringify(answerExamples));
        localStorage.setItem('physicsQuizEnabled', 'true');
        localStorage.setItem('physicsQuizData', JSON.stringify(dataToSave));
        localStorage.setItem('physicsQuizTeacherId', dataToSave.teacherId.toString());

        testEnabled = true;
        
        showAdminSuccess('問題設定を保存しました。テストが受験可能になりました。');
        
        // 既存のテストコードがあるかチェック
        checkExistingTestCode(dataToSave);
        
        updateTestStatus();
    } catch (error) {
        showAdminError('保存に失敗しました。データが大きすぎる可能性があります。');
        console.error('Save error:', error);
    }
}

// 共有URL生成（GitHub Gist使用）
async function generateShareUrl(data) {
    try {
        const testCode = generateShortId();
        
        // Pastebin APIを使用（無料・認証不要・確実）
        const formData = new FormData();
        formData.append('api_dev_key', 'YOUR_API_KEY'); // 実際は不要
        formData.append('api_option', 'paste');
        formData.append('api_paste_code', JSON.stringify({
            ...data,
            created: new Date().toISOString(),
            testCode: testCode
        }));
        formData.append('api_paste_name', `physics-test-${testCode}`);
        formData.append('api_paste_expire_date', '1M'); // 1ヶ月で期限切れ
        formData.append('api_paste_private', '1'); // 非公開

        // データをBase64エンコードしてURLに埋め込み（真のクロスデバイス対応）
        const dataString = JSON.stringify({
            ...data,
            created: new Date().toISOString(),
            testCode: testCode
        });
        
        // Base64エンコードしてURLパラメータとして使用
        const encodedData = btoa(encodeURIComponent(dataString));
        
        // QRコードとURLに埋め込むため、データサイズを確認
        const dataUrl = `${window.location.origin}${window.location.pathname}?data=${encodedData}`;
        
        if (dataUrl.length > 2000) {
            // URLが長すぎる場合は圧縮を試行
            console.warn('Data URL is too long, may cause issues with QR codes');
        }
        
        // テストコードとデータの関連付けをローカルに保存（フォールバック用）
        localStorage.setItem(`testCode_${testCode}`, JSON.stringify({
            cloudSaved: true,
            encodedData: encodedData,
            testCode: testCode,
            created: new Date().toISOString(),
            dataUrl: dataUrl,
            ...data
        }));
        
        return { testCode, cloudSaved: true, encodedData: encodedData, dataUrl: dataUrl };
    } catch (error) {
        console.error('Share URL generation error:', error);
        // フォールバック：ローカルストレージのみ
        const testCode = generateShortId();
        localStorage.setItem(`testCode_${testCode}`, JSON.stringify(data));
        return { testCode, cloudSaved: false };
    }
}

// 短いID生成
function generateShortId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 既存のテストコードをチェック
function checkExistingTestCode(dataToSave) {
    // ローカルストレージから既存のテストコードを検索
    const existingCodes = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('testCode_')) {
            const testCode = key.replace('testCode_', '');
            const data = localStorage.getItem(key);
            if (data) {
                try {
                    const parsedData = JSON.parse(data);
                    // 有効なテストデータかチェック
                    if (parsedData.questions || parsedData.cloudSaved) {
                        existingCodes.push({
                            testCode: testCode,
                            data: parsedData,
                            hasCloud: !!parsedData.cloudSaved
                        });
                    }
                } catch (e) {
                    console.error('Invalid test code data:', key);
                }
            }
        }
    }
    
    if (existingCodes.length > 0) {
        // 既存のコードがある場合は選択肢を表示
        showTestCodeOptions(dataToSave, existingCodes);
            } else {
            // 既存のコードがない場合は新規作成
            generateShareUrl(dataToSave).then(shareResult => {
                showShareOptions(dataToSave, shareResult);
            }).catch(error => {
                console.error('Share generation error:', error);
                showShareOptions(dataToSave, { testCode: generateShortId(), cloudSaved: false });
            });
        }
}

// テストコード選択肢を表示
function showTestCodeOptions(dataToSave, existingCodes) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
    `;
    
    const existingCodesHtml = existingCodes.map(code => `
        <div style="border: 2px solid #007aff; border-radius: 10px; padding: 15px; margin: 10px 0; cursor: pointer; transition: background-color 0.3s;" 
             onclick="useExistingTestCode('${code.testCode}', ${JSON.stringify(dataToSave).replace(/"/g, '&quot;')})">
            <div style="font-size: 20px; font-weight: bold; color: #007aff;">${code.testCode}</div>
            <div style="font-size: 12px; color: #666;">
                ${code.hasCloud ? '☁️ クラウド保存済み' : '💾 ローカル保存のみ'}
            </div>
        </div>
    `).join('');
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; max-height: 80%; overflow: auto; text-align: center;">
            <h3>🔢 テストコード管理</h3>
            <p>既存のテストコードが見つかりました。どちらを使用しますか？</p>
            
            <div style="margin: 20px 0;">
                <h4>既存のテストコード：</h4>
                ${existingCodesHtml}
            </div>
            
            <div style="margin-top: 30px;">
                <button onclick="createNewTestCode(${JSON.stringify(dataToSave).replace(/"/g, '&quot;')})" 
                        style="background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 8px; margin: 5px; cursor: pointer;">
                    🆕 新しいコードを作成
                </button>
                <button onclick="closeTestCodeModal()" 
                        style="background: #666; color: white; border: none; padding: 12px 24px; border-radius: 8px; margin: 5px; cursor: pointer;">
                    キャンセル
                </button>
            </div>
        </div>
    `;
    
    modal.id = 'testCodeModal';
    document.body.appendChild(modal);
}

// 既存のテストコードを使用
function useExistingTestCode(testCode, dataToSave) {
    closeTestCodeModal();
    
    // 既存のコードのデータを更新
    const testKey = `testCode_${testCode}`;
    const existingData = localStorage.getItem(testKey);
    
    if (existingData) {
        try {
            const parsedData = JSON.parse(existingData);
            
            if (parsedData.cloudSaved) {
                // クラウド保存がある場合は更新（実際はローカル更新）
                localStorage.setItem(testKey, JSON.stringify({
                    ...dataToSave,
                    cloudSaved: true,
                    testCode: testCode,
                    updated: new Date().toISOString()
                }));
                showShareOptions(dataToSave, { testCode: testCode, cloudSaved: true });
            } else {
                // ローカルのみの場合はローカル更新
                localStorage.setItem(testKey, JSON.stringify(dataToSave));
                showShareOptions(dataToSave, { testCode: testCode, cloudSaved: false });
            }
        } catch (error) {
            console.error('Error using existing test code:', error);
            // エラーの場合は新規作成
            createNewTestCode(dataToSave);
        }
    } else {
        // データが見つからない場合は新規作成
        createNewTestCode(dataToSave);
    }
}

// 新しいテストコードを作成
function createNewTestCode(dataToSave) {
    closeTestCodeModal();
    
    generateShareUrl(dataToSave).then(shareResult => {
        showShareOptions(dataToSave, shareResult);
    }).catch(error => {
        console.error('Share generation error:', error);
        showShareOptions(dataToSave, { testCode: generateShortId(), cloudSaved: false });
    });
}

// データを更新（シンプルなローカル保存）
function updateLocalData(dataToSave, testCode) {
    try {
        localStorage.setItem(`testCode_${testCode}`, JSON.stringify({
            ...dataToSave,
            cloudSaved: true,
            testCode: testCode,
            updated: new Date().toISOString()
        }));
        
        showShareOptions(dataToSave, { testCode: testCode, cloudSaved: true });
    } catch (error) {
        console.error('Local update error:', error);
        showShareOptions(dataToSave, { testCode: testCode, cloudSaved: false });
    }
}

// テストコードモーダルを閉じる
function closeTestCodeModal() {
    const modal = document.getElementById('testCodeModal');
    if (modal) {
        modal.remove();
    }
}

// 共有オプション表示
function showShareOptions(data, shareResult) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
    `;
    
    const testCode = shareResult.testCode;
    const isCloudBased = shareResult.cloudSaved === true;
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 90%; max-height: 80%; overflow: auto; text-align: center;">
            <h3>🎉 テスト設定完了！</h3>
            
            <div style="margin: 30px 0;">
                <h4>📱 生徒への共有方法</h4>
                <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;">
                    
                    <!-- テストコード方式 -->
                    <div style="border: 2px solid #007aff; border-radius: 15px; padding: 20px; min-width: 250px;">
                        <h5 style="color: #007aff; margin-top: 0;">🔢 テストコード</h5>
                        <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <div style="font-size: 24px; font-weight: bold; color: #007aff; letter-spacing: 3px;">${testCode}</div>
                        </div>
                        <button onclick="copyTestCode('${testCode}')" style="background: #007aff; color: white; border: none; padding: 10px 20px; border-radius: 8px; width: 100%;">コードをコピー</button>
                        <div style="font-size: 12px; color: #666; margin-top: 10px;">
                            生徒は同じURLにアクセスして<br>このコードを入力
                        </div>
                    </div>
                    
                    <!-- QRコード方式 -->
                    <div style="border: 2px solid #28a745; border-radius: 15px; padding: 20px; min-width: 250px;">
                        <h5 style="color: #28a745; margin-top: 0;">📱 QRコード</h5>
                        <div id="qrcode" style="margin: 15px 0; display: flex; justify-content: center;"></div>
                        <button onclick="downloadQR()" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 8px; width: 100%;">QRコードを保存</button>
                        <div style="font-size: 12px; color: #666; margin-top: 10px;">
                            生徒はQRコードをスキャン
                        </div>
                    </div>
                    
                </div>
            </div>
            
            <div style="margin-top: 30px; padding: 15px; background: #e8f4fd; border-radius: 8px; font-size: 14px; text-align: left;">
                <strong>📋 使い方：</strong><br>
                <strong>🎯 推奨方法（QRコード）：</strong><br>
                1. QRコードを保存して生徒に共有<br>
                2. 生徒はスマホでQRコードをスキャン<br>
                3. 自動的にテストページが開く<br>
                <em>※ どの端末からでもアクセス可能</em><br><br>
                
                <strong>⚠️ テストコード方式の制限：</strong><br>
                • テストコードは同一端末でのみ有効<br>
                • 別端末からはQRコードまたは完全URLが必要<br>
                • クロスデバイス利用にはQRコードを推奨<br><br>
                
                ${isCloudBased ? 
                    '<strong>✅ クラウド保存：</strong> テストデータはクラウドに保存されているので、どの端末からでもアクセス可能です。' : 
                    '<strong>⚠️ ローカル保存：</strong> ネットワークエラーのため、この端末でのみアクセス可能です。'
                }
            </div>
            
            <div style="margin-top: 20px;">
                <button onclick="closeShareModal()" style="background: #666; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px;">閉じる</button>
            </div>
        </div>
    `;
    
    modal.id = 'shareModal';
    document.body.appendChild(modal);
    
    // QRコードを生成
    generateQRCode(testCode);
}

function copyTestCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        alert(`テストコード「${code}」をクリップボードにコピーしました！\n生徒にこのコードを伝えてください。`);
    }).catch(() => {
        // フォールバック
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert(`テストコード「${code}」をクリップボードにコピーしました！\n生徒にこのコードを伝えてください。`);
    });
}

// テストコード詳細表示
function showTestCodeDetails(testCode) {
    const testKey = `testCode_${testCode}`;
    const testData = localStorage.getItem(testKey);
    
    if (!testData) {
        alert('テストデータが見つかりません。');
        return;
    }
    
    try {
        const parsedData = JSON.parse(testData);
        const submissionKey = `submissions_${testCode}`;
        const submissions = JSON.parse(localStorage.getItem(submissionKey) || '[]');
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 15px; max-width: 600px; max-height: 80%; overflow: auto;">
                <h3>📝 テストコード詳細: ${testCode}</h3>
                <div style="margin: 20px 0;">
                    <p><strong>問題数:</strong> ${parsedData.questions ? parsedData.questions.length : 0}問</p>
                    <p><strong>作成日時:</strong> ${parsedData.created ? new Date(parsedData.created).toLocaleString('ja-JP') : '不明'}</p>
                    <p><strong>提出数:</strong> ${submissions.length}件</p>
                    <p><strong>データ保存:</strong> ${parsedData.cloudSaved ? '☁️ クラウド' : '💾 ローカル'}</p>
                </div>
                
                ${submissions.length > 0 ? `
                    <div style="margin-top: 20px;">
                        <h4>提出済み学生:</h4>
                        <div style="max-height: 200px; overflow: auto; border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
                            ${submissions.map(sub => `
                                <div style="padding: 5px 0; border-bottom: 1px solid #eee;">
                                    学籍番号: ${sub.studentId} - 提出時刻: ${new Date(sub.timestamp).toLocaleString('ja-JP')}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div style="margin-top: 30px; text-align: center;">
                    <button onclick="showQRForTestCode('${testCode}'); closeTestCodeModal()" 
                            style="background: #007aff; color: white; border: none; padding: 12px 24px; border-radius: 8px; margin: 5px; cursor: pointer;">
                        📱 QRコードを表示
                    </button>
                    <button onclick="copyTestCode('${testCode}')" 
                            style="background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 8px; margin: 5px; cursor: pointer;">
                        📋 コードをコピー
                    </button>
                    <button onclick="closeTestCodeModal()" 
                            style="background: #666; color: white; border: none; padding: 12px 24px; border-radius: 8px; margin: 5px; cursor: pointer;">
                        閉じる
                    </button>
                </div>
            </div>
        `;
        
        modal.id = 'testCodeDetailModal';
        modal.onclick = (e) => {
            if (e.target === modal) closeTestCodeModal();
        };
        document.body.appendChild(modal);
        
    } catch (e) {
        console.error('Error showing test code details:', e);
        alert('テストデータの読み込みに失敗しました。');
    }
}

// テストコード削除
function deleteTestCode(testCode) {
    if (!confirm(`テストコード「${testCode}」を削除しますか？\n\n注意: 関連する提出データもすべて削除されます。`)) {
        return;
    }
    
    try {
        // テストコードデータを削除
        const testKey = `testCode_${testCode}`;
        localStorage.removeItem(testKey);
        
        // 関連する提出データを削除
        const submissionKey = `submissions_${testCode}`;
        localStorage.removeItem(submissionKey);
        
        // 個別提出データも削除
        const allKeys = Object.keys(localStorage);
        const relatedKeys = allKeys.filter(key => key.includes(testCode));
        relatedKeys.forEach(key => localStorage.removeItem(key));
        
        alert(`テストコード「${testCode}」とその関連データを削除しました。`);
        
        // 表示を更新
        showExistingTestCodes();
        
    } catch (e) {
        console.error('Error deleting test code:', e);
        alert('削除に失敗しました。');
    }
}

// QRコード表示
function showQRForTestCode(testCode) {
    // 既存のQRコード生成関数を使用
    generateQRCode(testCode);
    
    // 共有モーダルを表示
    const testKey = `testCode_${testCode}`;
    const testData = localStorage.getItem(testKey);
    
    if (testData) {
        try {
            const parsedData = JSON.parse(testData);
            showShareOptions(parsedData, { testCode: testCode, cloudSaved: parsedData.cloudSaved });
        } catch (e) {
            console.error('Error showing QR:', e);
            alert('QRコードの表示に失敗しました。');
        }
    }
}

function closeTestCodeModal() {
    const modal = document.getElementById('testCodeDetailModal');
    if (modal) {
        modal.remove();
    }
}

// QRコード生成（データ埋め込み版）
function generateQRCode(testCode) {
    const qrContainer = document.getElementById('qrcode');
    if (!qrContainer) return;
    
    console.log('=== generateQRCode called ===');
    console.log('testCode:', testCode);
    
    // ローカルストレージからテストデータを取得
    const testKey = `testCode_${testCode}`;
    const testData = localStorage.getItem(testKey);
    
    console.log('testKey:', testKey);
    console.log('testData found:', !!testData);
    
    let qrUrl;
    let targetUrl;
    
    if (testData) {
        try {
            const parsedData = JSON.parse(testData);
            console.log('Parsed test data structure:', {
                hasDataUrl: !!parsedData.dataUrl,
                hasEncodedData: !!parsedData.encodedData,
                hasQuestions: !!parsedData.questions,
                questionsCount: parsedData.questions ? parsedData.questions.length : 0
            });
            
            // データ埋め込みURLを最優先で使用
            if (parsedData.dataUrl) {
                targetUrl = parsedData.dataUrl;
                console.log('Using embedded data URL');
            } else if (parsedData.encodedData) {
                targetUrl = `${window.location.origin}${window.location.pathname}?data=${parsedData.encodedData}`;
                console.log('Using encoded data URL');
            } else if (parsedData.questions && parsedData.questions.length > 0) {
                // 問題データがあるが埋め込みURLがない場合は、その場で生成
                console.log('Generating embedded URL from existing questions...');
                const dataToEmbed = {
                    questions: parsedData.questions,
                    answerExamples: parsedData.answerExamples || [],
                    testEnabled: true,
                    testCode: testCode,
                    created: parsedData.created || new Date().toISOString()
                };
                
                const encodedData = btoa(encodeURIComponent(JSON.stringify(dataToEmbed)));
                targetUrl = `${window.location.origin}${window.location.pathname}?data=${encodedData}`;
                
                // 今後のために保存
                parsedData.encodedData = encodedData;
                parsedData.dataUrl = targetUrl;
                try {
                    localStorage.setItem(testKey, JSON.stringify(parsedData));
                    console.log('Generated and saved embedded URL');
                } catch (storageError) {
                    console.error('Storage quota exceeded, using temporary URL');
                    // 容量不足の場合は保存せずにURLのみ使用
                    console.log('Using temporary embedded URL without saving');
                }
            } else {
                // テストコード方式（フォールバック）
                targetUrl = `${window.location.origin}${window.location.pathname}?code=${testCode}`;
                console.log('Using test code URL (fallback - no questions found)');
            }
        } catch (e) {
            console.error('Error parsing test data:', e);
            // エラーの場合はテストコード方式
            targetUrl = `${window.location.origin}${window.location.pathname}?code=${testCode}`;
        }
    } else {
        // データが見つからない場合はテストコード方式
        targetUrl = `${window.location.origin}${window.location.pathname}?code=${testCode}`;
        console.log('No test data found, using test code URL');
    }
    
    console.log('Final target URL:', targetUrl);
    console.log('URL length:', targetUrl.length);
    
    // QRコード画像URLを生成
    qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(targetUrl)}`;
    
    // URLの種類を判定
    const urlType = targetUrl.includes('?data=') ? 'データ埋め込み' : 'テストコード';
    const urlColor = targetUrl.includes('?data=') ? '#28a745' : '#dc3545';
    
    qrContainer.innerHTML = `
        <div style="text-align: center;">
            <img src="${qrUrl}" alt="QRコード" style="border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px;">
            <div style="font-size: 12px; color: #666; margin-top: 5px;">
                テストコード: <strong>${testCode}</strong>
            </div>
            <div style="font-size: 11px; color: ${urlColor}; margin-top: 5px; font-weight: bold;">
                🔗 ${urlType}形式
            </div>
            <div style="font-size: 10px; color: #999; margin-top: 5px; word-break: break-all;">
                URL: ${targetUrl.length > 80 ? targetUrl.substring(0, 80) + '...' : targetUrl}
            </div>
            ${targetUrl.includes('?code=') && !targetUrl.includes('?data=') ? `
                <div style="background: #fff3cd; color: #856404; padding: 10px; margin-top: 10px; border-radius: 5px; font-size: 12px;">
                    ⚠️ テストコード形式では別端末からアクセスできません<br>
                    <button onclick="forceRegenerateDataURL('${testCode}')" style="background: #ffc107; color: #212529; border: none; padding: 5px 10px; border-radius: 3px; margin-top: 5px; cursor: pointer;">
                        データ埋め込み形式で再生成
                    </button>
                    <button onclick="generateLightweightQR('${testCode}')" style="background: #28a745; color: white; border: none; padding: 5px 10px; border-radius: 3px; margin: 5px 0 0 5px; cursor: pointer;">
                        軽量版で強制生成
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

// QRコードダウンロード
function downloadQR() {
    const qrImg = document.querySelector('#qrcode img');
    if (qrImg) {
        const link = document.createElement('a');
        link.href = qrImg.src;
        link.download = 'physics-test-qr.png';
        link.click();
    }
}

function closeShareModal() {
    const modal = document.getElementById('shareModal');
    if (modal) {
        modal.remove();
    }
}



// テスト状態更新
function updateTestStatus() {
    const statusBadge = document.getElementById('testStatusBadge');
    const statusMessage = document.getElementById('testStatusMessage');
    
    if (!statusBadge || !statusMessage) return;

    if (testEnabled && questions.length > 0) {
        statusBadge.textContent = '受験可能';
        statusBadge.className = 'status-badge status-active';
        statusMessage.textContent = `${questions.length}問のテストが設定されています`;
        
        // 既存のテストコードを表示
        showExistingTestCodes();
    } else {
        statusBadge.textContent = '未設定';
        statusBadge.className = 'status-badge status-inactive';
        statusMessage.textContent = '問題が設定されていません';
        
        // テストコード表示をクリア
        const testCodeDisplay = document.getElementById('testCodeDisplay');
        if (testCodeDisplay) {
            testCodeDisplay.style.display = 'none';
        }
    }
}

// 既存のテストコードを表示
function showExistingTestCodes() {
    // 既存の表示エリアを取得または作成
    let testCodeDisplay = document.getElementById('testCodeDisplay');
    if (!testCodeDisplay) {
        testCodeDisplay = document.createElement('div');
        testCodeDisplay.id = 'testCodeDisplay';
        testCodeDisplay.style.cssText = `
            margin-top: 20px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
            border: 1px solid #e9ecef;
        `;
        
        const testStatusSection = document.querySelector('.test-status').parentElement;
        testStatusSection.appendChild(testCodeDisplay);
    }
    
    // 既存のテストコードを検索
    const existingCodes = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('testCode_')) {
            const testCode = key.replace('testCode_', '');
            const data = localStorage.getItem(key);
            if (data) {
                try {
                    const parsedData = JSON.parse(data);
                    if (parsedData.questions || parsedData.gistId) {
                        existingCodes.push({
                            testCode: testCode,
                            hasCloud: !!parsedData.cloudSaved,
                            created: parsedData.created || '不明'
                        });
                    }
                } catch (e) {
                    // 無効なデータは無視
                }
            }
        }
    }
    
    if (existingCodes.length > 0) {
        const codesHtml = existingCodes.map(code => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; margin: 5px 0; background: white; border-radius: 8px; border: 1px solid #dee2e6;">
                <div onclick="showTestCodeDetails('${code.testCode}')" style="cursor: pointer; flex: 1;">
                    <span style="font-size: 18px; font-weight: bold; color: #007aff;">${code.testCode}</span>
                    <span style="margin-left: 10px; font-size: 12px; color: #666;">
                        ${code.hasCloud ? '☁️ クラウド' : '💾 ローカル'}
                    </span>
                    <div style="font-size: 10px; color: #999; margin-top: 2px;">クリックで詳細表示</div>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button onclick="copyTestCode('${code.testCode}')" style="background: #28a745; color: white; border: none; padding: 5px 10px; border-radius: 5px; font-size: 12px; cursor: pointer;">
                        📋 コピー
                    </button>
                    <button onclick="showQRForTestCode('${code.testCode}')" style="background: #007aff; color: white; border: none; padding: 5px 10px; border-radius: 5px; font-size: 12px; cursor: pointer;">
                        📱 QR表示
                    </button>
                    <button onclick="deleteTestCode('${code.testCode}')" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 5px; font-size: 12px; cursor: pointer;">
                        🗑️ 削除
                    </button>
                </div>
            </div>
        `).join('');
        
        testCodeDisplay.innerHTML = `
            <h4 style="margin: 0 0 15px 0; color: #333;">📱 利用可能なテストコード</h4>
            ${codesHtml}
            <div style="margin-top: 15px; font-size: 12px; color: #666;">
                💡 生徒はこれらのコードを使ってテストにアクセスできます
            </div>
        `;
        testCodeDisplay.style.display = 'block';
    } else {
        testCodeDisplay.style.display = 'none';
    }
}

// 保存された問題データを読み込み
async function loadSavedQuestions() {
    try {
        // まずURLパラメータからデータを読み込み
        const urlLoaded = loadQuestionsFromUrl();
        
        if (!urlLoaded) {
            // URLデータがない場合はサーバーから読み込み
            await loadQuestionsFromServer();
            
            // サーバーデータもない場合はローカルストレージから読み込み
            if (questions.length === 0) {
                loadQuestionsFromLocalStorage();
            }
        }
        
        updateTestStatus();
    } catch (error) {
        console.error('Load error:', error);
        // エラーの場合はローカルストレージから読み込み
        loadQuestionsFromLocalStorage();
        updateTestStatus();
    }
}

// URLパラメータからデータを読み込み（真のクロスデバイス対応）
function loadQuestionsFromUrl() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const testCode = urlParams.get('code');
        const shareId = urlParams.get('id');
        const dataParam = urlParams.get('data'); // データ埋め込み形式
        
        console.log('=== loadQuestionsFromUrl called ===');
        console.log('Current URL:', window.location.href);
        console.log('URL parameters found:', {
            testCode: testCode,
            shareId: shareId,
            dataParam: dataParam ? 'present' : 'null'
        });
        
        // デバッグ情報を画面に表示
        showDebugInfo('URL読み込み開始', {
            url: window.location.href.substring(0, 100) + '...',
            testCode: testCode || 'なし',
            dataParam: dataParam ? 'あり' : 'なし'
        });
        
        let data = null;
        
        if (dataParam) {
            // 最新形式：データ埋め込み（真のクロスデバイス）
            try {
                const decodedData = decodeURIComponent(atob(dataParam));
                data = JSON.parse(decodedData);
                console.log('Data loaded from URL parameter (cross-device):', data);
            } catch (decodeError) {
                console.error('Failed to decode URL data:', decodeError);
            }
        } else if (testCode) {
            // フォールバック：テストコード（ローカルストレージ依存）
            const testKey = `testCode_${testCode}`;
            const testData = localStorage.getItem(testKey);
            if (testData) {
                data = JSON.parse(testData);
                console.log('Data loaded from localStorage (same device):', data);
            }
        } else if (shareId) {
            // 旧形式：短縮ID
            const shareKey = `physicsQuizShare_${shareId}`;
            const shareData = localStorage.getItem(shareKey);
            if (shareData) {
                data = JSON.parse(shareData);
            }
        }
        
        if (data && data.questions && data.questions.length > 0) {
            questions = data.questions;
            answerExamples = data.answerExamples || [];
            testEnabled = data.testEnabled || false;
            
            console.log('Questions loaded from URL:', questions.length);
            
            // 成功のデバッグ情報を表示
            showDebugInfo('データ読み込み成功', {
                '問題数': questions.length,
                'テスト有効': testEnabled ? 'はい' : 'いいえ'
            });
            
            // 管理画面の場合は表示を更新
            if (document.getElementById('questionList')) {
                renderQuestionList();
            }
            if (document.getElementById('answerExampleList')) {
                renderAnswerExampleList();
            }
            
            // URLからロードした場合は、ローカルストレージにも保存
            localStorage.setItem('physicsQuizQuestions', JSON.stringify(questions));
            localStorage.setItem('physicsQuizAnswerExamples', JSON.stringify(answerExamples));
            localStorage.setItem('physicsQuizEnabled', testEnabled.toString());
            
            // URLから直接テスト画面に遷移する場合のCanvas初期化
            if (window.location.hash === '#test' || document.getElementById('testScreen')) {
                setTimeout(() => {
                    initCanvas();
                    setInputMethod('canvas');
                }, 200);
            }
            
            return true;
        }
    } catch (error) {
        console.log('URL data not available or invalid:', error);
        
        // エラーのデバッグ情報を表示
        showDebugInfo('URL読み込みエラー', {
            'エラー': error.message,
            'URL': window.location.href.substring(0, 50) + '...'
        });
    }
    return false;
}

// サーバーからデータを読み込み
async function loadQuestionsFromServer() {
    try {
        const response = await fetch('./data.json');
        if (response.ok) {
            const data = await response.json();
            
            if (data.questions && data.questions.length > 0) {
                questions = data.questions;
                answerExamples = data.answerExamples || [];
                testEnabled = data.testEnabled || false;
                
                console.log('Questions loaded from server:', questions.length);
                
                // 管理画面の場合は表示を更新
                if (document.getElementById('questionList')) {
                    renderQuestionList();
                }
                if (document.getElementById('answerExampleList')) {
                    renderAnswerExampleList();
                }
                
                return true;
            }
        }
    } catch (error) {
        console.log('Server data not available, falling back to localStorage');
    }
    return false;
}

// ローカルストレージからデータを読み込み
function loadQuestionsFromLocalStorage() {
    try {
        const savedQuestions = localStorage.getItem('physicsQuizQuestions');
        const savedAnswerExamples = localStorage.getItem('physicsQuizAnswerExamples');
        const savedEnabled = localStorage.getItem('physicsQuizEnabled');
        
        if (savedQuestions) {
            questions = JSON.parse(savedQuestions);
            if (document.getElementById('questionList')) {
                renderQuestionList();
            }
        }
        
        if (savedAnswerExamples) {
            answerExamples = JSON.parse(savedAnswerExamples);
            if (document.getElementById('answerExampleList')) {
                renderAnswerExampleList();
            }
        }
        
        if (savedEnabled === 'true') {
            testEnabled = true;
        }
        
        console.log('Questions loaded from localStorage:', questions.length);
    } catch (error) {
        console.error('LocalStorage load error:', error);
    }
}

// 管理画面メッセージ表示
function showAdminSuccess(message) {
    const successDiv = document.getElementById('adminSuccessMessage');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 3000);
    }
}

function showAdminError(message) {
    const errorDiv = document.getElementById('adminErrorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}

// ログイン画面に戻る
function backToLogin() {
    showScreen('login');
    // フォームをリセット
    const studentIdInput = document.getElementById('studentId');
    const adminPasswordInput = document.getElementById('adminPassword');
    const loginError = document.getElementById('loginError');
    
    if (studentIdInput) studentIdInput.value = '';
    if (adminPasswordInput) adminPasswordInput.value = '';
    if (loginError) loginError.style.display = 'none';
}

// ========== テスト機能 ==========

// Canvas初期化
function initCanvas() {
    console.log('Initializing canvas...');
    
    canvas = document.getElementById('answerCanvas');
    if (!canvas) {
        console.error('Canvas element not found');
        // 少し待ってから再試行
        setTimeout(() => {
            canvas = document.getElementById('answerCanvas');
            if (canvas) {
                console.log('Canvas found on retry');
                initCanvasElements();
            }
        }, 500);
        return;
    }
    
    initCanvasElements();
}

function initCanvasElements() {
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Canvas context not available');
        return;
    }
    
    console.log('Canvas context initialized, canvas size:', canvas.width, 'x', canvas.height);
    
    // 既存のイベントリスナーを削除（重複防止）
    canvas.removeEventListener('mousedown', startDrawing);
    canvas.removeEventListener('mousemove', draw);
    canvas.removeEventListener('mouseup', stopDrawing);
    canvas.removeEventListener('mouseout', stopDrawing);
    canvas.removeEventListener('touchstart', handleTouch);
    canvas.removeEventListener('touchmove', handleTouch);
    canvas.removeEventListener('touchend', stopDrawing);
    
    // Canvas サイズ設定
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // 描画イベント設定
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // タッチイベント設定（iPad対応）
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', stopDrawing, { passive: false });
    
    console.log('Canvas initialized successfully with touch events');
    
    // テスト描画で動作確認
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(0, 0, 10, 10);
    setTimeout(() => {
        ctx.clearRect(0, 0, 10, 10);
    }, 1000);
}

function resizeCanvas() {
    if (!canvas || !ctx) return;
    
    const container = canvas.parentElement;
    if (!container) return;
    
    // コンテナサイズを取得（最小サイズを保証）
    const containerWidth = Math.max(container.clientWidth, 300);
    const containerHeight = Math.max(container.clientHeight, 400);
    
    canvas.width = containerWidth;
    canvas.height = containerHeight;
    
    console.log('Canvas resized to:', containerWidth, 'x', containerHeight);
    
    // Canvas設定
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = penSize || 3;
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
}

function handleTouch(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!e.touches || e.touches.length === 0) return;
    
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    
    if (e.type === 'touchstart') {
        startDrawing({offsetX: x, offsetY: y});
    } else if (e.type === 'touchmove') {
        draw({offsetX: x, offsetY: y});
    }
}

function startDrawing(e) {
    isDrawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
}

function draw(e) {
    if (!isDrawing) return;
    
    if (currentTool === 'pen') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#000000';
    } else if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
    }
    
    ctx.lineWidth = penSize;
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
}

function stopDrawing() {
    isDrawing = false;
}

function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function updatePenSize() {
    const penSizeInput = document.getElementById('penSize');
    const penSizeValue = document.getElementById('penSizeValue');
    
    if (penSizeInput && penSizeValue) {
        penSize = penSizeInput.value;
        penSizeValue.textContent = penSize;
    }
}

function clearCanvas() {
    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// 入力方法切り替え
function setInputMethod(method) {
    inputMethod = method;
    
    // ボタンのアクティブ状態を更新
    document.getElementById('canvasMethodBtn').classList.toggle('active', method === 'canvas');
    document.getElementById('textMethodBtn').classList.toggle('active', method === 'text');
    
    // 入力エリアの表示切り替え
    document.getElementById('canvasInputArea').style.display = method === 'canvas' ? 'block' : 'none';
    document.getElementById('textInputArea').style.display = method === 'text' ? 'block' : 'none';
}

// テスト開始
function startTest() {
    currentQuestionIndex = 0;
    startTime = new Date();
    testStartTime = new Date(); // 新しい変数にも設定
    violationCount = 0;
    testData = { answers: [], violations: [] };
    userAnswers = []; // 新しい回答配列を初期化
    canvasData = [];
    ocrResults = [];
    gradingResults = [];
    
    // 問題数表示更新
    const totalQuestionsElement = document.getElementById('totalQuestions');
    if (totalQuestionsElement) {
        totalQuestionsElement.textContent = questions.length;
    }
    
    // 違反カウンターリセット
    const violationCountElement = document.getElementById('violationCount');
    if (violationCountElement) {
        violationCountElement.textContent = '0';
    }
    
    // キャンバス初期化
    setTimeout(() => {
        initCanvas();
        setInputMethod('canvas'); // デフォルトで手書き入力を選択
    }, 100);
    
    // タイマー開始
    timerInterval = setInterval(updateTimer, 1000);
    
    // 最初の問題を表示
    showQuestion(0);
}

function updateTimer() {
    if (!startTime) return;
    
    const elapsed = Math.floor((new Date() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    const elapsedTimeElement = document.getElementById('elapsedTime');
    if (elapsedTimeElement) {
        elapsedTimeElement.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

function showQuestion(index) {
    if (index < 0 || index >= questions.length) return;
    
    // 現在の回答データを保存
    if (currentQuestionIndex !== index) {
        saveCurrentAnswer();
    }
    
    currentQuestionIndex = index;
    
    // 問題表示
    const currentQuestionElement = document.getElementById('currentQuestion');
    const questionImageElement = document.getElementById('questionImage');
    
    if (currentQuestionElement) {
        currentQuestionElement.textContent = index + 1;
    }
    
    if (questionImageElement) {
        questionImageElement.src = questions[index].image;
    }
    
    // 回答データ復元
    restoreAnswer(index);
    
    // ナビゲーションボタン更新
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');
    const submitButton = document.getElementById('submitButton');
    
    if (prevButton) {
        prevButton.disabled = (index === 0);
    }
    
    if (nextButton) {
        nextButton.style.display = (index === questions.length - 1) ? 'none' : 'inline-block';
    }
    
    if (submitButton) {
        submitButton.style.display = (index === questions.length - 1) ? 'inline-block' : 'none';
    }
}

// 現在の回答を保存
function saveCurrentAnswer() {
    // testDataとuserAnswersの両方を更新
    if (!testData.answers[currentQuestionIndex]) {
        testData.answers[currentQuestionIndex] = {};
    }
    if (!userAnswers[currentQuestionIndex]) {
        userAnswers[currentQuestionIndex] = {};
    }
    
    const answerData = { method: inputMethod };
    
    if (inputMethod === 'canvas' && canvas) {
        const canvasDataUrl = canvas.toDataURL();
        answerData.canvas = canvasDataUrl;
        testData.answers[currentQuestionIndex].canvas = canvasDataUrl;
        userAnswers[currentQuestionIndex].canvas = canvasDataUrl;
        canvasData[currentQuestionIndex] = canvasDataUrl;
    } else if (inputMethod === 'text') {
        const textAnswer = document.getElementById('textAnswer').value;
        answerData.text = textAnswer;
        testData.answers[currentQuestionIndex].text = textAnswer;
        userAnswers[currentQuestionIndex].text = textAnswer;
    }
    
    testData.answers[currentQuestionIndex].method = inputMethod;
    userAnswers[currentQuestionIndex].method = inputMethod;
    
    console.log(`Answer saved for question ${currentQuestionIndex}:`, answerData);
}

// 回答を復元
function restoreAnswer(index) {
    const answer = testData.answers[index];
    
    if (answer) {
        // 入力方法を復元
        if (answer.method) {
            setInputMethod(answer.method);
        }
        
        // Canvas回答を復元
        if (answer.canvas && inputMethod === 'canvas') {
            const img = new Image();
            img.onload = function() {
                if (ctx) {
                    clearCanvas();
                    ctx.drawImage(img, 0, 0);
                }
            };
            img.src = answer.canvas;
        } else if (inputMethod === 'canvas') {
            clearCanvas();
        }
        
        // テキスト回答を復元
        if (answer.text && inputMethod === 'text') {
            document.getElementById('textAnswer').value = answer.text;
        } else if (inputMethod === 'text') {
            document.getElementById('textAnswer').value = '';
        }
    } else {
        // 新しい問題の場合は初期化
        if (inputMethod === 'canvas') {
            clearCanvas();
        } else {
            document.getElementById('textAnswer').value = '';
        }
    }
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        showQuestion(currentQuestionIndex - 1);
    }
}

function nextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
        showQuestion(currentQuestionIndex + 1);
    }
}

async function submitTest() {
    if (confirm('テストを提出しますか？提出後は修正できません。')) {
        // 最後の回答を保存
        saveCurrentAnswer();
        
        // タイマー停止
        clearInterval(timerInterval);
        
        // 解答を保存（統一された保存関数を使用）
        saveSubmissionResult();
        
        // 完了画面表示
        showScreen('result');
        showSubmissionComplete();
    }
}

// ========== 解答回収機能 ==========

// 重複関数削除 - saveSubmissionResultに統一

// 提出完了画面を表示
function showSubmissionComplete() {
    const resultContainer = document.querySelector('#resultScreen .result-container');
    const finalStudentId = currentStudentId || studentId;
    const finalAnswers = userAnswers || (testData ? testData.answers : []);
    
    // 実際に回答された問題数を正確にカウント
    const answersCount = finalAnswers.filter(answer => {
        if (!answer) return false;
        return (answer.method === 'text' && answer.text && answer.text.trim() !== '') ||
               (answer.method === 'canvas' && answer.canvas && answer.canvas !== 'data:image/png;base64,');
    }).length;
    
    console.log('=== showSubmissionComplete called ===');
    console.log('finalStudentId:', finalStudentId);
    console.log('answersCount:', answersCount);
    console.log('violationCount:', violationCount);
    
    // 保存された提出データを確認
    const savedSubmissions = JSON.parse(localStorage.getItem('studentSubmissions') || '[]');
    const mySubmission = savedSubmissions.find(s => s.studentId === finalStudentId);
    
    resultContainer.innerHTML = `
        <h2>✅ 提出完了</h2>
        <div style="text-align: center; margin: 30px 0;">
            <div style="font-size: 24px; color: #28a745; margin-bottom: 20px;">
                📝 解答が正常に提出されました
            </div>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <p><strong>学籍番号:</strong> ${finalStudentId}</p>
                <p><strong>提出時刻:</strong> ${new Date().toLocaleString('ja-JP')}</p>
                <p><strong>回答数:</strong> ${answersCount} 問</p>
                <p><strong>違反回数:</strong> ${violationCount || 0} 回</p>
                ${mySubmission ? '<p style="color: #28a745;"><strong>✓ データ保存確認済み</strong></p>' : '<p style="color: #dc3545;"><strong>⚠ データ保存を確認できません</strong></p>'}
            </div>
            <div style="color: #6c757d; font-size: 14px; margin: 20px 0;">
                解答は教員によって手動で採点されます。<br>
                結果については後日お知らせいたします。
            </div>
            ${mySubmission ? '' : `
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffeaa7;">
                    <p style="color: #856404; margin: 0; font-size: 14px;">
                        ⚠ 提出データの保存に問題がある可能性があります。<br>
                        念のため、教員に提出完了を口頭で報告してください。
                    </p>
                </div>
            `}
        </div>
        <button class="nav-button" onclick="backToLogin()">終了</button>
    `;
}

// ========== 不正検知設定 ==========

// 違反検知設定
function setupViolationDetection() {
    // タブ切り替え検知
    document.addEventListener('visibilitychange', function() {
        if (document.hidden && currentScreen === 'test') {
            violationCount++;
            isTabSwitched = true;
            showWarning();
            console.log('Tab switch detected. Violation count:', violationCount);
        }
    });
    
    // 右クリック禁止
    document.addEventListener('contextmenu', function(e) {
        if (currentScreen === 'test') {
            e.preventDefault();
            violationCount++;
            showWarning();
            console.log('Right click detected. Violation count:', violationCount);
        }
    });
    
    // キーボードショートカット禁止
    document.addEventListener('keydown', function(e) {
        if (currentScreen === 'test') {
            // F12, Ctrl+Shift+I, Ctrl+U等の開発者ツール系キー
            if (e.key === 'F12' || 
                (e.ctrlKey && e.shiftKey && e.key === 'I') ||
                (e.ctrlKey && e.key === 'u') ||
                (e.ctrlKey && e.shiftKey && e.key === 'J') ||
                (e.ctrlKey && e.shiftKey && e.key === 'C')) {
                e.preventDefault();
                violationCount++;
                isDevToolsOpen = true;
                showWarning();
                console.log('Developer tools key detected. Violation count:', violationCount);
            }
        }
    });
}

// 警告表示
function showWarning() {
    const modal = document.getElementById('warningModal');
    if (modal) {
        modal.style.display = 'flex';
        
        // 違反の種類に応じてメッセージを変更
        const message = document.getElementById('warningMessage');
        if (message) {
            if (isTabSwitched) {
                message.textContent = '画面を切り替えることは禁止されています。';
                isTabSwitched = false;
            } else if (isDevToolsOpen) {
                message.textContent = '開発者ツールの使用は禁止されています。';
                isDevToolsOpen = false;
            } else {
                message.textContent = '不正な操作が検知されました。';
            }
        }
        
        // 5秒後に自動で閉じる
        setTimeout(() => {
            closeWarning();
        }, 5000);
    }
}

// 警告を閉じる
function closeWarning() {
    const modal = document.getElementById('warningModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ========== 結果保存・表示 ==========

// 学生の解答を保存（統一版）
async function saveSubmissionResult() {
    try {
        console.log('=== saveSubmissionResult called ===');
        console.log('currentStudentId:', currentStudentId);
        console.log('studentId:', typeof studentId !== 'undefined' ? studentId : 'undefined');
        console.log('currentTestCode:', currentTestCode);
        console.log('userAnswers:', userAnswers);
        console.log('currentTestData:', currentTestData);
        
        const finalStudentId = currentStudentId || studentId;
        const finalTestCode = currentTestCode || 'LOCAL';
        const finalAnswers = userAnswers || (testData ? testData.answers : []);
        const finalQuestions = currentTestData ? currentTestData.questions : questions;
        const finalStartTime = testStartTime || startTime || new Date();
        
        if (!finalStudentId) {
            console.error('No student ID available');
            alert('学籍番号が取得できませんでした。再度ログインしてください。');
            return;
        }
        
        const submissionData = {
            studentId: finalStudentId,
            testCode: finalTestCode,
            timestamp: new Date().toISOString(),
            startTime: finalStartTime,
            endTime: new Date(),
            totalTime: Math.floor((new Date() - finalStartTime) / 1000),
            answers: finalAnswers,
            questions: finalQuestions.map(q => ({
                id: q.id,
                image: q.image,
                patterns: q.patterns
            })),
            violationCount: violationCount || 0,
            violations: testData ? testData.violations : [],
            isCompleted: true
        };
        
        console.log('Prepared submission data:', submissionData);
        
        // テストコード毎に分離して保存
        const submissionKey = `submissions_${finalTestCode}`;
        const existingSubmissions = JSON.parse(localStorage.getItem(submissionKey) || '[]');
        console.log('Existing submissions before save for test code', finalTestCode, ':', existingSubmissions);
        
        // 同じ学生IDの古い提出を削除
        const filteredSubmissions = existingSubmissions.filter(sub => sub.studentId !== finalStudentId);
        filteredSubmissions.push(submissionData);
        
        localStorage.setItem(submissionKey, JSON.stringify(filteredSubmissions));
        
        // 後方互換性のため、総合的な保存も維持
        const allSubmissions = JSON.parse(localStorage.getItem('studentSubmissions') || '[]');
        const allFiltered = allSubmissions.filter(sub => sub.studentId !== finalStudentId || sub.testCode !== finalTestCode);
        allFiltered.push(submissionData);
        localStorage.setItem('studentSubmissions', JSON.stringify(allFiltered));
        console.log('Submission saved to localStorage');
        
        // 異なる端末からのアクセスの場合、複数の保存方法を試行
        if (finalTestCode !== 'LOCAL') {
            console.log('Cross-device submission detected, attempting multiple save methods...');
            
            // 方法1: テストコード固有のキーで保存
            const cloudKey = `submission_${finalTestCode}_${finalStudentId}`;
            const cloudData = {
                ...submissionData,
                cloudSaved: true,
                cloudTimestamp: new Date().toISOString()
            };
            
            try {
                localStorage.setItem(cloudKey, JSON.stringify(cloudData));
                console.log('Cloud-style save completed:', cloudKey);
            } catch (e) {
                console.warn('Cloud-style save failed:', e);
            }
            
            // 方法2: 一意キーでの追加保存
            const uniqueKey = `submission_${finalTestCode}_${finalStudentId}_${Date.now()}`;
            try {
                localStorage.setItem(uniqueKey, JSON.stringify({
                    ...cloudData,
                    uniqueKey: true,
                    saveMethod: 'cross-device'
                }));
                console.log('Unique key save completed:', uniqueKey);
            } catch (e) {
                console.warn('Unique key save failed:', e);
            }
            
            // 方法3: 教員確認用の緊急保存
            const emergencyKey = `emergency_submissions`;
            try {
                const existingEmergency = JSON.parse(localStorage.getItem(emergencyKey) || '[]');
                existingEmergency.push({
                    ...cloudData,
                    emergencySave: true,
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString()
                });
                localStorage.setItem(emergencyKey, JSON.stringify(existingEmergency));
                console.log('Emergency save completed');
            } catch (e) {
                console.warn('Emergency save failed:', e);
            }
        }
        
        // 保存確認
        const savedSubmissions = JSON.parse(localStorage.getItem('studentSubmissions') || '[]');
        console.log('Verification - submissions after save:', savedSubmissions);
        
        // 提出データを教員に送信する仕組みを実装
        const submitSuccess = await sendSubmissionToTeacher(submissionData, finalTestCode);
        
        if (submitSuccess) {
            alert(`提出完了！学籍番号: ${finalStudentId} の解答を保存しました。\n\n教員への送信も完了しました。`);
        } else {
            alert(`提出完了！学籍番号: ${finalStudentId} の解答を保存しました。\n\n注意: 教員への自動送信に失敗しました。\n手動で提出完了を報告してください。`);
        }
        
    } catch (error) {
        console.error('Failed to save submission:', error);
        alert('解答の保存に失敗しました: ' + error.message);
    }
}

// 教員への提出データ送信
async function sendSubmissionToTeacher(submissionData, testCode) {
    try {
        console.log('Attempting to send submission to teacher...');
        
        // 方法1: URL経由での教員ページへのリダイレクト
        const encodedData = btoa(encodeURIComponent(JSON.stringify({
            type: 'submission',
            data: submissionData,
            testCode: testCode,
            timestamp: new Date().toISOString()
        })));
        
        // 教員用の受信URLを生成
        const teacherUrl = `${window.location.origin}${window.location.pathname}?submission=${encodedData}`;
        
        console.log('Teacher URL generated:', teacherUrl);
        
        // 方法2: 教員のブラウザが開いていれば localStorage を通じて送信
        const globalSubmissionKey = `global_submission_${testCode}_${submissionData.studentId}_${Date.now()}`;
        
        try {
            // グローバルな提出データとして保存
            localStorage.setItem(globalSubmissionKey, JSON.stringify({
                ...submissionData,
                globalSubmission: true,
                teacherUrl: teacherUrl,
                receivedAt: new Date().toISOString()
            }));
            
            // 教員通知キューに追加
            const notificationQueue = JSON.parse(localStorage.getItem('teacher_notifications') || '[]');
            notificationQueue.push({
                type: 'new_submission',
                studentId: submissionData.studentId,
                testCode: testCode,
                timestamp: new Date().toISOString(),
                dataKey: globalSubmissionKey
            });
            localStorage.setItem('teacher_notifications', JSON.stringify(notificationQueue));
            
            console.log('Submission added to teacher notification queue');
            
        } catch (e) {
            console.warn('Failed to add to notification queue:', e);
        }
        
        // 方法3: 提出完了画面で教員URLを表示
        showSubmissionCompleteWithTeacherLink(teacherUrl, submissionData);
        
        return true;
        
    } catch (error) {
        console.error('Failed to send submission to teacher:', error);
        return false;
    }
}

// 教員リンク付きの提出完了画面
function showSubmissionCompleteWithTeacherLink(teacherUrl, submissionData) {
    const resultContainer = document.querySelector('#resultScreen .result-container');
    const finalStudentId = submissionData.studentId;
    
    resultContainer.innerHTML = `
        <h2>✅ 提出完了</h2>
        <div style="text-align: center; margin: 30px 0;">
            <div style="font-size: 24px; color: #28a745; margin-bottom: 20px;">
                📝 解答が正常に提出されました
            </div>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <p><strong>学籍番号:</strong> ${finalStudentId}</p>
                <p><strong>提出時刻:</strong> ${new Date(submissionData.timestamp).toLocaleString('ja-JP')}</p>
                <p><strong>テストコード:</strong> ${submissionData.testCode}</p>
            </div>
            
            <div style="background: #d4edda; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #c3e6cb;">
                <h4 style="color: #155724; margin-top: 0;">📤 教員への提出報告</h4>
                <p style="color: #155724; margin: 10px 0;">
                    以下のリンクを教員に送信するか、教員にアクセスしてもらってください：
                </p>
                <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0; word-break: break-all; font-family: monospace; font-size: 12px;">
                    ${teacherUrl}
                </div>
                <button onclick="copyToClipboard('${teacherUrl}')" 
                        style="background: #007aff; color: white; border: none; padding: 10px 20px; border-radius: 5px; margin: 5px; cursor: pointer;">
                    📋 リンクをコピー
                </button>
                <button onclick="window.open('${teacherUrl}', '_blank')" 
                        style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 5px; margin: 5px; cursor: pointer;">
                    🔗 新しいタブで開く
                </button>
            </div>
            
            <div style="color: #6c757d; font-size: 14px; margin: 20px 0;">
                解答は確実に保存されました。<br>
                教員が上記のリンクにアクセスすることで、提出データを確認できます。
            </div>
        </div>
        <button class="nav-button" onclick="backToLogin()">終了</button>
    `;
}

// クリップボードコピー機能
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('リンクをクリップボードにコピーしました！');
    }).catch(() => {
        // フォールバック
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('リンクをクリップボードにコピーしました！');
    });
}

// 提出結果一覧表示
function showSubmissionResults() {
    try {
        // テストコード毎の提出データを収集
        const allSubmissions = [];
        const testCodeGroups = {};
        
        // 1. 各テストコード毎のsubmissions_XXXキーから読み込み
        const allKeys = Object.keys(localStorage);
        const submissionKeys = allKeys.filter(key => key.startsWith('submissions_'));
        
        submissionKeys.forEach(key => {
            const testCode = key.replace('submissions_', '');
            try {
                const submissions = JSON.parse(localStorage.getItem(key) || '[]');
                testCodeGroups[testCode] = submissions;
                allSubmissions.push(...submissions);
            } catch (e) {
                console.error('Error parsing submissions for', testCode, ':', e);
            }
        });
        
        // 2. 古い形式の全体提出データも読み込み（後方互換性）
        const legacySubmissions = JSON.parse(localStorage.getItem('studentSubmissions') || '[]');
        legacySubmissions.forEach(sub => {
            const testCode = sub.testCode || 'UNKNOWN';
            if (!testCodeGroups[testCode]) {
                testCodeGroups[testCode] = [];
            }
            // 重複チェック
            const isDuplicate = testCodeGroups[testCode].some(existing => 
                existing.studentId === sub.studentId && 
                existing.timestamp === sub.timestamp
            );
            if (!isDuplicate) {
                testCodeGroups[testCode].push(sub);
                allSubmissions.push(sub);
            }
        });
        
        // 3. 異なる端末からの提出データも検索
        const cloudSubmissions = allKeys
            .filter(key => key.startsWith('submission_'))
            .map(key => {
                try {
                    return JSON.parse(localStorage.getItem(key));
                } catch (e) {
                    return null;
                }
            })
            .filter(sub => sub && sub.cloudSaved);
        
        // 4. 緊急保存データも読み込み
        const emergencySubmissions = JSON.parse(localStorage.getItem('emergency_submissions') || '[]');
        
        cloudSubmissions.forEach(cloudSub => {
            const testCode = cloudSub.testCode || 'UNKNOWN';
            if (!testCodeGroups[testCode]) {
                testCodeGroups[testCode] = [];
            }
            const isDuplicate = testCodeGroups[testCode].some(existing => 
                existing.studentId === cloudSub.studentId && 
                existing.timestamp === cloudSub.timestamp
            );
            if (!isDuplicate) {
                testCodeGroups[testCode].push(cloudSub);
                allSubmissions.push(cloudSub);
            }
        });
        
        // 緊急保存データも統合
        emergencySubmissions.forEach(emergencySub => {
            const testCode = emergencySub.testCode || 'EMERGENCY';
            if (!testCodeGroups[testCode]) {
                testCodeGroups[testCode] = [];
            }
            const isDuplicate = testCodeGroups[testCode].some(existing => 
                existing.studentId === emergencySub.studentId && 
                existing.timestamp === emergencySub.timestamp
            );
            if (!isDuplicate) {
                emergencySub.isEmergencySave = true; // マーク付け
                testCodeGroups[testCode].push(emergencySub);
                allSubmissions.push(emergencySub);
            }
        });
        
        console.log('Test code groups:', testCodeGroups);
        console.log('Total submissions:', allSubmissions.length);
        
        const container = document.getElementById('submissionResultsContainer');
        
        console.log('showSubmissionResults called');
        console.log('Found submissions:', allSubmissions.length);
        console.log('Submissions data:', allSubmissions);
        
        if (!container) {
            console.error('Results container not found');
            showAdminError('結果表示エリアが見つかりません。');
            return;
        }
        
        if (allSubmissions.length === 0) {
            container.innerHTML = `
                <div class="no-results" style="padding: 40px; text-align: center; background: #f8f9fa; border-radius: 10px; margin: 20px 0;">
                    <h3>📝 解答データなし</h3>
                    <p>まだ提出された解答がありません。</p>
                    <p style="color: #666; font-size: 14px;">
                        学生がテストを完了すると、ここに解答データが表示されます。
                    </p>
                </div>
            `;
            container.style.display = 'block';
            showAdminSuccess('解答データを確認しました。現在の提出数: 0件');
            return;
        }
        
        // 提出日時で降順ソート
        allSubmissions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        let html = `
            <h3>提出された解答一覧</h3>
            <div class="results-summary">
                <p>総提出数: ${allSubmissions.length}件 (テストコード数: ${Object.keys(testCodeGroups).length})</p>
                <div class="admin-actions">
                    <button onclick="exportToExcel()" class="btn-primary">
                        📊 解答データをExcelでダウンロード
                    </button>
                    <button onclick="downloadHandwritingImages()" class="btn-secondary">
                        🖼️ 手書き画像をZIPでダウンロード
                    </button>
                    <button onclick="clearAllResults()" class="btn-danger">
                        🗑️ 全データ削除
                    </button>
                </div>
            </div>
            <div class="results-list">
        `;
        
        // テストコード毎にグループ化して表示
        Object.keys(testCodeGroups).sort().forEach(testCode => {
            const submissions = testCodeGroups[testCode];
            if (submissions.length === 0) return;
            
            // テストコード毎の提出日時で降順ソート
            submissions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            html += `
                <div class="test-code-group" style="margin: 20px 0; border: 2px solid #007aff; border-radius: 12px; padding: 20px; background: #f8f9ff;">
                    <h4 style="margin: 0 0 15px 0; color: #007aff; font-size: 20px;">
                        📝 テストコード: ${testCode} (${submissions.length}件の提出)
                    </h4>
            `;
        
            submissions.forEach((submission, index) => {
            const submitTime = new Date(submission.timestamp).toLocaleString('ja-JP');
            const duration = `${Math.floor(submission.totalTime / 60)}分${submission.totalTime % 60}秒`;
            
            // 解答数とタイプの集計
            const answeredCount = submission.answers.filter(a => 
                (a.method === 'text' && a.text) || 
                (a.method === 'canvas' && a.canvas)
            ).length;
            
            const textAnswers = submission.answers.filter(a => a.method === 'text' && a.text).length;
            const handwritingAnswers = submission.answers.filter(a => a.method === 'canvas' && a.canvas).length;
            
            html += `
                <div class="submission-item">
                    <div class="submission-header">
                        <h4>学籍番号: ${submission.studentId}</h4>
                        <div class="submission-meta">
                            <span class="timestamp">提出日時: ${submitTime}</span>
                            <span class="duration">所要時間: ${duration}</span>
                            <span class="violations">違反回数: ${submission.violationCount}回</span>
                        </div>
                    </div>
                    <div class="submission-stats">
                        <span class="answered-count">解答数: ${answeredCount}/${submission.questions.length}問</span>
                        <span class="text-count">テキスト入力: ${textAnswers}問</span>
                        <span class="handwriting-count">手書き入力: ${handwritingAnswers}問</span>
                    </div>
                    <div class="submission-answers">
                        ${submission.answers.map((answer, qIndex) => {
                            const question = submission.questions[qIndex];
                            let answerContent = '';
                            
                            if (answer.method === 'text' && answer.text) {
                                answerContent = `<span class="text-answer">${answer.text}</span>`;
                            } else if (answer.method === 'canvas' && answer.canvas) {
                                answerContent = '<span class="canvas-answer">手書き画像（ZIPダウンロードで確認）</span>';
                            } else {
                                answerContent = '<span class="no-answer">未回答</span>';
                            }
                            
                            return `
                                <div class="answer-item">
                                    <div class="question-number">問題${qIndex + 1}</div>
                                    <div class="answer-content">${answerContent}</div>
                                    <div class="answer-patterns">
                                        正解パターン: ${question.patterns ? question.patterns.join(', ') : '設定なし'}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
            });
            
            html += `</div>`;  // test-code-group終了
        });
        
        html += `</div>`;  // results-list終了
        
        container.innerHTML = html;
        container.style.display = 'block';
        
        showAdminSuccess(`${allSubmissions.length}件の提出データを表示しました。`);
        
    } catch (error) {
        console.error('Failed to show submission results:', error);
        showAdminError('提出結果の表示に失敗しました。');
    }
}

// 解答データをExcelファイルとしてダウンロード
function exportToExcel() {
    try {
        // 同じロジックで全提出データを取得
        const submissions = JSON.parse(localStorage.getItem('studentSubmissions') || '[]');
        const allKeys = Object.keys(localStorage);
        const cloudSubmissions = allKeys
            .filter(key => key.startsWith('submission_'))
            .map(key => {
                try {
                    return JSON.parse(localStorage.getItem(key));
                } catch (e) {
                    return null;
                }
            })
            .filter(sub => sub && sub.cloudSaved);
        
        const allSubmissions = [...submissions];
        cloudSubmissions.forEach(cloudSub => {
            const isDuplicate = submissions.some(sub => 
                sub.studentId === cloudSub.studentId && 
                sub.testCode === cloudSub.testCode
            );
            if (!isDuplicate) {
                allSubmissions.push(cloudSub);
            }
        });
        
        if (allSubmissions.length === 0) {
            showAdminError('エクスポートする解答データがありません。');
            return;
        }
        
        // CSVデータを作成
        let csvContent = '\uFEFF'; // BOM for UTF-8
        
        // ヘッダー行
        csvContent += '学籍番号,提出日時,解答数,所要時間(秒),違反回数';
        
        // 問題ごとの詳細ヘッダーを追加
        const maxQuestions = Math.max(...submissions.map(s => s.answers.length));
        for (let i = 1; i <= maxQuestions; i++) {
            csvContent += `,問題${i}_入力方式,問題${i}_回答内容,問題${i}_解答パターン`;
        }
        csvContent += '\n';
        
        // データ行
        submissions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).forEach(submission => {
            const row = [
                submission.studentId,
                new Date(submission.timestamp).toLocaleString('ja-JP'),
                submission.answers.length,
                submission.totalTime,
                submission.violationCount
            ];
            
            // 問題ごとの詳細データを追加
            for (let i = 0; i < maxQuestions; i++) {
                const answer = submission.answers[i];
                const question = submission.questions[i];
                
                if (answer) {
                    const answerText = answer.method === 'text' ? 
                        (answer.text || '未回答') : 
                        (answer.canvas ? '手書き画像データ' : '未回答');
                    
                    row.push(
                        answer.method === 'text' ? 'テキスト入力' : '手書き入力',
                        `"${answerText.replace(/"/g, '""')}"`, // CSVエスケープ
                        `"${question?.patterns?.join(', ') || '設定なし'}"`
                    );
                } else {
                    row.push('未回答', '', '');
                }
            }
            
            csvContent += row.join(',') + '\n';
        });
        
        // ファイルダウンロード
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const now = new Date();
        const filename = `物理テスト解答データ_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showAdminSuccess(`${submissions.length}件の解答データをExcelファイル（${filename}）としてダウンロードしました。`);
        
    } catch (error) {
        console.error('Failed to export to Excel:', error);
        showAdminError('Excelエクスポートに失敗しました。');
    }
}

// 手書き画像をZIPファイルでダウンロード
async function downloadHandwritingImages() {
    try {
        const submissions = JSON.parse(localStorage.getItem('studentSubmissions') || '[]');
        
        if (submissions.length === 0) {
            showAdminError('ダウンロードする解答データがありません。');
            return;
        }
        
        // JSZipライブラリを動的ロード
        if (typeof JSZip === 'undefined') {
            await loadJSZip();
        }
        
        const zip = new JSZip();
        let hasHandwritingData = false;
        
        // 各学生の解答を処理
        allSubmissions.forEach(submission => {
            const studentFolder = zip.folder(`学籍番号_${submission.studentId}`);
            
            // 学生情報ファイルを作成
            const studentInfo = `学籍番号: ${submission.studentId}
提出日時: ${new Date(submission.timestamp).toLocaleString('ja-JP')}
所要時間: ${Math.floor(submission.totalTime / 60)}分${submission.totalTime % 60}秒
違反回数: ${submission.violationCount}回
解答数: ${submission.answers.length}問

問題別解答:
${submission.answers.map((answer, index) => {
    const question = submission.questions[index];
    return `
問題${index + 1}:
  入力方式: ${answer.method === 'text' ? 'テキスト入力' : '手書き入力'}
  回答内容: ${answer.method === 'text' ? (answer.text || '未回答') : (answer.canvas ? '手書き画像（画像ファイル参照）' : '未回答')}
  解答パターン: ${question?.patterns?.join(', ') || '設定なし'}`;
}).join('\n')}
`;
            
            studentFolder.file('解答情報.txt', studentInfo);
            
            // 手書き画像を追加
            submission.answers.forEach((answer, index) => {
                if (answer.method === 'canvas' && answer.canvas) {
                    // Base64データから画像データを抽出
                    const imageData = answer.canvas.split(',')[1];
                    studentFolder.file(`問題${index + 1}_手書き解答.png`, imageData, {base64: true});
                    hasHandwritingData = true;
                }
            });
        });
        
        if (!hasHandwritingData) {
            showAdminError('手書きの解答データがありません。');
            return;
        }
        
        // ZIPファイル生成とダウンロード
        showAdminSuccess('画像ファイルを準備中...');
        
        const zipBlob = await zip.generateAsync({type: 'blob'});
        
        const link = document.createElement('a');
        const url = URL.createObjectURL(zipBlob);
        
        const now = new Date();
        const filename = `物理テスト手書き解答_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.zip`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showAdminSuccess(`手書き解答画像をZIPファイル（${filename}）としてダウンロードしました。`);
        
    } catch (error) {
        console.error('Failed to download handwriting images:', error);
        showAdminError('手書き画像のダウンロードに失敗しました。');
    }
}

// JSZipライブラリを動的ロード
async function loadJSZip() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// 全解答データをクリア
function clearAllResults() {
    if (confirm('全ての解答データを削除しますか？この操作は取り消せません。')) {
        try {
            localStorage.removeItem('studentSubmissions');
            
            const container = document.getElementById('submissionResultsContainer');
            if (container) {
                container.style.display = 'none';
            }
            
            showAdminSuccess('全ての解答データを削除しました。');
        } catch (error) {
            console.error('Failed to clear student submissions:', error);
            showAdminError('解答データの削除に失敗しました。');
        }
    }
}



// ========== URLパラメータ処理 ==========

// URLパラメータから提出データや他の情報を処理
function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // 提出データの受信のみ処理（QRコード関連パラメータは除外）
    if (urlParams.has('submission')) {
        handleSubmissionReceived(urlParams.get('submission'));
        return; // 提出データ処理後は他の処理をスキップ
    }
    
    // QRコード関連パラメータがある場合は何もしない
    if (urlParams.has('code') || urlParams.has('data') || urlParams.has('id')) {
        console.log('QR code parameters detected, skipping submission check');
        return;
    }
    
    // 教員通知の確認（QRコードアクセスでない場合のみ）
    checkTeacherNotifications();
}

// 提出データ受信処理
function handleSubmissionReceived(encodedSubmission) {
    try {
        console.log('Submission data received via URL');
        
        const decodedData = JSON.parse(decodeURIComponent(atob(encodedSubmission)));
        const submissionData = decodedData.data;
        const testCode = decodedData.testCode;
        
        console.log('Decoded submission:', submissionData);
        
        // 提出データを localStorage に保存
        const submissionKey = `submissions_${testCode}`;
        const existingSubmissions = JSON.parse(localStorage.getItem(submissionKey) || '[]');
        
        // 重複チェック
        const isDuplicate = existingSubmissions.some(sub => 
            sub.studentId === submissionData.studentId && 
            sub.timestamp === submissionData.timestamp
        );
        
        if (!isDuplicate) {
            // 新しい提出として追加
            submissionData.receivedViaUrl = true;
            submissionData.urlReceivedAt = new Date().toISOString();
            
            existingSubmissions.push(submissionData);
            localStorage.setItem(submissionKey, JSON.stringify(existingSubmissions));
            
            // 総合リストにも追加
            const allSubmissions = JSON.parse(localStorage.getItem('studentSubmissions') || '[]');
            allSubmissions.push(submissionData);
            localStorage.setItem('studentSubmissions', JSON.stringify(allSubmissions));
            
            console.log('Submission successfully saved from URL');
            
            // 成功通知を表示
            showSubmissionReceivedNotification(submissionData, testCode);
        } else {
            console.log('Duplicate submission ignored');
            showSubmissionAlreadyReceivedNotification(submissionData);
        }
        
        // URLから提出パラメータを削除（履歴を汚さないため）
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
    } catch (error) {
        console.error('Failed to process submission from URL:', error);
        alert('提出データの処理に失敗しました: ' + error.message);
    }
}

// 提出受信通知を表示
function showSubmissionReceivedNotification(submissionData, testCode) {
    // 通知バナーを作成
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #d4edda;
        color: #155724;
        padding: 20px;
        border-radius: 10px;
        border: 1px solid #c3e6cb;
        z-index: 1000;
        max-width: 400px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    
    notification.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px;">
            ✅ 新しい提出を受信しました
        </div>
        <div>
            <strong>学籍番号:</strong> ${submissionData.studentId}<br>
            <strong>テストコード:</strong> ${testCode}<br>
            <strong>提出時刻:</strong> ${new Date(submissionData.timestamp).toLocaleString('ja-JP')}
        </div>
        <button onclick="this.parentElement.remove(); adminLogin(); showScreen('admin');" 
                style="background: #28a745; color: white; border: none; padding: 8px 15px; border-radius: 5px; margin-top: 10px; cursor: pointer;">
            管理画面で確認
        </button>
        <button onclick="this.parentElement.remove();" 
                style="background: #6c757d; color: white; border: none; padding: 8px 15px; border-radius: 5px; margin: 10px 0 0 5px; cursor: pointer;">
            閉じる
        </button>
    `;
    
    document.body.appendChild(notification);
    
    // 10秒後に自動で非表示
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 10000);
}

// 重複提出の通知
function showSubmissionAlreadyReceivedNotification(submissionData) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #fff3cd;
        color: #856404;
        padding: 20px;
        border-radius: 10px;
        border: 1px solid #ffeaa7;
        z-index: 1000;
        max-width: 400px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    
    notification.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px;">
            ⚠️ 既に受信済みの提出です
        </div>
        <div>
            <strong>学籍番号:</strong> ${submissionData.studentId}<br>
            重複提出のため無視されました。
        </div>
        <button onclick="this.parentElement.remove();" 
                style="background: #ffc107; color: #212529; border: none; padding: 8px 15px; border-radius: 5px; margin-top: 10px; cursor: pointer;">
            閉じる
        </button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// 教員通知の確認
function checkTeacherNotifications() {
    const notifications = JSON.parse(localStorage.getItem('teacher_notifications') || '[]');
    
    if (notifications.length > 0) {
        console.log('Found teacher notifications:', notifications.length);
        
        // 最新の通知を表示
        const latestNotification = notifications[notifications.length - 1];
        
        if (latestNotification.type === 'new_submission') {
            showNewSubmissionAlert(latestNotification);
        }
        
        // 通知をクリア
        localStorage.removeItem('teacher_notifications');
    }
}

// 新提出アラート
function showNewSubmissionAlert(notification) {
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 15px;
        border: 2px solid #007aff;
        z-index: 1001;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        text-align: center;
        min-width: 300px;
    `;
    
    alertDiv.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 20px;">📬</div>
        <h3 style="color: #007aff; margin: 0 0 15px 0;">新しい提出があります！</h3>
        <div style="margin: 20px 0;">
            <strong>学籍番号:</strong> ${notification.studentId}<br>
            <strong>テストコード:</strong> ${notification.testCode}<br>
            <strong>時刻:</strong> ${new Date(notification.timestamp).toLocaleString('ja-JP')}
        </div>
        <button onclick="this.parentElement.remove(); adminLogin(); showScreen('admin');" 
                style="background: #007aff; color: white; border: none; padding: 12px 25px; border-radius: 8px; margin: 10px; cursor: pointer; font-size: 16px;">
            📊 管理画面で確認
        </button>
        <button onclick="this.parentElement.remove();" 
                style="background: #6c757d; color: white; border: none; padding: 12px 25px; border-radius: 8px; margin: 10px; cursor: pointer; font-size: 16px;">
            後で確認
        </button>
    `;
    
    document.body.appendChild(alertDiv);
}

// localStorageの使用容量をチェック
function checkStorageUsage() {
    let totalSize = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            totalSize += localStorage[key].length;
        }
    }
    
    const usedMB = (totalSize / (1024 * 1024)).toFixed(2);
    const limitMB = 5; // 通常のlocalStorage制限は5MB
    
    console.log(`localStorage使用量: ${usedMB}MB / ${limitMB}MB`);
    
    if (usedMB > limitMB * 0.8) { // 80%を超えたら警告
        showAdminError(`⚠️ ストレージ容量が不足しています (${usedMB}MB/${limitMB}MB)\n画像ファイルサイズを小さくするか、古いデータを削除してください。`);
        return false;
    }
    
    return true;
}

// 強制的にデータ埋め込みURLを再生成
function forceRegenerateDataURL(testCode) {
    const testKey = `testCode_${testCode}`;
    const testData = localStorage.getItem(testKey);
    
    if (!testData) {
        showAdminError('テストデータが見つかりません。');
        return;
    }
    
    try {
        const parsedData = JSON.parse(testData);
        
        if (!parsedData.questions || parsedData.questions.length === 0) {
            showAdminError('問題データが見つかりません。問題を再アップロードしてください。');
            return;
        }
        
        // データ埋め込みURLを強制生成
        const dataToEmbed = {
            questions: parsedData.questions,
            answerExamples: parsedData.answerExamples || [],
            testEnabled: true,
            testCode: testCode,
            created: parsedData.created || new Date().toISOString()
        };
        
        const encodedData = btoa(encodeURIComponent(JSON.stringify(dataToEmbed)));
        const dataUrl = `${window.location.origin}${window.location.pathname}?data=${encodedData}`;
        
        // 容量チェック
        if (!checkStorageUsage()) {
            // 容量不足の場合は圧縮を試行
            showAdminError('容量不足のため、画像を圧縮してデータを再生成します...');
            
            // 画像を再圧縮
            const compressedQuestions = parsedData.questions.map(q => ({
                ...q,
                image: q.image // 既に圧縮済みの場合はそのまま使用
            }));
            
            const compressedData = {
                ...dataToEmbed,
                questions: compressedQuestions
            };
            
            const compressedEncodedData = btoa(encodeURIComponent(JSON.stringify(compressedData)));
            const compressedDataUrl = `${window.location.origin}${window.location.pathname}?data=${compressedEncodedData}`;
            
            // 更新して保存
            parsedData.encodedData = compressedEncodedData;
            parsedData.dataUrl = compressedDataUrl;
        } else {
            // 通常の保存
            parsedData.encodedData = encodedData;
            parsedData.dataUrl = dataUrl;
        }
        
        localStorage.setItem(testKey, JSON.stringify(parsedData));
        
        // QRコードを再生成
        generateQRCode(testCode);
        
        showAdminSuccess('データ埋め込み形式のQRコードを生成しました！');
        
    } catch (error) {
        console.error('Force regenerate error:', error);
        showAdminError('QRコード再生成に失敗しました: ' + error.message);
    }
}

// 軽量版QR生成（容量制限回避）
function generateLightweightQR(testCode) {
    const testKey = `testCode_${testCode}`;
    const testData = localStorage.getItem(testKey);
    
    if (!testData) {
        showAdminError('テストデータが見つかりません。');
        return;
    }
    
    try {
        const parsedData = JSON.parse(testData);
        
        if (!parsedData.questions || parsedData.questions.length === 0) {
            showAdminError('問題データが見つかりません。');
            return;
        }
        
        // 超軽量版データを作成（画像を大幅圧縮）
        const lightweightQuestions = [];
        
        let processedCount = 0;
        
        parsedData.questions.forEach((question, index) => {
            // 画像をさらに圧縮
            compressImage(question.image, (superCompressed) => {
                lightweightQuestions[index] = {
                    ...question,
                    image: superCompressed
                };
                processedCount++;
                
                // 全ての画像処理が完了したら続行
                if (processedCount === parsedData.questions.length) {
                    finalizeLightweightQR();
                }
            }, 0.1, 200, 150); // 超低品質・超小サイズ
        });
        
        function finalizeLightweightQR() {
            const lightweightData = {
                questions: lightweightQuestions,
                answerExamples: [], // 解答例は除外
                testEnabled: true,
                testCode: testCode,
                created: new Date().toISOString()
            };
            
            const encodedData = btoa(encodeURIComponent(JSON.stringify(lightweightData)));
            const dataUrl = `${window.location.origin}${window.location.pathname}?data=${encodedData}`;
            
            console.log(`Lightweight QR data size: ${Math.round(encodedData.length/1024)}KB`);
            
            // QRコードを直接表示（localStorageに保存しない）
            const qrContainer = document.getElementById('qrcode');
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(dataUrl)}`;
            
            qrContainer.innerHTML = `
                <div style="text-align: center;">
                    <img src="${qrUrl}" alt="QRコード" style="border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px;">
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">
                        テストコード: <strong>${testCode}</strong>
                    </div>
                    <div style="font-size: 11px; color: #28a745; margin-top: 5px; font-weight: bold;">
                        🔗 軽量データ埋め込み形式
                    </div>
                    <div style="font-size: 10px; color: #999; margin-top: 5px;">
                        画像品質を下げて容量を削減しました
                    </div>
                </div>
            `;
            
            showAdminSuccess('軽量版のデータ埋め込みQRコードを生成しました！');
        }
        
    } catch (error) {
        console.error('Lightweight QR generation error:', error);
        showAdminError('軽量版QRコード生成に失敗しました: ' + error.message);
    }
}

// デバッグ情報表示（開発者ツールが使えない場合用）
function showDebugInfo(title, info) {
    // デバッグモードが有効でない場合は何もしない
    if (!window.location.search.includes('debug=1') && !window.debugMode) {
        return;
    }
    
    // 既存のデバッグパネルを取得または作成
    let debugPanel = document.getElementById('debugPanel');
    if (!debugPanel) {
        debugPanel = document.createElement('div');
        debugPanel.id = 'debugPanel';
        debugPanel.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 9999;
            max-width: 300px;
            max-height: 400px;
            overflow-y: auto;
        `;
        document.body.appendChild(debugPanel);
        
        // 閉じるボタンを追加
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: red;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            padding: 2px 6px;
        `;
        closeBtn.onclick = () => debugPanel.remove();
        debugPanel.appendChild(closeBtn);
    }
    
    // デバッグ情報を追加
    const debugEntry = document.createElement('div');
    debugEntry.style.cssText = `
        border-bottom: 1px solid #555;
        padding: 5px 0;
        margin-bottom: 5px;
    `;
    
    let content = `<strong>${title}</strong><br>`;
    content += `時刻: ${new Date().toLocaleTimeString()}<br>`;
    
    if (typeof info === 'object') {
        Object.entries(info).forEach(([key, value]) => {
            content += `${key}: ${value}<br>`;
        });
    } else {
        content += `${info}<br>`;
    }
    
    debugEntry.innerHTML = content;
    debugPanel.appendChild(debugEntry);
    
    // 最新のエントリが見えるようにスクロール
    debugPanel.scrollTop = debugPanel.scrollHeight;
}

// タブレット用デバッグモード切り替え
function setupMobileDebug() {
    let tapCount = 0;
    let tapTimer = null;
    
    // 画面を5回連続タップでデバッグモード有効
    document.addEventListener('touchstart', function(e) {
        // ログイン画面でのみ有効
        if (currentScreen !== 'login') return;
        
        tapCount++;
        
        if (tapTimer) {
            clearTimeout(tapTimer);
        }
        
        if (tapCount >= 5) {
            // デバッグモードを有効にする
            window.debugMode = true;
            
            // デバッグボタンを表示
            showMobileDebugPanel();
            
            tapCount = 0;
        } else {
            // 2秒以内に5回タップしなかった場合はリセット
            tapTimer = setTimeout(() => {
                tapCount = 0;
            }, 2000);
        }
    });
}

// モバイル用デバッグパネル表示
function showMobileDebugPanel() {
    // 既存のパネルがあれば削除
    const existingPanel = document.getElementById('mobileDebugPanel');
    if (existingPanel) {
        existingPanel.remove();
    }
    
    const debugPanel = document.createElement('div');
    debugPanel.id = 'mobileDebugPanel';
    debugPanel.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #007aff;
        color: white;
        padding: 15px;
        border-radius: 10px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 9999;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        text-align: center;
    `;
    
    debugPanel.innerHTML = `
        <div style="margin-bottom: 10px;">
            🔧 デバッグモード有効
        </div>
        <button onclick="startDebugTest()" style="background: white; color: #007aff; border: none; padding: 8px 15px; border-radius: 5px; margin: 5px; cursor: pointer;">
            QRコード動作テスト
        </button>
        <button onclick="clearDebugMode()" style="background: #ff3b30; color: white; border: none; padding: 8px 15px; border-radius: 5px; margin: 5px; cursor: pointer;">
            デバッグ終了
        </button>
    `;
    
    document.body.appendChild(debugPanel);
    
    // 10秒後に自動で非表示（誤操作を避けるため）
    setTimeout(() => {
        if (debugPanel.parentElement) {
            debugPanel.remove();
        }
    }, 10000);
}

// デバッグテスト開始
function startDebugTest() {
    // 現在のURLをチェック
    const urlInfo = {
        'URL': window.location.href,
        'URLパラメータ': window.location.search || 'なし'
    };
    
    showDebugInfo('デバッグテスト開始', urlInfo);
    
    // URLからテストコードを抽出してローカルデータを確認
    const urlParams = new URLSearchParams(window.location.search);
    const testCode = urlParams.get('code');
    
    if (testCode) {
        const testKey = `testCode_${testCode}`;
        const testData = localStorage.getItem(testKey);
        
        if (testData) {
            try {
                const parsedData = JSON.parse(testData);
                showDebugInfo('ローカルテストデータ確認', {
                    'テストコード': testCode,
                    '問題数': parsedData.questions ? parsedData.questions.length : 0,
                    'データURL有無': parsedData.dataUrl ? 'あり' : 'なし',
                    'エンコードデータ有無': parsedData.encodedData ? 'あり' : 'なし',
                    '作成日時': parsedData.created || '不明'
                });
                
                // データがあるのにURLにdataパラメータがない場合の修正提案
                if (parsedData.questions && parsedData.questions.length > 0 && !urlParams.get('data')) {
                    showDebugInfo('修正提案', {
                        '問題': 'ローカルに問題データがあるがURLに埋め込まれていない',
                        '対処法': '教員側でQRコードを再生成してください',
                        '推奨': 'データ埋め込み形式のQRコードを使用'
                    });
                }
            } catch (e) {
                showDebugInfo('ローカルデータエラー', {
                    'エラー': 'データの解析に失敗',
                    '詳細': e.message
                });
            }
        } else {
            showDebugInfo('ローカルデータ確認', {
                'テストコード': testCode,
                '結果': 'データが見つかりません',
                '対処法': '教員側で問題を設定してください'
            });
        }
    }
    
    // QRコード読み込み処理を再実行
    const urlLoaded = loadQuestionsFromUrl();
    
    if (!urlLoaded) {
        showDebugInfo('QRコード読み込み結果', {
            '結果': '失敗',
            '問題': 'URLにデータが含まれていません',
            '対処法': 'QRコードを再スキャンしてください'
        });
    }
}

// デバッグモード終了
function clearDebugMode() {
    window.debugMode = false;
    
    // デバッグパネルを削除
    const mobilePanel = document.getElementById('mobileDebugPanel');
    const debugPanel = document.getElementById('debugPanel');
    
    if (mobilePanel) mobilePanel.remove();
    if (debugPanel) debugPanel.remove();
}

// ========== 初期化処理 ==========

// ページ読み込み完了時の初期化
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Physics Quiz System initialized - Version 2.1');
    
    // 管理画面の初期化
    setupDragAndDrop();
    await loadSavedQuestions(); // この中でloadQuestionsFromUrl()が既に呼ばれる
    updateTestStatus();
    setupViolationDetection();
    
    // タブレット用デバッグ機能を初期化
    setupMobileDebug();
    
    // 提出データやその他のURLパラメータを処理（QRコード処理後）
    setTimeout(() => {
        checkUrlParameters();
    }, 100);
    
    // キャンバス初期化（テスト画面表示時に実行）
    const testScreen = document.getElementById('testScreen');
    if (testScreen) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const target = mutation.target;
                    if (target.id === 'testScreen' && target.style.display !== 'none') {
                        // テスト画面が表示されたときにキャンバスを初期化
                        setTimeout(initCanvas, 100);
                    }
                }
            });
        });
        
        observer.observe(testScreen, {
            attributes: true,
            attributeFilter: ['style']
        });
    }
    
    // 初期画面設定
    showScreen('login');
});

