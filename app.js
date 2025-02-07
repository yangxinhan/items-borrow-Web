// Firebase 配置
const firebaseConfig = {
    apiKey: "AIzaSyBU4XZ7nqnvkP3F31S9X4Ip2Gd9JrXjf6c",
    authDomain: "items-49542.firebaseapp.com",
    databaseURL: "https://items-49542-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "items-49542",
    storageBucket: "items-49542.appspot.com",
    messagingSenderId: "547160536391",
    appId: "1:547160536391:web:e919ce9507c250d8434862",
    measurementId: "G-4MMDL3BGB6"
};

// 管理員相關常數
const SUPER_ADMINS = ['s1111109@gm.ntpu.edu.tw', 'yang.grace06@gmail.com']; // 超級管理員
let adminList = ['xinhanyang061@gmail.com']; // 預設管理員清單

// 管理員權限檢查函數
function isSuperAdmin(email) {
    return SUPER_ADMINS.includes(email);
}

function isAdmin(email) {
    return SUPER_ADMINS.includes(email) || adminList.includes(email);
}

// 初始化時讀取管理員列表
async function initializeAdminList() {
    try {
        const snapshot = await database.ref('admins').once('value');
        adminList = snapshot.val()?.list || [];
        console.log('管理員列表載入成功:', adminList);
    } catch (error) {
        console.error('載入管理員列表失敗:', error);
    }
}

// 全域變數宣告
let database;
let auth;
let provider;
let currentUser = null;
let authInitialized = false;
let loginInProgress = false;
let scannerMode = false;
let currentDeviceId = null;
let returnScannerMode = false;
let isDarkMode = localStorage.getItem('darkMode') === 'true';
let databaseInitialized = false;

// 常數
const privilegedUsers = ['teacher', 'yang', 'test']; //管理員

// Firebase 初始化函數
async function initializeFirebase() {
    try {
        const app = firebase.initializeApp(firebaseConfig);
        database = firebase.database();
        auth = firebase.auth();
        provider = new firebase.auth.GoogleAuthProvider();
        
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        // 等待初始連接
        await database.ref('.info/connected').once('value');
        databaseInitialized = true;
        console.log('Firebase 初始化成功');
        
        // 初始載入數據
        await updateDevices();
        
        return true;
    } catch (error) {
        console.error('Firebase 初始化失敗:', error);
        return false;
    }
}

// 認證相關狀態變數
// let currentUser = null;
// let authInitialized = false;
// let loginInProgress = false;  // 添加登入狀態追蹤變數

// // 其他狀態變數
// const privilegedUsers = ['teacher', 'yang', 'test']; //管理員
// let scannerMode = false;
// let currentDeviceId = null;
// let returnScannerMode = false;

// 新增分類常數
const CATEGORIES = {
    PHONE: { id: 'phone', name: '手機設備', pattern: /^SAM\d{3}$/ },
    CAMERA: { id: 'camera', name: '攝影設備', pattern: /^(SONY|JVC|INSTA|OBSBOT)\d{3}$/ },
    AUDIO: { id: 'audio', name: '音響設備', pattern: /^(SHURE|RODE|BOYA|SARAMONIC|ALCTRON)\d{3}$/ },
    DRONE: { id: 'drone', name: '空拍設備', pattern: /^TELLO\d{3}$/ },
    MISC: { id: 'misc', name: '其他設備', pattern: /^(MISC|ULANZI|ANKER|GIN|CABLE|PEN|NITECORE|AKG|BELL|AVER)\d{3}$/ }
};

let currentCategory = 'all';

// 將所有 DOM 相關的初始化移到 DOMContentLoaded 事件中
document.addEventListener('DOMContentLoaded', async function() {
    // 先初始化 Firebase
    const initialized = await initializeFirebase();
    if (!initialized) {
        alert('系統初始化失敗，請重新整理頁面');
        return;
    }
    
    // 事件監聽器設置
    document.getElementById('scanButton').addEventListener('click', toggleScanner);
    document.getElementById('barcodeInput').addEventListener('keypress', handleBarcodeScan);
    document.getElementById('returnBarcodeInput').addEventListener('keypress', handleReturnBarcodeScan);
    
    // 分類按鈕監聽器
    document.querySelectorAll('.category-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.category-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentCategory = button.dataset.category;
            updateDevices();
        });
    });

    // 登入相關按鈕
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');
    
    if (loginButton) {
        loginButton.addEventListener('click', handleLogin);
    }
    
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    // 關閉按鈕和點擊外部關閉功能
    document.querySelector('.close-button').addEventListener('click', () => {
        document.getElementById('itemDetailModal').style.display = 'none';
    });

    // 模態框外部點擊關閉
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('itemDetailModal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // 初始化夜間模式
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }
    
    darkModeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', isDarkMode);
        darkModeToggle.style.transform = 'scale(1.1)';
        setTimeout(() => {
            darkModeToggle.style.transform = 'scale(1)';
        }, 200);
    });

    // 初始顯示主頁面
    showApp();
});

// 替換原有的夜間模式初始化代碼
const darkModeToggle = document.getElementById('darkModeToggle');
// let isDarkMode = localStorage.getItem('darkMode') === 'true';

// 初始化夜間模式狀態
if (isDarkMode) {
    document.body.classList.add('dark-mode');
}

// 切換夜間模式
darkModeToggle.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    // 可選：添加動畫效果
    darkModeToggle.style.transform = 'scale(1.1)';
    setTimeout(() => {
        darkModeToggle.style.transform = 'scale(1)';
    }, 200);
});

function toggleScanner() {
    scannerMode = !scannerMode;
    document.getElementById('scannerSection').style.display = scannerMode ? 'block' : 'none';
    document.getElementById('returnScannerSection').style.display = 'none'; // 確保歸還區域關閉
    document.getElementById('scanButton').textContent = scannerMode ? '關閉掃描' : '掃描借用';
    if (scannerMode) {
        resetScannerState();
    }
}

function resetScannerState() {
    currentDeviceId = null;
    document.getElementById('deviceScanStep').style.display = 'block';
    document.getElementById('barcodeInput').value = '';
    document.getElementById('barcodeInput').focus();
}

function handleBarcodeScan(event) {
    if (event.key === 'Enter') {
        const barcode = event.target.value;
        if (!currentDeviceId) {
            processDeviceBarcode(barcode);
        }
        event.target.value = '';
    }
}

function processDeviceBarcode(barcode) {
    if (!currentUser) {
        alert('請先登入');
        return;
    }

    const deviceRef = database.ref('devices');
    deviceRef.orderByChild('borrowId').equalTo(barcode).once('value', (snapshot) => {
        if (snapshot.exists()) {
            const deviceId = Object.keys(snapshot.val())[0];
            const device = snapshot.val()[deviceId];
            
            if (device.borrowed) {
                // 檢查是否為原借用者
                if (device.borrowClass !== currentUser.email) {
                    alert('此設備由其他使用者借出，只能由原借用者歸還');
                    resetScannerState();
                    return;
                }
                returnDevice(deviceId);
                resetScannerState();
                closeScanners();
            } else {
                borrowDevice(deviceId, currentUser.email);
                resetScannerState();
                closeScanners();
                updateDevices();
            }
        } else {
            alert('找不到此條碼對應的設備');
            resetScannerState();
        }
    });
}

function showApp() {
    document.getElementById('appSection').style.display = 'block';
    document.getElementById('historySection').style.display = 'none';
    updateDevices();
}

function borrowDevice(deviceId, borrower) {
    const now = new Date();
    const borrowTime = now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    updateDevice(deviceId, {
        borrowed: true,
        borrowClass: borrower,
        borrowTime: borrowTime
    });
    addBorrowRecord(deviceId, borrower, borrowTime);
}

function logout() {
    currentUser = null;
    showLogin();
    updateCurrentUserDisplay(); // 更新當前用戶顯示
}

function showLogin() {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('appSection').style.display = 'none';
}

function showHistory() {
    document.getElementById('appSection').style.display = 'none';
    document.getElementById('historySection').style.display = 'block';
    setupLiveHistoryUpdates();
}

function setupLiveHistoryUpdates() {
    const historyTable = document.getElementById('historyTable');
    const recordsRef = database.ref('borrowRecords');
    
    recordsRef.orderByChild('borrowTime').on('value', (snapshot) => {
        while (historyTable.rows.length > 1) {
            historyTable.deleteRow(1);
        }

        const records = [];
        snapshot.forEach((childSnapshot) => {
            records.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        records.reverse();

        const devicePromises = records.map(record => 
            database.ref(`devices/${record.deviceId}`).once('value')
        );

        Promise.all(devicePromises).then(deviceSnapshots => {
            const deviceCache = {};
            deviceSnapshots.forEach((snapshot, index) => {
                const device = snapshot.val();
                if (device) {
                    deviceCache[records[index].deviceId] = `${device.borrowId} - ${device.name}`;
                }
            });

            records.forEach(record => {
                const row = historyTable.insertRow();
                const deviceName = deviceCache[record.deviceId] || record.deviceId;
                row.insertCell(0).textContent = deviceName;
                row.insertCell(1).textContent = record.borrower;
                
                // 直接使用 Firebase 中的時間
                row.insertCell(2).textContent = record.borrowTime;
                
                const returnTimeCell = row.insertCell(3);
                if (record.returnTime) {
                    returnTimeCell.textContent = record.returnTime;
                } else {
                    returnTimeCell.textContent = '尚未歸還';
                    returnTimeCell.className = 'status-borrowed';
                }
            });
        });
    });
}

// 更新當前用戶顯示的函數
function updateCurrentUserDisplay() {
    const userDisplayElement = document.getElementById('currentUserDisplay');
    if (currentUser) {
        userDisplayElement.textContent = `使用者: ${currentUser}`;
    } else {
        userDisplayElement.textContent = '';
    }
}

// 初始顯示主頁面
showApp();

// 修改 updateDevices 函數以支援分類
async function updateDevices() {
    if (!databaseInitialized) {
        console.log('等待 Firebase 初始化...');
        return;
    }

    try {
        const snapshot = await database.ref('devices').once('value');
        const devices = snapshot.val();
        if (!devices) {
            console.log('無設備數據');
            return;
        }

        updateDevicesTable(devices);
    } catch (error) {
        console.error('讀取設備數據失敗:', error);
    }
}

// 分離表格更新邏輯
function updateDevicesTable(devices) {
    const table = document.getElementById('deviceTable');
    if (!table) return;
    
    while (table.rows.length > 1) {
        table.deleteRow(1);
    }
    
    const sortedDevices = Object.entries(devices)
        .map(([id, device]) => ({id, ...device}))
        .filter(device => {
            if (currentCategory === 'all') return true;
            return getCategoryById(device.borrowId) === currentCategory;
        })
        .sort((a, b) => a.borrowId.localeCompare(b.borrowId));

    sortedDevices.forEach(device => {
        const row = table.insertRow();
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => showItemDetails(device.id));
        row.insertCell(0).textContent = `${device.borrowId} - ${device.name}`;
        
        const statusCell = row.insertCell(1);
        statusCell.textContent = device.borrowed ? '已借出' : '可借用';
        statusCell.className = device.borrowed ? 'status-borrowed' : 'status-available';
        
        row.insertCell(2).textContent = device.borrowClass || '';
        row.insertCell(3).textContent = device.borrowTime || '';
        row.insertCell(4).textContent = device.note || '';
    });
}

// 根據借閱ID判斷分類
function getCategoryById(borrowId) {
    for (const category of Object.values(CATEGORIES)) {
        if (category.pattern.test(borrowId)) {
            return category.id;
        }
    }
    return 'misc';
}

function returnDevice(deviceId) {
    const deviceRef = database.ref(`devices/${deviceId}`);
    deviceRef.once('value').then((snapshot) => {
        const device = snapshot.val();
        
        // 再次確認是否為原借用者
        if (device.borrowClass !== currentUser.email) {
            alert('只有原借用者可以歸還設備');
            return;
        }

        const returnTime = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
        
        Promise.all([
            updateDevice(deviceId, {
                borrowed: false, 
                borrowClass: '',
                borrowTime: ''
            }),
            updateBorrowRecord(deviceId, device.borrowClass, device.borrowTime, returnTime)
        ]).then(() => {
            alert('設備歸還成功！');
            // 立即更新所有相關畫面
            updateDevices();
            if (document.getElementById('historySection').style.display !== 'none') {
                setupLiveHistoryUpdates();
            }
        });
    });
}

function updateDevice(deviceId, data) {
    return new Promise((resolve, reject) => {
        const deviceRef = database.ref(`devices/${deviceId}`);
        deviceRef.update(data)
            .then(resolve)
            .catch(reject);
    });
}

function addNote(deviceId) {
    const note = prompt("請輸入備註：");
    if (note !== null) {
        updateDevice(deviceId, { note: note });
    }
}

// 添加新的借閱記錄
function addBorrowRecord(deviceId, borrower, borrowTime) {
    const recordRef = database.ref('borrowRecords').push();
    recordRef.set({
        deviceId: deviceId,
        borrower: borrower,
        borrowTime: borrowTime,
        returnTime: ''
    });
}

// 更新借閱記錄的歸還時間
function updateBorrowRecord(deviceId, borrower, borrowTime, returnTime) {
    return new Promise((resolve, reject) => {
        const recordsRef = database.ref('borrowRecords');
        recordsRef.orderByChild('deviceId').equalTo(deviceId).once('value', (snapshot) => {
            const updates = {};
            snapshot.forEach((childSnapshot) => {
                const record = childSnapshot.val();
                if (record.borrower === borrower && record.borrowTime === borrowTime && record.returnTime === '') {
                    updates[`${childSnapshot.key}/returnTime`] = returnTime;
                }
            });
            if (Object.keys(updates).length > 0) {
                recordsRef.update(updates)
                    .then(resolve)
                    .catch(reject);
            } else {
                resolve();
            }
        });
    });
}

function toggleReturnScanner() {
    returnScannerMode = !returnScannerMode;
    const scannerSection = document.getElementById('returnScannerSection');
    scannerSection.style.display = returnScannerMode ? 'block' : 'none';
    document.getElementById('scannerSection').style.display = 'none'; // 確保借用區域關閉
    if (returnScannerMode) {
        document.getElementById('returnBarcodeInput').value = '';
        document.getElementById('returnBarcodeInput').focus();
    }
}

function handleReturnBarcodeScan(event) {
    if (event.key === 'Enter') {
        const barcode = event.target.value;
        processDeviceBarcode(barcode); // 使用相同的處理函數
        event.target.value = '';
    }
}

function closeScanners() {
    // 關閉所有掃描區域
    document.getElementById('scannerSection').style.display = 'none';
    document.getElementById('returnScannerSection').style.display = 'none';
    document.getElementById('scanButton').textContent = '掃描借用';
    scannerMode = false;
    returnScannerMode = false;
}

// 新增顯示物品詳情的相關函數
function showItemDetails(deviceId) {
    const modal = document.getElementById('itemDetailModal');
    const deviceRef = database.ref(`devices/${deviceId}`);
    
    // 移除之前的 "無圖片" 提示
    const existingPlaceholder = document.querySelector('.no-image-placeholder');
    if (existingPlaceholder) {
        existingPlaceholder.remove();
    }
    
    deviceRef.once('value', (snapshot) => {
        const device = snapshot.val();
        if (device) {
            // 更新基本資訊
            document.getElementById('modalItemName').textContent = `${device.name}`;
            document.getElementById('modalItemId').textContent = device.borrowId;
            document.getElementById('modalItemSpecs').textContent = device.specs || '暫無規格說明';
            document.getElementById('modalItemInstructions').textContent = device.instructions || '暫無使用說明';
            document.getElementById('modalItemStatus').textContent = device.borrowed ? '已借出' : '可借用';
            document.getElementById('modalItemStatus').className = device.borrowed ? 'status-borrowed' : 'status-available';
            
            // 處理圖片顯示
            const imageElement = document.getElementById('modalItemImage');
            const imageParent = imageElement.parentElement;
            
            // 清除舊的錯誤提示
            const existingNoImage = imageParent.querySelector('.no-image-placeholder');
            if (existingNoImage) {
                existingNoImage.remove();
            }

            // 解析設備ID來獲取類型和編號
            const match = device.borrowId.match(/([A-Za-z]+)(\d+)/);
            if (match) {
                const [, deviceType, deviceNumber] = match;
                const type = deviceType.toLowerCase();
                const paddedNumber = deviceNumber.padStart(3, '0');
                
                // 嘗試不同的圖片路徑
                const paths = [
                    `./images/${type}/${paddedNumber}.jpg`,
                    `./images/${type}/${paddedNumber}.png`,
                    `./images/${type}/${type}${paddedNumber}.jpg`,
                    `./images/${type}/${type}${paddedNumber}.png`,
                    `./images/${type}/default.jpg`,
                    `./images/${type}/default.png`
                ];

                // 遞迴嘗試載入圖片
                function tryLoadImage(index) {
                    if (index >= paths.length) {
                        // 所有路徑都嘗試過了，顯示無圖片提示
                        console.log('找不到圖片：', device.borrowId);
                        imageElement.style.display = 'none';
                        addNoImagePlaceholder(imageParent);
                        return;
                    }

                    imageElement.src = paths[index];
                    imageElement.style.display = 'block';
                    
                    imageElement.onerror = () => {
                        // 當前路徑失敗，嘗試下一個
                        tryLoadImage(index + 1);
                    };
                }

                // 開始嘗試第一個路徑
                tryLoadImage(0);
            } else {
                // 如果設備ID格式不符合預期
                console.log('無效的設備ID格式：', device.borrowId);
                imageElement.style.display = 'none';
                addNoImagePlaceholder(imageParent);
            }
            
            modal.style.display = 'block';
        }
    });
}

// 新增一個輔助函數來處理無圖片的情況
function addNoImagePlaceholder(container) {
    const noImageDiv = document.createElement('div');
    noImageDiv.className = 'no-image-placeholder';
    noImageDiv.textContent = '暫無圖片';
    container.appendChild(noImageDiv);
}

// 修改 updateDevices 函數中的表格生成部分
async function updateDevices() {
    if (!databaseInitialized) {
        console.log('等待 Firebase 初始化...');
        return;
    }

    try {
        const snapshot = await database.ref('devices').once('value');
        const devices = snapshot.val();
        if (!devices) {
            console.log('無設備數據');
            return;
        }

        updateDevicesTable(devices);
    } catch (error) {
        console.error('讀取設備數據失敗:', error);
    }
}

// 登入相關的輔助函數 - 需要在主要登入函數之前定義
function showLoginButton() {
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');
    if (loginButton) loginButton.style.display = 'inline-flex';
    if (logoutButton) logoutButton.style.display = 'none';
}

function hideLoginButton() {
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');
    if (loginButton) loginButton.style.display = 'none';
    if (logoutButton) logoutButton.style.display = 'inline-flex';
}

function showLoggedInButtons() {
    const buttons = ['scanButton', 'returnButton', 'historyButton'];
    buttons.forEach(id => {
        const button = document.getElementById(id);
        if (button) button.style.display = 'inline-flex';
    });
}

function hideLoggedInButtons() {
    const buttons = ['scanButton', 'returnButton', 'historyButton'];
    buttons.forEach(id => {
        const button = document.getElementById(id);
        if (button) button.style.display = 'none';
    });
}

// 登入相關函數
async function handleLogin() {
    if (loginInProgress) {
        console.log('登入程序進行中，請稍候...');
        return;
    }

    try {
        loginInProgress = true;
        console.log('開始登入流程');
        const result = await auth.signInWithPopup(provider);
        console.log('Google 登入成功', result.user.email);
        currentUser = result.user;
        
        // 檢查權限並顯示相應按鈕
        if (isSuperAdmin(result.user.email)) {
            console.log('是超級管理員');
            showSuperAdminControls();
            showAdminControls();
        } else if (isAdmin(result.user.email)) {
            console.log('是管理員');
            showAdminControls();
        }
        
        hideLoginButton();
        showLoggedInButtons();
        updateCurrentUserDisplay();
    } catch (error) {
        console.error('登入過程發生錯誤:', error);
        if (!currentUser) {
            alert('登入失敗：' + error.message);
        }
    } finally {
        loginInProgress = false;
    }
}

// 修改登出函數
async function handleLogout() {
    try {
        console.log('開始登出流程');
        await auth.signOut();
        console.log('登出成功');
        currentUser = null;
        showLoginButton();
        hideLoggedInButtons();
        updateCurrentUserDisplay();
        // 可選：重新載入頁面
        // window.location.reload();
    } catch (error) {
        console.error('登出失敗:', error);
        alert('登出失敗：' + error.message);
    }
}

// 修改授權狀態監聽器
auth.onAuthStateChanged(async user => {
    if (!authInitialized) {
        authInitialized = true;
        console.log('首次初始化 Auth 狀態');
    }

    console.log('Auth 狀態變更:', user?.email || '未登入');
    
    if (user) {
        currentUser = user;
        console.log('當前用戶:', user.email);
        console.log('是否超級管理員:', isSuperAdmin(user.email));
        console.log('是否管理員:', isAdmin(user.email));
        
        // 移除現有的管理員按鈕
        removeAdminControls();
        
        // 根據權限顯示按鈕
        if (isSuperAdmin(user.email)) {
            console.log('顯示超級管理員控制項');
            showSuperAdminControls();
            showAdminControls();
        } else if (isAdmin(user.email)) {
            console.log('顯示管理員控制項');
            showAdminControls();
        }
        
        hideLoginButton();
        showLoggedInButtons();
        updateCurrentUserDisplay();
        await updateDevices();
    } else {
        currentUser = null;
        showLoginButton();
        hideLoggedInButtons();
        removeAdminControls();
        updateCurrentUserDisplay();
    }
});

// 新增移除管理員控制項的函數
function removeAdminControls() {
    const adminButtons = document.querySelectorAll('.admin-button, .super-admin-button');
    adminButtons.forEach(button => button.remove());
}

// 修改管理員控制項顯示函數
function showAdminControls() {
    // 移除現有的管理員按鈕（如果有的話）
    removeAdminControls();
    
    // 添加管理員按鈕到 header-buttons
    const headerButtons = document.querySelector('.header-buttons');
    const adminButtonsHtml = `
        <button id="addItemButton" class="admin-button">新增物品</button>
        <button id="editItemButton" class="admin-button">編輯物品</button>
        <button id="deleteItemButton" class="admin-button">刪除物品</button>
    `;
    headerButtons.insertAdjacentHTML('beforeend', adminButtonsHtml);

    // 添加事件監聽器
    document.getElementById('addItemButton')?.addEventListener('click', () => {
        console.log('新增物品按鈕點擊');
        showAddItemModal();
    });
    document.getElementById('editItemButton')?.addEventListener('click', () => {
        console.log('編輯物品按鈕點擊');
        toggleItemEditMode();
    });
    document.getElementById('deleteItemButton')?.addEventListener('click', () => {
        console.log('刪除物品按鈕點擊');
        toggleItemDeleteMode();
    });
}

// 修改超級管理員控制項顯示函數
function showSuperAdminControls() {
    const headerButtons = document.querySelector('.header-buttons');
    const superAdminButtonHtml = `
        <button id="manageAdminsButton" class="super-admin-button">管理員設置</button>
    `;
    headerButtons.insertAdjacentHTML('beforeend', superAdminButtonHtml);

    document.getElementById('manageAdminsButton')?.addEventListener('click', () => {
        console.log('管理員設置按鈕點擊');
        showAdminManagementModal();
    });
}

// 移除重複的事件監聽器註冊
document.addEventListener('DOMContentLoaded', function() {
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');
    
    if (loginButton) {
        loginButton.addEventListener('click', handleLogin);
    }
    
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    /* ...其他 DOMContentLoaded 的初始化代碼... */
});

// 更新使用者顯示函數
function updateCurrentUserDisplay() {
    const userDisplayElement = document.getElementById('currentUserDisplay');
    if (!userDisplayElement) return;
    
    if (currentUser) {
        userDisplayElement.textContent = `使用者: ${currentUser.email}`;
    } else {
        userDisplayElement.textContent = '';
    }
}

// 新增管理員按鈕處理函數
function showAdminControls() {
    const adminButtons = `
        <button id="addItemButton" class="admin-button">新增物品</button>
        <button id="editItemButton" class="admin-button">編輯物品</button>
        <button id="deleteItemButton" class="admin-button">刪除物品</button>
    `;
    document.querySelector('.header-buttons').insertAdjacentHTML('beforeend', adminButtons);
    
    // 添加事件監聽器
    document.getElementById('addItemButton').addEventListener('click', showAddItemModal);
    document.getElementById('editItemButton').addEventListener('click', toggleItemEditMode);
    document.getElementById('deleteItemButton').addEventListener('click', toggleItemDeleteMode);
}

function showSuperAdminControls() {
    const superAdminButtons = `
        <button id="manageAdminsButton" class="super-admin-button">管理員設置</button>
    `;
    document.querySelector('.header-buttons').insertAdjacentHTML('beforeend', superAdminButtons);
    
    document.getElementById('manageAdminsButton').addEventListener('click', showAdminManagementModal);
}

// 管理員管理模態框
function showAdminManagementModal() {
    const modalHtml = `
        <div id="adminManagementModal" class="modal">
            <div class="modal-content">
                <span class="close-button">&times;</span>
                <h2>管理員設置</h2>
                <div class="admin-list"></div>
                <div class="admin-add">
                    <input type="email" id="newAdminEmail" placeholder="輸入email">
                    <button onclick="addAdmin()">新增管理員</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    updateAdminList();
}

// 新增管理員
async function addAdmin() {
    if (!isSuperAdmin(currentUser.email)) return;
    
    const email = document.getElementById('newAdminEmail').value;
    if (!email || !email.includes('@')) {
        alert('請輸入有效的email');
        return;
    }
    
    try {
        const newList = [...adminList, email];
        await database.ref('admins').set({ list: newList });
        adminList = newList;
        updateAdminList();
        alert('新增管理員成功');
    } catch (error) {
        console.error('新增管理員失敗:', error);
        alert('新增失敗');
    }
}

// 移除管理員
async function removeAdmin(email) {
    if (!isSuperAdmin(currentUser.email)) return;
    
    try {
        const newList = adminList.filter(admin => admin !== email);
        await database.ref('admins').set({ list: newList });
        adminList = newList;
        updateAdminList();
        alert('移除管理員成功');
    } catch (error) {
        console.error('移除管理員失敗:', error);
        alert('移除失敗');
    }
}

// 更新管理員列表顯示
function updateAdminList() {
    const container = document.querySelector('.admin-list');
    container.innerHTML = `
        <h3>當前管理員列表：</h3>
        <ul>
            ${adminList.map(email => `
                <li>
                    ${email}
                    <button onclick="removeAdmin('${email}')" class="remove-admin">移除</button>
                </li>
            `).join('')}
        </ul>
    `;
}

/* ...existing code... */

// 修改新增物品相關函數
async function showAddItemModal() {
    const modal = document.getElementById('addItemModal');
    modal.style.display = 'block';

    // 清空表單
    document.getElementById('addItemForm').reset();
}

// 修改表單提交處理
document.getElementById('addItemForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('itemName').value,
        borrowId: document.getElementById('itemId').value,
        specs: document.getElementById('itemSpecs').value,
        instructions: document.getElementById('itemInstructions').value,
        borrowed: false,
        borrowClass: '',
        borrowTime: '',
        note: '',
        imageUrl: ''
    };
    
    try {
        // 檢查 borrowId 是否已存在
        const snapshot = await database.ref('devices')
            .orderByChild('borrowId')
            .equalTo(formData.borrowId)
            .once('value');
            
        if (snapshot.exists()) {
            alert('此借用ID已存在！');
            return;
        }

        // 新增物品到資料庫並自動更新顯示
        await addNewItem(formData);
        
    } catch (error) {
        console.error('新增物品失敗:', error);
    }
});

/* ...existing code... */

// 修改新增物品相關函數
async function addNewItem(data) {
    try {
        // 使用 push() 產生新的唯一 key
        const newItemRef = database.ref('devices').push();
        
        // 將資料加入資料庫
        await newItemRef.set({
            ...data,
            id: newItemRef.key
        });
        
        console.log('新增物品成功，ID:', newItemRef.key);
        
        // 直接更新顯示，不需要重新載入頁面
        await updateDevices();
        
        // 關閉模態框
        document.getElementById('addItemModal').style.display = 'none';
        
        // 顯示成功訊息
        alert('新增物品成功！');
        
        return newItemRef.key;
    } catch (error) {
        console.error('新增物品失敗:', error);
        alert('新增失敗：' + error.message);
        throw error;
    }
}

/* ...existing code... */

// 新增物品相關函數
function showAddItemModal() {
    const modal = document.getElementById('addItemModal');
    modal.style.display = 'block';
}

function toggleItemEditMode() {
    console.log('切換編輯模式');
    // 實作編輯功能
}

function toggleItemDeleteMode() {
    console.log('切換刪除模式');
    // 實作刪除功能
}

// 為所有模態框添加關閉功能
document.querySelectorAll('.modal .close-button').forEach(button => {
    button.addEventListener('click', (e) => {
        e.target.closest('.modal').style.display = 'none';
    });
});

// 監聽新增物品表單提交
document.getElementById('addItemForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
        name: document.getElementById('itemName').value,
        borrowId: document.getElementById('itemId').value,
        specs: document.getElementById('itemSpecs').value,
        instructions: document.getElementById('itemInstructions').value,
        borrowed: false,
        note: ''
    };
    
    try {
        await addNewItem(formData);
        document.getElementById('addItemModal').style.display = 'none';
        updateDevices();
    } catch (error) {
        console.error('新增物品失敗:', error);
        alert('新增失敗');
    }
});

async function addNewItem(data) {
    const newItemRef = database.ref('devices').push();
    await newItemRef.set(data);
}

/* ...existing code... */

