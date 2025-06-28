// Global variables to store all submissions and filtered results
let allSubmissions = [];
let filteredSubmissions = [];

async function downloadAllRecords() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Please login again');
            return;
        }

       if(allSubmissions.length>0){
        const response = await fetch('https://resume-portal-907r.onrender.com/api/recruiter/download-records', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ records: allSubmissions }) 
});


        if (!response.ok) {
            throw new Error('Failed to download records');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'submissions.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);}
    } catch (error) {
        console.error('Error downloading records:', error);
        alert('Failed to download records: ' + error.message);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadForRecruiter();
});

async function loadForRecruiter() {
    const recentUploadsContainer = document.getElementById("recentUploads");
    if (!recentUploadsContainer) return console.error("Recent uploads container not found.");

    const jwtToken = localStorage.getItem('token');
    if (!jwtToken) {
        recentUploadsContainer.innerHTML = "<p class='text-danger'>Please log in to view recent uploads.</p>";
        return;
    }

    recentUploadsContainer.innerHTML = "<p>Loading recent uploads...</p>";

    try {
        const res = await fetch("https://resume-portal-907r.onrender.com/api/recruiter/submissions", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${jwtToken}`,
                "Content-Type": "application/json"
            }
        });

        const data = await res.json();

        if (!res.ok) {
            handleHttpError(res.status, data, recentUploadsContainer);
            return;
        }

        // Store all submissions globally
        allSubmissions = data;
        filteredSubmissions = [...data]; // Initially show all
        
        renderSubmissionsTable(filteredSubmissions, recentUploadsContainer);
        updateResultCount(filteredSubmissions.length);
        
    } catch (err) {
        console.error("Error fetching recent uploads:", err);
        recentUploadsContainer.innerHTML = "<p class='text-danger'>Failed to load uploads. Please try again later.</p>";
    }
}

/**
 * Handle search input with debouncing
 */
function handleSearch(event) {
    // Clear existing timeout
    if (window.searchTimeout) {
        clearTimeout(window.searchTimeout);
    }
    
    // Set new timeout for debouncing
    window.searchTimeout = setTimeout(() => {
        performSearch(event.target.value);
    }, 300);
    
    // Also search on Enter key
    if (event.key === 'Enter') {
        clearTimeout(window.searchTimeout);
        performSearch(event.target.value);
    }
}

/**
 * Perform the actual search and sorting
 */
function performSearch(searchQuery) {
    if (!searchQuery.trim()) {
        // If empty search, show all submissions
        filteredSubmissions = [...allSubmissions];
    } else {
        const keywords = searchQuery.toLowerCase().trim().split(/\s+/);
        
        // Filter and score submissions
        const scoredSubmissions = allSubmissions.map(submission => {
            const score = calculateSearchScore(submission, keywords);
            return { ...submission, searchScore: score };
        }).filter(submission => submission.searchScore > 0);
        
        // Sort by score (highest first), then by date (newest first)
        filteredSubmissions = scoredSubmissions.sort((a, b) => {
            if (a.searchScore !== b.searchScore) {
                return b.searchScore - a.searchScore;
            }
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    }
    
    // Re-render table
    const container = document.getElementById("recentUploads");
    renderSubmissionsTable(filteredSubmissions, container);
    updateResultCount(filteredSubmissions.length);
}

/**
 * Calculate search score for a submission
 */
function calculateSearchScore(submission, keywords) {
    let score = 0;
    
    // Get searchable text fields
    const searchableFields = {
        fullName: submission.fullName || '',
        email: submission.email || '',
        institution: submission.institution || '',
        tpoName: submission.tpoName || '',
        mobile: submission.mobile || ''
    };
    
    // Get skills if available (you'll need to fetch this from Resume collection)
    const skills = submission.skills || [];
    
    keywords.forEach(keyword => {
        // Skill matches get highest priority (score: 10 per match)
        skills.forEach(skill => {
            if (skill.toLowerCase().includes(keyword)) {
                score += 10;
            }
        });
        
        // Other field matches (score: 1 per match)
        Object.values(searchableFields).forEach(fieldValue => {
            if (fieldValue.toLowerCase().includes(keyword)) {
                score += 1;
            }
        });
    });
    
    return score;
}

/**
 * Clear search and show all submissions
 */
function clearSearch() {
    document.getElementById('searchInput').value = '';
    filteredSubmissions = [...allSubmissions];
    
    const container = document.getElementById("recentUploads");
    renderSubmissionsTable(filteredSubmissions, container);
    updateResultCount(filteredSubmissions.length);
}

/**
 * Update the result count badge
 */
function updateResultCount(count) {
    const resultCountElement = document.getElementById('resultCount');
    if (resultCountElement) {
        resultCountElement.textContent = `${count} submission${count !== 1 ? 's' : ''}`;
        resultCountElement.className = count === 0 ? 'badge bg-warning' : 'badge bg-info';
    }
}

/**
 * Updated render function that works with the flattened API response
 */
function renderSubmissionsTable(submissions, container) {
    if (!submissions || submissions.length === 0) {
        container.innerHTML = "<p class='text-center text-muted mt-4'>No submissions found matching your search criteria.</p>";
        return;
    }

    let tableHtml = `
        <table class="table table-hover table-striped">
            <thead class="table-dark">
                <tr>
                    <th>Student Name</th>
                    <th>Email</th>
                    <th>Institution</th>
                    <th>Profession</th>
                    <th>TPO Name</th>
                    <th>Resume File</th>
                    <th>Submission Date</th>
                    <th>Type</th>
                </tr>
            </thead>
            <tbody>
    `;

    submissions.forEach(sub => {
        const uploadDate = new Date(sub.createdAt).toLocaleDateString('en-GB');
        const typeClass = sub.type === 'student' ? 'bg-primary' : 'bg-success';
        
        tableHtml += `
            <tr ${sub.searchScore > 10 ? 'class="table-warning"' : ''}>
                <td>
                    ${sub.fullName || 'N/A'}
                    ${sub.searchScore > 10 ? '<i class="fas fa-star text-warning ms-1" title="Skill match"></i>' : ''}
                </td>
                <td>${sub.email || '—'}</td>
                <td>${sub.institution || '—'}</td>
                <td>${sub.profession || '—'}</td>
                <td>${sub.tpoName || '—'}</td>
                <td>
                    <a href="${sub.driveLink}" target="_blank" class="text-decoration-none">
                        View Resume <i class="fas fa-external-link-alt"></i>
                    </a>
                </td>
                <td>${uploadDate}</td>
                <td>
                    <span class="badge ${typeClass}">${sub.type}</span>
                </td>
            </tr>
        `;
    });

    tableHtml += `
            </tbody>
        </table>
    `;

    container.innerHTML = tableHtml;
}

function handleHttpError(status, data, container) {
    switch (status) {
        case 401:
            console.error('Authentication failed for recent uploads:', data.error);
            container.innerHTML = `<p class='text-danger'>Session expired. Please log in again.</p>`;
            clearUserSession();
            setTimeout(() => {
                window.location.href = '/signup.html';
            }, 2000);
            break;
        case 403:
            console.error('Access denied for recent uploads:', data.error);
            container.innerHTML = `<p class='text-danger'>Access denied: ${data.error || 'You do not have permission to view these uploads.'}</p>`;
            break;
        case 404:
            container.innerHTML = "<p class='text-warning'>No recent uploads found for your account.</p>";
            break;
        case 500:
            container.innerHTML = "<p class='text-danger'>Server error. Please try again later.</p>";
            break;
        default:
            console.error(`Error fetching recent uploads: Status ${status}`, data.error);
            container.innerHTML = `<p class='text-danger'>Failed to load uploads: ${data.error || 'An unexpected error occurred.'}</p>`;
    }
}

function clearUserSession() {
    const keysToRemove = ['token', 'userRole', 'userEmail', 'userName', 'collegeName'];
    keysToRemove.forEach(key => localStorage.removeItem(key));
}