function checkAuth() {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    const currentPage = window.location.pathname;

    if (!token) {
        if (!currentPage.includes('index.html') && !currentPage.includes('signup.html')) {
            window.location.href = 'index.html';
        }
        return;
    }

    // Redirect based on role
    if (userRole === 'admin') {
        if (currentPage.includes('dashboard.html')) {
            window.location.href = 'admin.html';
        }
    } else if(userRole==="student"){
        if (currentPage.includes('admin.html')) {
            window.location.href = 'dashboard.html';
        }
    }
    else if(userRole==="tpo"){
        if (currentPage.includes('admin.html')) {
            window.location.href = 'tpo-dashboard.html';
        }
    }
    else{
        if(currentPage.includes('admin.html')){
            window.location.href='recruiter-dashboard.html'
        }
    }
}


window.addEventListener('load', initializePage); 
function initializePage() {
    checkAuth();
    const userRole= localStorage.getItem('userRole')
    
    // Set user name in navbar
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        const userName = localStorage.getItem('userName');
        userNameElement.textContent = userName || 'User';
    }
    
    // Load appropriate content based on page
    if (window.location.pathname.includes('admin.html')) {
        loadForAdmin();
    } else if (window.location.pathname.includes('dashboard.html') && userRole==='student') {
        loadSubmission();
    }
    else if (window.location.pathname.includes('tpo-dashboard.html')&& userRole==='tpo')
        loadRecentUploads();

}

// Initialize page


function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    window.location.href = 'index.html';
}

const userEmail= localStorage.getItem('userEmail');
// Handle login form submission
// Helper function to validate file on selection (optional)
function handleFileSelect(event) {
    const file = event.target.files[0];
    const fileLabel = document.querySelector('label[for="resumeFile"] .file-name');
    
    if (file) {
        // Validate file type
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
            alert('Please select only PDF or Word documents');
            event.target.value = '';
            if (fileLabel) fileLabel.textContent = 'No file chosen';
            return;
        }
        
        // Validate file size
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            alert('File size must be less than 10MB');
            event.target.value = '';
            if (fileLabel) fileLabel.textContent = 'No file chosen';
            return;
        }
        
        // Update label with file name
        if (fileLabel) {
            fileLabel.textContent = file.name;
        }
    } else {
        if (fileLabel) fileLabel.textContent = 'No file chosen';
    }
}


function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.warn('Invalid date format:', dateString);
        return 'Invalid Date';
    }
}

function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

