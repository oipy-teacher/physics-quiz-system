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

// Google Cloud Vision API設定（実際の運用では環境変数で管理）
const GOOGLE_CLOUD_API_KEY = 'YOUR_API_KEY_HERE'; // 実際のAPIキーに置き換え

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
    document.getElementById('studentLoginDiv').style.display = 'block';
    document.getElementById('studentId').focus();
}

// 学生ログイン
function studentLogin() {
    const inputId = document.getElementById('studentId').value;
    const errorDiv = document.getElementById('loginError');

    // バリデーション
    if (!/^\d{4}$/.test(inputId)) {
        errorDiv.textContent = '学籍番号は4桁の数字で入力してください';
        errorDiv.style.display = 'block';
        return;
    }

    // テストが設定されているかチェック
    if (!testEnabled || questions.length === 0) {
        errorDiv.textContent = 'テストがまだ設定されていません。教員に確認してください。';
        errorDiv.style.display = 'block';
        return;
    }

    studentId = inputId;
    errorDiv.style.display = 'none';

    // テスト画面に遷移
    showScreen('test');
    startTest();
}

// 管理者ログイン
function adminLogin() {
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('loginError');

    if (password !== ADMIN_PASSWORD) {
        errorDiv.textContent = 'パスワードが正しくありません';
        errorDiv.style.display = 'block';
        return;
    }

    errorDiv.style.display = 'none';
    showScreen('admin');
    updateTestStatus();
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
            break;
        case 'result':
            document.getElementById('resultScreen').style.display = 'flex';
            break;
    }
    currentScreen = screen;
}

// ========== 教員用機能 ==========

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
            addQuestion(e.target.result);
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
            addAnswerExample(e.target.result);
        };
        reader.readAsDataURL(file);
    }
}

// 問題追加
function addQuestion(imageData) {
    const questionId = `q${questions.length + 1}`;
    const question = {
        id: questionId,
        number: questions.length + 1,
        image: imageData,
        patterns: []
    };

    questions.push(question);
    renderQuestionList();
    showAdminSuccess('問題を追加しました。正解パターンを設定してください。');
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
function saveQuestions() {
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

    // ローカルストレージに保存
    try {
        localStorage.setItem('physicsQuizQuestions', JSON.stringify(questions));
        localStorage.setItem('physicsQuizAnswerExamples', JSON.stringify(answerExamples));
        testEnabled = true;
        localStorage.setItem('physicsQuizEnabled', 'true');

        showAdminSuccess('問題設定を保存しました。テストが受験可能になりました。');
        updateTestStatus();
    } catch (error) {
        showAdminError('保存に失敗しました。データが大きすぎる可能性があります。');
        console.error('Save error:', error);
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
    } else {
        statusBadge.textContent = '未設定';
        statusBadge.className = 'status-badge status-inactive';
        statusMessage.textContent = '問題が設定されていません';
    }
}

// 保存された問題データを読み込み
function loadSavedQuestions() {
    try {
        const savedQuestions = localStorage.getItem('physicsQuizQuestions');
        const savedAnswerExamples = localStorage.getItem('physicsQuizAnswerExamples');
        const savedEnabled = localStorage.getItem('physicsQuizEnabled');
        
        if (savedQuestions) {
            questions = JSON.parse(savedQuestions);
            renderQuestionList();
        }
        
        if (savedAnswerExamples) {
            answerExamples = JSON.parse(savedAnswerExamples);
            renderAnswerExampleList();
        }
        
        if (savedEnabled === 'true') {
            testEnabled = true;
        }
        
        updateTestStatus();
    } catch (error) {
        console.error('Load error:', error);
        showAdminError('保存されたデータの読み込みに失敗しました。');
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
    canvas = document.getElementById('answerCanvas');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }
    
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Canvas context not available');
        return;
    }
    
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
    
    console.log('Canvas initialized successfully');
}

function resizeCanvas() {
    if (!canvas) return;
    
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    // Canvas設定
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = penSize;
    ctx.strokeStyle = '#000000';
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
    violationCount = 0;
    testData = { answers: [], violations: [] };
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
    if (!testData.answers[currentQuestionIndex]) {
        testData.answers[currentQuestionIndex] = {};
    }
    
    if (inputMethod === 'canvas' && canvas) {
        testData.answers[currentQuestionIndex].canvas = canvas.toDataURL();
        canvasData[currentQuestionIndex] = canvas.toDataURL();
    } else if (inputMethod === 'text') {
        const textAnswer = document.getElementById('textAnswer').value;
        testData.answers[currentQuestionIndex].text = textAnswer;
    }
    
    testData.answers[currentQuestionIndex].method = inputMethod;
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
        
        // 採点処理を開始
        showGradingProgress();
        await performAdvancedGrading();
        
        // 結果画面表示
        showScreen('result');
    }
}

// ========== 高精度採点機能 ==========

// 採点進捗表示
function showGradingProgress() {
    // 進捗モーダルを表示
    const progressModal = document.createElement('div');
    progressModal.id = 'gradingProgressModal';
    progressModal.style.cssText = `
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
    
    progressModal.innerHTML = `
        <div style="background: white; padding: 40px; border-radius: 20px; text-align: center; max-width: 400px;">
            <h3>採点中...</h3>
            <div style="margin: 20px 0;">
                <div id="gradingProgressBar" style="width: 100%; height: 20px; background: #f0f0f0; border-radius: 10px; overflow: hidden;">
                    <div id="gradingProgressFill" style="width: 0%; height: 100%; background: #007aff; transition: width 0.3s;"></div>
                </div>
            </div>
            <p id="gradingProgressText">手書き回答を解析しています...</p>
        </div>
    `;
    
    document.body.appendChild(progressModal);
}

// 高精度採点処理
async function performAdvancedGrading() {
    gradingResults = [];
    
    for (let i = 0; i < questions.length; i++) {
        updateGradingProgress(i, questions.length, `問題${i + 1}を採点中...`);
        
        try {
            const answer = testData.answers[i];
            let ocrResult = { text: '', confidence: 0 };
            
            if (answer) {
                if (answer.method === 'text' && answer.text) {
                    // テキスト入力の場合
                    ocrResult = { 
                        fullText: answer.text,
                        text: answer.text,
                        confidence: 1.0,
                        words: answer.text.split(/\s+/).filter(w => w.length > 0).map(word => ({ text: word, confidence: 1.0 }))
                    };
                    console.log(`Question ${i + 1} - Text input:`, answer.text);
                } else if (answer.method === 'canvas' && answer.canvas) {
                    // 手書き入力の場合はOCR処理
                    ocrResult = await performOCR(answer.canvas);
                    ocrResult.text = ocrResult.fullText || '';
                    console.log(`Question ${i + 1} - Canvas OCR result:`, ocrResult.text);
                } else {
                    console.log(`Question ${i + 1} - No valid answer found`);
                }
            } else {
                console.log(`Question ${i + 1} - No answer data`);
            }
            
            ocrResults[i] = ocrResult;
            
            // 高度なパターンマッチング
            const gradingResult = await performAdvancedPatternMatching(
                ocrResult, 
                questions[i].patterns, 
                i
            );
            
            gradingResults[i] = gradingResult;
            
        } catch (error) {
            console.error(`Grading error for question ${i + 1}:`, error);
            gradingResults[i] = {
                correct: false,
                confidence: 0,
                recognizedText: 'エラー',
                matchedPattern: null,
                error: error.message
            };
        }
        
        // 進捗更新
        await new Promise(resolve => setTimeout(resolve, 500)); // 視覚的な進捗表示
    }
    
    // 進捗モーダルを閉じる
    const progressModal = document.getElementById('gradingProgressModal');
    if (progressModal) {
        progressModal.remove();
    }
    
    // 結果計算と表示
    calculateResults();
    
    // 提出結果を保存
    saveSubmissionResult();
}

// 採点進捗更新
function updateGradingProgress(current, total, message) {
    const progressFill = document.getElementById('gradingProgressFill');
    const progressText = document.getElementById('gradingProgressText');
    
    if (progressFill) {
        const percentage = ((current + 1) / total) * 100;
        progressFill.style.width = `${percentage}%`;
    }
    
    if (progressText) {
        progressText.textContent = message;
    }
}

// OCR処理（Google Cloud Vision API使用）
async function performOCR(imageDataUrl) {
    // 実際のAPIキーが設定されていない場合はフォールバック
    if (GOOGLE_CLOUD_API_KEY === 'YOUR_API_KEY_HERE') {
        return await performFallbackOCR(imageDataUrl);
    }
    
    try {
        // Base64データからimage部分を抽出
        const base64Image = imageDataUrl.split(',')[1];
        
        const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                requests: [{
                    image: {
                        content: base64Image
                    },
                    features: [
                        { type: 'TEXT_DETECTION', maxResults: 10 },
                        { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }
                    ],
                    imageContext: {
                        languageHints: ['ja', 'en']
                    }
                }]
            })
        });
        
        const result = await response.json();
        
        if (result.responses && result.responses[0]) {
            const textAnnotations = result.responses[0].textAnnotations;
            if (textAnnotations && textAnnotations.length > 0) {
                return {
                    fullText: textAnnotations[0].description,
                    words: textAnnotations.slice(1).map(annotation => ({
                        text: annotation.description,
                        confidence: annotation.confidence || 0.9
                    })),
                    confidence: textAnnotations[0].confidence || 0.9
                };
            }
        }
        
        return { fullText: '', words: [], confidence: 0 };
        
    } catch (error) {
        console.error('Google Cloud Vision API error:', error);
        return await performFallbackOCR(imageDataUrl);
    }
}

// フォールバックOCR（Tesseract.js使用）
async function performFallbackOCR(imageDataUrl) {
    try {
        // Tesseract.jsがロードされていない場合は動的ロード
        if (typeof Tesseract === 'undefined') {
            await loadTesseract();
        }
        
        const { data: { text, confidence } } = await Tesseract.recognize(
            imageDataUrl,
            'jpn+eng',
            {
                logger: m => console.log(m)
            }
        );
        
        return {
            fullText: text.trim(),
            words: text.split(/\s+/).filter(word => word.length > 0).map(word => ({
                text: word,
                confidence: confidence / 100
            })),
            confidence: confidence / 100
        };
        
    } catch (error) {
        console.error('Tesseract OCR error:', error);
        return {
            fullText: '',
            words: [],
            confidence: 0,
            error: error.message
        };
    }
}

// Tesseract.js動的ロード
async function loadTesseract() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/tesseract.js@4/dist/tesseract.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// 高度なパターンマッチング
async function performAdvancedPatternMatching(ocrResult, correctPatterns, questionIndex) {
    const recognizedText = ocrResult.fullText || ocrResult.text || '';
    console.log(`Pattern matching for question ${questionIndex + 1}:`);
    console.log('Recognized text:', recognizedText);
    console.log('Correct patterns:', correctPatterns);
    
    if (!correctPatterns || correctPatterns.length === 0) {
        console.log('No correct patterns defined');
        return {
            correct: false,
            confidence: 0,
            recognizedText: recognizedText,
            matchedPattern: null,
            bestMatch: null,
            allMatches: []
        };
    }
    
    let bestMatch = null;
    let highestScore = 0;
    let matchedPattern = null;
    
    for (const pattern of correctPatterns) {
        const score = calculateMatchScore(recognizedText, pattern, ocrResult);
        console.log(`Pattern "${pattern}" score:`, score);
        
        if (score > highestScore) {
            highestScore = score;
            matchedPattern = pattern;
            bestMatch = {
                pattern: pattern,
                score: score,
                recognizedText: recognizedText
            };
        }
    }
    
    // 閾値を設定（70%以上で正解とする - テキスト入力の場合は厳密に）
    const threshold = ocrResult.confidence === 1.0 ? 0.7 : 0.6; // テキスト入力は厳しく
    const isCorrect = highestScore >= threshold;
    
    console.log(`Best match: "${matchedPattern}" with score ${highestScore}`);
    console.log(`Threshold: ${threshold}, Correct: ${isCorrect}`);
    
    return {
        correct: isCorrect,
        confidence: highestScore,
        recognizedText: recognizedText,
        matchedPattern: matchedPattern,
        bestMatch: bestMatch,
        allMatches: correctPatterns.map(pattern => ({
            pattern: pattern,
            score: calculateMatchScore(recognizedText, pattern, ocrResult)
        })).sort((a, b) => b.score - a.score)
    };
}

// マッチスコア計算（複数の手法を組み合わせ）
function calculateMatchScore(recognizedText, pattern, ocrResult) {
    if (!recognizedText || !pattern) {
        return 0;
    }
    
    // 1. 正規化
    const normalizedRecognized = normalizeText(recognizedText);
    const normalizedPattern = normalizeText(pattern);
    
    console.log(`Comparing: "${normalizedRecognized}" vs "${normalizedPattern}"`);
    
    // 2. 完全一致チェック
    if (normalizedRecognized === normalizedPattern) {
        console.log('Exact match found!');
        return 1.0;
    }
    
    // 大文字小文字を無視した一致
    if (normalizedRecognized.toLowerCase() === normalizedPattern.toLowerCase()) {
        console.log('Case-insensitive match found!');
        return 0.95;
    }
    
    // 部分一致チェック（含まれているか）
    if (normalizedRecognized.includes(normalizedPattern) || normalizedPattern.includes(normalizedRecognized)) {
        console.log('Partial inclusion match found!');
        return 0.9;
    }
    
    // 3. 編集距離（レーベンシュタイン距離）
    const editDistance = calculateLevenshteinDistance(normalizedRecognized, normalizedPattern);
    const maxLength = Math.max(normalizedRecognized.length, normalizedPattern.length);
    const editScore = maxLength > 0 ? 1 - (editDistance / maxLength) : 0;
    
    // 4. 部分一致スコア
    const partialScore = calculatePartialMatchScore(normalizedRecognized, normalizedPattern);
    
    // 5. 数値・単位の特別処理
    const numericScore = calculateNumericMatchScore(normalizedRecognized, normalizedPattern);
    
    // 6. 音韻類似度（カタカナ・ひらがな変換）
    const phoneticScore = calculatePhoneticScore(normalizedRecognized, normalizedPattern);
    
    // 7. OCR信頼度を考慮
    const confidenceWeight = ocrResult.confidence || 0.5;
    
    // 重み付き平均でスコア計算
    const finalScore = (
        editScore * 0.4 +
        partialScore * 0.3 +
        numericScore * 0.2 +
        phoneticScore * 0.1
    );
    
    // テキスト入力の場合は信頼度を高く保つ
    const adjustedScore = ocrResult.confidence === 1.0 ? finalScore : finalScore * confidenceWeight;
    
    console.log(`Scores - Edit: ${editScore}, Partial: ${partialScore}, Numeric: ${numericScore}, Phonetic: ${phoneticScore}, Final: ${adjustedScore}`);
    
    return Math.min(1.0, Math.max(0, adjustedScore));
}

// テキスト正規化
function normalizeText(text) {
    return text
        .toLowerCase()
        .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) // 全角数字を半角に
        .replace(/[Ａ-Ｚａ-ｚ]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) // 全角英字を半角に
        .replace(/\s+/g, '') // 空白除去
        .replace(/[.,、。]/g, '') // 句読点除去
        .trim();
}

// レーベンシュタイン距離計算
function calculateLevenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

// 部分一致スコア計算
function calculatePartialMatchScore(recognized, pattern) {
    if (recognized.includes(pattern) || pattern.includes(recognized)) {
        const shorter = recognized.length < pattern.length ? recognized : pattern;
        const longer = recognized.length >= pattern.length ? recognized : pattern;
        return shorter.length / longer.length;
    }
    
    // 共通部分文字列の長さを計算
    let maxCommonLength = 0;
    for (let i = 0; i < recognized.length; i++) {
        for (let j = 0; j < pattern.length; j++) {
            let commonLength = 0;
            while (
                i + commonLength < recognized.length &&
                j + commonLength < pattern.length &&
                recognized[i + commonLength] === pattern[j + commonLength]
            ) {
                commonLength++;
            }
            maxCommonLength = Math.max(maxCommonLength, commonLength);
        }
    }
    
    return maxCommonLength / Math.max(recognized.length, pattern.length);
}

// 数値マッチスコア計算
function calculateNumericMatchScore(recognized, pattern) {
    const recognizedNumbers = recognized.match(/\d+\.?\d*/g) || [];
    const patternNumbers = pattern.match(/\d+\.?\d*/g) || [];
    
    if (recognizedNumbers.length === 0 && patternNumbers.length === 0) {
        return 0.5; // 数値がない場合は中立
    }
    
    if (recognizedNumbers.length !== patternNumbers.length) {
        return 0.3; // 数値の個数が違う場合は低スコア
    }
    
    let totalScore = 0;
    for (let i = 0; i < recognizedNumbers.length; i++) {
        const recNum = parseFloat(recognizedNumbers[i]);
        const patNum = parseFloat(patternNumbers[i]);
        
        if (recNum === patNum) {
            totalScore += 1.0;
        } else {
            // 数値の近似度を計算
            const diff = Math.abs(recNum - patNum);
            const avg = (recNum + patNum) / 2;
            const similarity = Math.max(0, 1 - (diff / Math.max(avg, 1)));
            totalScore += similarity;
        }
    }
    
    return totalScore / recognizedNumbers.length;
}

// 音韻類似度計算
function calculatePhoneticScore(recognized, pattern) {
    // ひらがな・カタカナの変換マップ
    const hiraganaToKatakana = (str) => {
        return str.replace(/[\u3041-\u3096]/g, (match) => {
            return String.fromCharCode(match.charCodeAt(0) + 0x60);
        });
    };
    
    const katakanaToHiragana = (str) => {
        return str.replace(/[\u30a1-\u30f6]/g, (match) => {
            return String.fromCharCode(match.charCodeAt(0) - 0x60);
        });
    };
    
    // 両方をひらがなに統一して比較
    const recognizedHiragana = katakanaToHiragana(recognized);
    const patternHiragana = katakanaToHiragana(pattern);
    
    if (recognizedHiragana === patternHiragana) {
        return 1.0;
    }
    
    // 両方をカタカナに統一して比較
    const recognizedKatakana = hiraganaToKatakana(recognized);
    const patternKatakana = hiraganaToKatakana(pattern);
    
    if (recognizedKatakana === patternKatakana) {
        return 1.0;
    }
    
    return 0;
}

// 結果計算（高精度版）
function calculateResults() {
    console.log('calculateResults called');
    console.log('gradingResults:', gradingResults);
    console.log('questions:', questions);
    console.log('answerExamples:', answerExamples);
    
    let correctCount = 0;
    const results = [];
    
    questions.forEach((question, index) => {
        const gradingResult = gradingResults[index];
        const isCorrect = gradingResult ? gradingResult.correct : false;
        
        if (isCorrect) correctCount++;
        
        // 回答データを取得
        const answer = testData.answers[index];
        let userAnswerText = '未回答';
        
        if (answer) {
            if (answer.method === 'text' && answer.text) {
                userAnswerText = answer.text;
            } else if (answer.method === 'canvas' && gradingResult) {
                userAnswerText = gradingResult.recognizedText || '認識できませんでした';
            }
        }
        
        results.push({
            questionNumber: index + 1,
            correct: isCorrect,
            userAnswer: userAnswerText,
            correctAnswers: question.patterns || [],
            confidence: gradingResult ? gradingResult.confidence : 0,
            matchedPattern: gradingResult ? gradingResult.matchedPattern : null,
            gradingDetails: gradingResult
        });
    });
    
    console.log('results:', results);
    
    // 結果表示
    const correctCountElement = document.getElementById('correctCount');
    const totalCountElement = document.getElementById('totalCount');
    
    if (correctCountElement) {
        correctCountElement.textContent = correctCount;
    }
    
    if (totalCountElement) {
        totalCountElement.textContent = questions.length;
    }
    
    const detailsContainer = document.getElementById('resultDetails');
    if (detailsContainer) {
        detailsContainer.innerHTML = results.map(result => `
            <div class="result-item" style="flex-direction: column; align-items: flex-start; padding: 15px; background-color: white; border: 1px solid #e0e0e0; border-radius: 10px; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: 15px;">
                    <span style="font-size: 18px;"><strong>問題${result.questionNumber}</strong></span>
                    <span class="${result.correct ? 'correct' : 'incorrect'}" style="font-weight: bold; padding: 5px 15px; border-radius: 20px; color: white; background-color: ${result.correct ? '#34c759' : '#ff3b30'};">
                        ${result.correct ? '正解' : '不正解'}
                    </span>
                </div>
                
                <div class="your-answer" style="width: 100%; margin-bottom: 10px;">
                    <strong>あなたの回答:</strong> ${result.userAnswer}
                </div>
                
                <div class="correct-answers" style="width: 100%; margin-bottom: 10px;">
                    <strong>模範解答:</strong> ${result.correctAnswers.join(', ') || '設定されていません'}
                </div>
                
                ${answerExamples && answerExamples[result.questionNumber - 1] ? `
                    <div style="margin: 10px 0; width: 100%;">
                        <strong>解答例画像:</strong><br>
                        <img src="${answerExamples[result.questionNumber - 1].image}" 
                             style="max-width: 300px; max-height: 200px; border: 1px solid #e0e0e0; border-radius: 5px; margin-top: 5px;">
                    </div>
                ` : ''}
                
                ${result.matchedPattern ? `
                    <div class="matched-pattern" style="width: 100%; margin-bottom: 10px;">
                        <strong>マッチしたパターン:</strong> ${result.matchedPattern}
                    </div>
                ` : ''}
                
                <div style="font-size: 14px; color: #666; width: 100%;">
                    <strong>判定信頼度:</strong> ${Math.round(result.confidence * 100)}%
                    <div style="width: 100%; height: 8px; background-color: #e0e0e0; border-radius: 4px; margin-top: 5px;">
                        <div style="width: ${Math.round(result.confidence * 100)}%; height: 100%; background: linear-gradient(90deg, #dc3545, #ffc107, #28a745); border-radius: 4px;"></div>
                    </div>
                </div>
            </div>
        `).join('');
    } else {
        console.error('resultDetails container not found');
    }
}

// 不正検知設定
function setupViolationDetection() {
    // タブ離脱検知
    document.addEventListener('visibilitychange', function() {
        if (currentScreen === 'test' && document.hidden) {
            violationCount++;
            const violationCountElement = document.getElementById('violationCount');
            if (violationCountElement) {
                violationCountElement.textContent = violationCount;
            }
            showWarning();
            
            // 違反記録
            testData.violations.push({
                type: 'tab_switch',
                timestamp: new Date(),
                count: violationCount
            });
        }
    });
    
    // 右クリック無効化
    document.addEventListener('contextmenu', function(e) {
        if (currentScreen === 'test') {
            e.preventDefault();
        }
    });
    
    // キーボードショートカット無効化
    document.addEventListener('keydown', function(e) {
        if (currentScreen === 'test') {
            // F12, Ctrl+Shift+I, Ctrl+U などを無効化
            if (e.key === 'F12' || 
                (e.ctrlKey && e.shiftKey && e.key === 'I') ||
                (e.ctrlKey && e.key === 'u')) {
                e.preventDefault();
            }
        }
    });
}

function showWarning() {
    const warningModal = document.getElementById('warningModal');
    if (warningModal) {
        warningModal.style.display = 'flex';
    }
}

function closeWarning() {
    const warningModal = document.getElementById('warningModal');
    if (warningModal) {
        warningModal.style.display = 'none';
    }
}

// ========== 提出結果管理機能 ==========

// 提出結果を保存
function saveSubmissionResult() {
    if (!studentId || !gradingResults || gradingResults.length === 0) {
        console.error('No student ID or grading results to save');
        return;
    }
    
    // 正解数計算
    let correctCount = 0;
    const detailedResults = [];
    
    questions.forEach((question, index) => {
        const gradingResult = gradingResults[index];
        const isCorrect = gradingResult ? gradingResult.correct : false;
        
        if (isCorrect) correctCount++;
        
        // 回答データを取得
        const answer = testData.answers[index];
        let userAnswerText = '未回答';
        
        if (answer) {
            if (answer.method === 'text' && answer.text) {
                userAnswerText = answer.text;
            } else if (answer.method === 'canvas' && gradingResult) {
                userAnswerText = gradingResult.recognizedText || '認識できませんでした';
            }
        }
        
        detailedResults.push({
            questionNumber: index + 1,
            correct: isCorrect,
            userAnswer: userAnswerText,
            correctAnswers: question.patterns || [],
            confidence: gradingResult ? gradingResult.confidence : 0,
            matchedPattern: gradingResult ? gradingResult.matchedPattern : null
        });
    });
    
    const submissionResult = {
        studentId: studentId,
        submissionTime: new Date().toLocaleString('ja-JP'),
        timestamp: Date.now(),
        score: correctCount,
        totalQuestions: questions.length,
        percentage: Math.round((correctCount / questions.length) * 100),
        detailedResults: detailedResults,
        testDuration: startTime ? Math.floor((new Date() - startTime) / 1000) : 0,
        violationCount: violationCount
    };
    
    // ローカルストレージに保存
    try {
        const existingResults = JSON.parse(localStorage.getItem('physicsQuizSubmissions') || '[]');
        
        // 同じ学籍番号の既存結果を削除（最新のみ保持）
        const filteredResults = existingResults.filter(result => result.studentId !== studentId);
        filteredResults.push(submissionResult);
        
        localStorage.setItem('physicsQuizSubmissions', JSON.stringify(filteredResults));
        console.log('Submission result saved:', submissionResult);
    } catch (error) {
        console.error('Failed to save submission result:', error);
    }
}

// 提出結果一覧を表示
function showSubmissionResults() {
    const container = document.getElementById('submissionResultsContainer');
    const listContainer = document.getElementById('submissionResultsList');
    
    if (!container || !listContainer) {
        showAdminError('結果表示エリアが見つかりません。');
        return;
    }
    
    try {
        const submissions = JSON.parse(localStorage.getItem('physicsQuizSubmissions') || '[]');
        
        if (submissions.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">まだ提出結果がありません。</p>';
            container.style.display = 'block';
            return;
        }
        
        // 提出時間順でソート（新しい順）
        submissions.sort((a, b) => b.timestamp - a.timestamp);
        
        listContainer.innerHTML = submissions.map(submission => `
            <div class="submission-result-item">
                <div class="student-header">
                    <div class="student-id">学籍番号: ${submission.studentId}</div>
                    <div class="submission-time">提出日時: ${submission.submissionTime}</div>
                </div>
                
                <div class="score-summary">
                    <div class="score-badge">${submission.score} / ${submission.totalQuestions}</div>
                    <div class="score-percentage">正答率: ${submission.percentage}%</div>
                    <div class="score-percentage">所要時間: ${Math.floor(submission.testDuration / 60)}分${submission.testDuration % 60}秒</div>
                    <div class="score-percentage ${submission.violationCount > 0 ? 'violation-warning' : ''}">
                        不正行為: ${submission.violationCount}回
                    </div>
                </div>
                
                <div class="question-details">
                    ${submission.detailedResults.map(result => `
                        <div class="question-detail ${result.correct ? 'correct' : 'incorrect'}">
                            <div class="question-detail-header">
                                <span class="question-number">問題${result.questionNumber}</span>
                                <span class="result-status ${result.correct ? 'correct' : 'incorrect'}">
                                    ${result.correct ? '正解' : '不正解'}
                                </span>
                            </div>
                            <div class="answer-comparison">
                                <div class="student-answer"><strong>回答:</strong> ${result.userAnswer}</div>
                                <div class="correct-answer"><strong>正解:</strong> ${result.correctAnswers.join(', ')}</div>
                                ${result.matchedPattern ? `<div style="color: #28a745; font-size: 12px;"><strong>マッチ:</strong> ${result.matchedPattern}</div>` : ''}
                                <div style="color: #666; font-size: 12px;"><strong>信頼度:</strong> ${Math.round(result.confidence * 100)}%</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
        
        container.style.display = 'block';
        showAdminSuccess(`${submissions.length}件の提出結果を表示しました。`);
        
    } catch (error) {
        console.error('Failed to load submission results:', error);
        showAdminError('提出結果の読み込みに失敗しました。');
    }
}

// Excelファイルとしてダウンロード
function exportToExcel() {
    try {
        const submissions = JSON.parse(localStorage.getItem('physicsQuizSubmissions') || '[]');
        
        if (submissions.length === 0) {
            showAdminError('エクスポートする提出結果がありません。');
            return;
        }
        
        // CSVデータを作成
        let csvContent = '\uFEFF'; // BOM for UTF-8
        
        // ヘッダー行
        csvContent += '学籍番号,提出日時,得点,総問題数,正答率(%),所要時間(秒),不正行為回数';
        
        // 問題ごとの詳細ヘッダーを追加
        const maxQuestions = Math.max(...submissions.map(s => s.totalQuestions));
        for (let i = 1; i <= maxQuestions; i++) {
            csvContent += `,問題${i}_結果,問題${i}_回答,問題${i}_正解,問題${i}_信頼度(%)`;
        }
        csvContent += '\n';
        
        // データ行
        submissions.sort((a, b) => b.timestamp - a.timestamp).forEach(submission => {
            const row = [
                submission.studentId,
                submission.submissionTime,
                submission.score,
                submission.totalQuestions,
                submission.percentage,
                submission.testDuration,
                submission.violationCount
            ];
            
            // 問題ごとの詳細データを追加
            for (let i = 0; i < maxQuestions; i++) {
                const result = submission.detailedResults[i];
                if (result) {
                    row.push(
                        result.correct ? '正解' : '不正解',
                        `"${result.userAnswer.replace(/"/g, '""')}"`, // CSVエスケープ
                        `"${result.correctAnswers.join(', ').replace(/"/g, '""')}"`,
                        Math.round(result.confidence * 100)
                    );
                } else {
                    row.push('', '', '', '');
                }
            }
            
            csvContent += row.join(',') + '\n';
        });
        
        // ファイルダウンロード
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const now = new Date();
        const filename = `物理テスト結果_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showAdminSuccess(`${submissions.length}件の結果をExcelファイル（${filename}）としてダウンロードしました。`);
        
    } catch (error) {
        console.error('Failed to export to Excel:', error);
        showAdminError('Excelエクスポートに失敗しました。');
    }
}

// 全提出結果をクリア
function clearAllResults() {
    if (confirm('全ての提出結果を削除しますか？この操作は取り消せません。')) {
        try {
            localStorage.removeItem('physicsQuizSubmissions');
            
            const container = document.getElementById('submissionResultsContainer');
            if (container) {
                container.style.display = 'none';
            }
            
            showAdminSuccess('全ての提出結果を削除しました。');
        } catch (error) {
            console.error('Failed to clear submission results:', error);
            showAdminError('提出結果の削除に失敗しました。');
        }
    }
}

// ========== 初期化処理 ==========

// ページ読み込み完了時の初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('Physics Quiz System initialized');
    
    // 管理画面の初期化
    setupDragAndDrop();
    loadSavedQuestions();
    updateTestStatus();
    setupViolationDetection();
    
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
