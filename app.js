// 您的 Firebase 配置
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

function login() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    
    // 從數據庫中檢查用戶
    database.ref('users/' + email.replace('.', ',')).once('value')
        .then((snapshot) => {
            if (snapshot.exists() && snapshot.val() === password) {
                // 登入成功
                showApp();
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
    showLogin();
}

function showLogin() {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('appSection').style.display = 'none';
}

function showApp() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('appSection').style.display = 'block';
    updateDevices();
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
            actionButton.onclick = () => device.borrowed ? returnDevice(id) : borrowDevice(id);
            actionCell.appendChild(actionButton);
        }
    });
}

function borrowDevice(deviceId) {
    const a = prompt("請輸入班級：");
    const b = prompt("請輸入座號：");
    const c = prompt("請輸入姓名：");
    const borrowClass = a + b + c;
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
    updateDevice(deviceId, {
        borrowed: false, 
        borrowClass: '',
        borrowTime: ''
    });
}

function updateDevice(deviceId, data) {
    const deviceRef = database.ref(`devices/${deviceId}`);
    deviceRef.update(data);
}