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

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let currentUser = null;
const privilegedUsers = ['teacher', 'yang']; // 特權用戶列表

function login() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    
    // 從數據庫中檢查用戶
    database.ref('users/' + email.replace('.', ',')).once('value')
        .then((snapshot) => {
            if (snapshot.exists() && snapshot.val() === password) {
                // 登入成功
                currentUser = email;
                showApp();
                updateCurrentUserDisplay(); // 新增：更新當前用戶顯示
            } else {
                alert('登入失敗: 帳號或密碼錯誤');
            }
        })
        .catch((error) => {
            console.error('登入錯誤:', error);
            alert('登入失敗: ' + error.message);
        });
}

function logout() {
    currentUser = null;
    showLogin();
    updateCurrentUserDisplay(); // 新增：更新當前用戶顯示（清空）
}

function showLogin() {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('appSection').style.display = 'none';
}

function showApp() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('appSection').style.display = 'block';
    updateDevices();
    updateCurrentUserDisplay(); // 新增：更新當前用戶顯示
}

// 新增：更新當前用戶顯示的函數
function updateCurrentUserDisplay() {
    const userDisplayElement = document.getElementById('currentUserDisplay');
    if (currentUser) {
        userDisplayElement.textContent = `使用者: ${currentUser}`;
    } else {
        userDisplayElement.textContent = '';
    }
}

// 初始顯示登入界面
showLogin();

function updateDevices() {
    const devicesRef = database.ref('devices');
    devicesRef.on('value', (snapshot) => {
        const devices = snapshot.val();
        const table = document.getElementById('deviceTable');
        // 清除舊的行,保留表頭
        while (table.rows.length > 1) {
            table.deleteRow(1);
        }
        // 添加新的行
        for (const [id, device] of Object.entries(devices)) {
            const row = table.insertRow();
            row.insertCell(0).textContent = device.name;
            row.insertCell(1).textContent = device.borrowed ? '已借出' : '可借用';
            row.insertCell(2).textContent = device.borrowClass || '';
            row.insertCell(3).textContent = device.borrowTime || '';
            row.insertCell(4).textContent = device.note || '';
            
            const actionCell = row.insertCell(5);
            const actionButton = document.createElement('button');
            actionButton.textContent = device.borrowed ? '歸還' : '借出';
            
            // 修改這裡：檢查是否為借出者或特權用戶
            const canReturn = device.borrowed && (device.borrowClass.startsWith(currentUser) || privilegedUsers.includes(currentUser));
            actionButton.onclick = () => device.borrowed ? (canReturn ? returnDevice(id) : alert('只有借出者或管理員可以歸還')) : borrowDevice(id);
            actionButton.disabled = device.borrowed && !canReturn;
            
            actionCell.appendChild(actionButton);

            // 為特權用戶添加備註按鈕
            if (privilegedUsers.includes(currentUser)) {
                const noteButton = document.createElement('button');
                noteButton.textContent = '添加備註';
                noteButton.onclick = () => addNote(id);
                actionCell.appendChild(noteButton);
            }
        }
    });
}

function borrowDevice(deviceId) {
    const className = `${currentUser}`;
    const classNumber = prompt("請輸入座號：");
    const name = prompt("請輸入姓名：");
    const borrowClass = className + " " + classNumber + " " + name;
    if (borrowClass) {
        const now = new Date();
        const borrowTime = now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
        updateDevice(deviceId, {
            borrowed: true, 
            borrowClass: borrowClass,
            borrowTime: borrowTime
        });
    } else if (borrowClass !== null) {
        alert('請輸入有效的班級名稱');
    }
}

function returnDevice(deviceId) {
    const deviceRef = database.ref(`devices/${deviceId}`);
    deviceRef.once('value').then((snapshot) => {
        const device = snapshot.val();
        if (device.borrowClass.startsWith(currentUser) || privilegedUsers.includes(currentUser)) {
            updateDevice(deviceId, {
                borrowed: false, 
                borrowClass: '',
                borrowTime: ''
            });
        } else {
            alert('只有借出者或管理員可以歸還設備');
        }
    });
}

function updateDevice(deviceId, data) {
    const deviceRef = database.ref(`devices/${deviceId}`);
    deviceRef.update(data);
}

function addNote(deviceId) {
    const note = prompt("請輸入備註：");
    if (note !== null) {
        updateDevice(deviceId, { note: note });
    }
}