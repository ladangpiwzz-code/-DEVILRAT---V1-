class DevilRatLoader {
    constructor() {
        this.progress = 0;
        this.steps = [
            'Initializing Darkness...',
            'Loading Core Modules...',
            'Establishing Connection...',
            'Preparing Interface...',
            'Activating Security...',
            'Launching DEVILRAT...'
        ];
        this.currentStep = 0;
        this.interval = null;
        this.init();
    }

    init() {
        this.updateProgress(0);
        this.animateLoading();
        this.simulateConnection();
        
        // Initialize AOS
        if (typeof AOS !== 'undefined') {
            AOS.init({
                duration: 800,
                easing: 'ease-out-cubic',
                once: true,
                offset: 100
            });
        }
    }

    animateLoading() {
        const progressFill = document.getElementById('progressFill');
        const subtitle = document.querySelector('.loading-subtitle');
        const serverStat = document.getElementById('serverStat');
        const wsStat = document.getElementById('wsStat');
        const secStat = document.getElementById('secStat');
        
        this.interval = setInterval(() => {
            if (this.progress < 100) {
                this.progress += Math.random() * 5;
                if (this.progress > 100) this.progress = 100;
                
                progressFill.style.width = this.progress + '%';
                
                // Update step every 20%
                if (this.progress >= (this.currentStep + 1) * 20) {
                    this.currentStep = Math.min(this.steps.length - 1, Math.floor(this.progress / 20));
                    subtitle.textContent = this.steps[this.currentStep];
                    
                    // Update stats
                    switch(this.currentStep) {
                        case 1:
                            serverStat.textContent = 'ONLINE';
                            serverStat.style.color = '#00ff00';
                            break;
                        case 2:
                            wsStat.textContent = 'CONNECTED';
                            wsStat.style.color = '#00ff00';
                            break;
                        case 3:
                            secStat.textContent = 'ACTIVE';
                            secStat.style.color = '#00ff00';
                            break;
                    }
                }
            } else {
                clearInterval(this.interval);
                this.completeLoading();
            }
        }, 100);
    }

    simulateConnection() {
        // Simulate WebSocket connection
        setTimeout(() => {
            const wsStatus = document.getElementById('wsStatus');
            if (wsStatus) {
                wsStatus.textContent = 'ACTIVE';
                wsStatus.style.color = '#00ff00';
            }
        }, 1500);
        
        // Simulate server connection
        setTimeout(() => {
            const serverUrl = document.getElementById('serverUrl');
            if (serverUrl) {
                const url = window.location.origin;
                serverUrl.textContent = url;
                serverUrl.style.color = '#00ffff';
            }
        }, 2000);
    }

    completeLoading() {
        const loadingScreen = document.getElementById('loadingScreen');
        const appContainer = document.getElementById('appContainer');
        
        // Add completion animation
        loadingScreen.style.opacity = '0';
        
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            appContainer.classList.add('loaded');
            
            // Initialize main app
            if (typeof DevilRatApp !== 'undefined') {
                window.app = new DevilRatApp();
            }
            
            // Show welcome notification
            this.showWelcome();
        }, 500);
    }

    showWelcome() {
        setTimeout(() => {
            const notification = document.createElement('div');
            notification.className = 'welcome-notification';
            notification.innerHTML = `
                <div class="welcome-content">
                    <i class="fas fa-skull-crossbones"></i>
                    <div>
                        <div class="welcome-title">DEVILRAT V1 Ready</div>
                        <div class="welcome-message">Welcome to your control panel</div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            // Auto remove after 3 seconds
            setTimeout(() => {
                notification.classList.add('fade-out');
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }, 1000);
    }

    updateProgress(value) {
        this.progress = value;
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = value + '%';
        }
    }
}

// Start loading when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.loader = new DevilRatLoader();
});

// Add welcome notification styles
const style = document.createElement('style');
style.textContent = `
.welcome-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, rgba(139,0,0,0.9), rgba(0,0,0,0.9));
    border: 2px solid #ff0000;
    border-radius: 10px;
    padding: 15px 20px;
    color: white;
    z-index: 9999;
    animation: slideInRight 0.5s ease;
    box-shadow: 0 10px 30px rgba(255,0,0,0.3);
}

.welcome-content {
    display: flex;
    align-items: center;
    gap: 15px;
}

.welcome-content i {
    font-size: 1.5em;
    color: #ff0000;
}

.welcome-title {
    font-weight: bold;
    font-size: 1.1em;
    color: #ff0000;
}

.welcome-message {
    font-size: 0.9em;
    color: #ccc;
}

.welcome-notification.fade-out {
    animation: fadeOut 0.3s ease forwards;
}

@keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes fadeOut {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(100%); }
}
`;
document.head.appendChild(style);
