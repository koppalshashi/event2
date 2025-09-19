// admin.js

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        // Use a better UI than alert
        window.location.href = 'admin-login.html';
        return;
    }

    const tableBody = document.getElementById('registrationTable');
    const logoutBtn = document.getElementById('logoutBtn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('adminToken');
            window.location.href = 'admin-login.html';
        });
    }

    try {
        const response = await fetch('https://event1-vk4i.onrender.com/api/admin/registrations', {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('adminToken');
                window.location.href = 'admin-login.html';
            }
            throw new Error('Failed to fetch registrations');
        }

        const registrations = await response.json();
        tableBody.innerHTML = '';

        registrations.forEach(reg => {
            const tr = document.createElement('tr');
            tr.dataset.id = reg._id; // Add data-id for easy lookup

            // Registration data
            const name = `<td>${reg.studentName}</td>`;
            const college = `<td>${reg.college}</td>`;
            const email = `<td>${reg.email}</td>`;
            const event = `<td>${reg.event}</td>`;

            // Payment data (may not exist yet)
            const utr = `<td>${reg.payment ? reg.payment.utrNumber : 'N/A'}</td>`;
            
            // Screenshot link (using new class and fixed path)
            let screenshotHTML = `<td>N/A</td>`;
            if (reg.payment && reg.payment.screenshotPath) {
                screenshotHTML = `<td><a class="screenshot-link" href="https://event1-vk4i.onrender.com/${reg.payment.screenshotPath}" target="_blank">View</a></td>`;
            }

            // Status and Action based on new data fields
            let statusHTML;
            let actionHTML;
            if (reg.isApproved) {
                statusHTML = `<td><span class="status-approved">✅ Approved</span></td>`;
                actionHTML = `<td>—</td>`;
            } else if (reg.isRejected) {
                statusHTML = `<td><span class="status-rejected">❌ Rejected</span></td>`;
                actionHTML = `<td>—</td>`;
            } else {
                statusHTML = `<td><span class="status-pending">⏳ Pending</span></td>`;
                actionHTML = `
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-approve" data-id="${reg._id}">Approve</button>
                            <button class="btn btn-reject" data-id="${reg._id}">Reject</button>
                        </div>
                    </td>`;
            }

            tr.innerHTML = name + college + email + event + utr + screenshotHTML + statusHTML + actionHTML;
            tableBody.appendChild(tr);
        });

        // Attach approve button handlers
        document.querySelectorAll('.btn-approve').forEach(btn => {
            btn.addEventListener('click', async e => {
                const regId = e.target.dataset.id;
                if (confirm('Approve this registration?')) {
                    try {
                        const res = await fetch(`https://event1-vk4i.onrender.com/api/admin/approve/${regId}`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        const data = await res.json();
                        if (res.ok) {
                            showTemporaryMessage('Registration approved and email sent!', 'success');
                            await loadRegistrations(); // Reload data
                        } else {
                            showTemporaryMessage(data.message || 'Approval failed.', 'error');
                        }
                    } catch (err) {
                        console.error(err);
                        showTemporaryMessage('Failed to approve.', 'error');
                    }
                }
            });
        });

        // Attach reject button handlers
        document.querySelectorAll('.btn-reject').forEach(btn => {
            btn.addEventListener('click', async e => {
                const regId = e.target.dataset.id;
                if (confirm('Reject this registration? This cannot be undone.')) {
                    try {
                        const res = await fetch(`https://event1-vk4i.onrender.com/api/admin/reject/${regId}`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        const data = await res.json();
                        if (res.ok) {
                            showTemporaryMessage('Registration rejected!', 'success');
                            await loadRegistrations(); // Reload data
                        } else {
                            showTemporaryMessage(data.message || 'Rejection failed.', 'error');
                        }
                    } catch (err) {
                        console.error(err);
                        showTemporaryMessage('Failed to reject.', 'error');
                    }
                }
            });
        });

    } catch (err) {
        console.error('Error fetching data:', err);
        showTemporaryMessage('Error fetching registrations.', 'error');
    }
});

// A new function to handle loading the registrations
async function loadRegistrations() {
    window.location.reload(); // Simple reload to refresh the page
}

// Temporary message function (Add this to your script)
function showTemporaryMessage(message, type) {
    const msgDiv = document.getElementById("dashboardMessage");
    if (!msgDiv) {
        alert(message); // Fallback to alert if div is missing
        return;
    }

    msgDiv.textContent = message;
    msgDiv.style.backgroundColor = type === "success" ? "#2ecc71" : "#e74c3c";
    msgDiv.style.color = "#fff";
    msgDiv.style.display = "block";
    msgDiv.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
    
    setTimeout(() => {
        msgDiv.style.display = "none";
    }, 4000); // Hide after 4 seconds
}

