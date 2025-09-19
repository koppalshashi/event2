// admin.js
// admin.js

// Replace with your Render backend URL
const BACKEND_URL = 'https://event2-vo5p.onrender.com';

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
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

    // Function to load registrations
    async function loadRegistrations() {
        try {
const response = await fetch(`${BACKEND_URL}/api/admin/registrations`, {
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
                tr.dataset.id = reg._id;

                // Registration data
                const name = `<td>${reg.studentName}</td>`;
                const college = `<td>${reg.college}</td>`;
                const email = `<td>${reg.email}</td>`;
                const event = `<td>${reg.event}</td>`;

                // Payment data
                const utr = `<td>${reg.payment ? reg.payment.utrNumber : 'N/A'}</td>`;

                // Screenshot from MongoDB
                let screenshotHTML = `<td>N/A</td>`;
                if (reg.payment && reg.payment._id) {
                    screenshotHTML = `<td>
                        <a class="screenshot-link" href="${BACKEND_URL}/payment/${reg.payment._id}/screenshot" target="_blank">View</a>
                    </td>`;
                }

                // Status & Action
                let statusHTML, actionHTML;
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

            // Approve buttons
            document.querySelectorAll('.btn-approve').forEach(btn => {
                btn.addEventListener('click', async e => {
                    const regId = e.target.dataset.id;
                    if (confirm('Approve this registration?')) {
                        try {
                            const res = await fetch(`${BACKEND_URL}/api/admin/approve/${regId}`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}` },
                            });
                            const data = await res.json();
                            if (res.ok) {
                                showTemporaryMessage('Registration approved and email sent!', 'success');
                                await loadRegistrations();
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

            // Reject buttons
            document.querySelectorAll('.btn-reject').forEach(btn => {
                btn.addEventListener('click', async e => {
                    const regId = e.target.dataset.id;
                    if (confirm('Reject this registration? This cannot be undone.')) {
                        try {
                            const res = await fetch(`${BACKEND_URL}/api/admin/reject/${regId}`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}` },
                            });
                            const data = await res.json();
                            if (res.ok) {
                                showTemporaryMessage('Registration rejected!', 'success');
                                await loadRegistrations();
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
            console.error('Error fetching registrations:', err);
            showTemporaryMessage('Error fetching registrations.', 'error');
        }
    }

    // Initial load
    await loadRegistrations();
});

// Temporary message function
function showTemporaryMessage(message, type) {
    const msgDiv = document.getElementById("dashboardMessage");
    if (!msgDiv) {
        alert(message);
        return;
    }

    msgDiv.textContent = message;
    msgDiv.style.backgroundColor = type === "success" ? "#2ecc71" : "#e74c3c";
    msgDiv.style.color = "#fff";
    msgDiv.style.display = "block";
    msgDiv.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";

    setTimeout(() => {
        msgDiv.style.display = "none";
    }, 4000);
}


