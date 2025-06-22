



document.addEventListener("DOMContentLoaded", function () {
  const roleRadios = document.querySelectorAll('input[name="role"]');
  const collegeContainer = document.getElementById('collegeFieldContainer');
  const collegeInput = document.getElementById('collegeName');

  roleRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'student' || radio.value === 'tpo') {
        collegeContainer.style.display = 'block';
        collegeInput.required = true;
      } else {
        collegeContainer.style.display = 'none';
        collegeInput.required = false;
      }
    });
  });
});


async function handleSignup(event) {
    event.preventDefault();
    
    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const spinner = document.getElementById('signupSpinner');
    const role = document.querySelector('input[name="role"]:checked').value;
    

    
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    try {
        spinner.style.display = 'inline-block';
        
        const response = await fetch('https://resume-portal-907r.onrender.com/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fullName, email, passwordHash: password, role  })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }
        
        alert('Registration successful! Please login.');
        window.location.href = 'index.html';
    } catch (error) {
        alert(error.message);
    } finally {
        spinner.style.display = 'none';
    }
}

// Handle login form submission
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const spinner = document.getElementById('loginSpinner');
    
    try {
        spinner.style.display = 'inline-block';
        console.log('Attempting login...');
        
        const response = await fetch('https://resume-portal-907r.onrender.com/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        console.log('Response status:', response.status);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }
        
        console.log('Login successful');
        localStorage.setItem('token', data.token);
        localStorage.setItem('userRole', data.user.role);
        localStorage.setItem('userEmail', data.user.email);
        localStorage.setItem('userName', data.user.fullName || data.user.email);
        if(data.user.collegeName)
        localStorage.setItem('collegeName',data.user.collegeName);
        
        // Redirect based on role
        if (data.user.role === 'admin') 
            window.location.href = 'admin.html';
        else if(data.user.role==='student')
            window.location.href = 'dashboard.html';
        else if(data.user.role==='tpo')
            window.location.href='tpo-dashboard.html';
        else 
        window.location.href='recruiter-dashboard.html';

        
    } catch (error) {
        console.error('Login error:', error);
        alert(error.message || 'Failed to connect to server. Please make sure the server is running.');
    } finally {
        spinner.style.display = 'none';
    }
}