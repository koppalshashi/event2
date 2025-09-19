document.addEventListener('DOMContentLoaded', () => {
    const formSteps = document.querySelectorAll('.form-step');
    const progressSteps = document.querySelectorAll('.step');
    const progressLines = document.querySelectorAll('.line');
    const backToHomeBtn = document.querySelector('.back-to-home-btn');

    let currentStep = 1;
    let registrationId = null;

    // Show step function
    const showStep = (stepNumber) => {
        formSteps.forEach(step => step.classList.remove('active'));
        progressSteps.forEach(step => step.classList.remove('active', 'completed'));
        progressLines.forEach(line => line.classList.remove('completed-line'));

        document.getElementById(`form-step-${stepNumber}`).classList.add('active');

        for (let i = 1; i <= stepNumber; i++) {
            document.getElementById(`step${i}`).classList.add('active');
            if (i < stepNumber) {
                document.getElementById(`step${i}`).classList.add('completed');
                document.getElementById(`step${i}`).nextElementSibling.classList.add('completed-line');
            }
        }
    };

    showStep(currentStep);

    // ---- Step 1: Student details ----
    const studentForm = document.getElementById('student-form');
    studentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const studentName = document.getElementById('student-name').value;
        const college = document.getElementById('college').value;
        const studentEmail = document.getElementById('student-email').value;
        const eventName = document.getElementById('event-name').value;

        try {
            const response = await fetch('https://event1-vk4i.onrender.com/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentName, college, email: studentEmail, event: eventName })
            });

            const data = await response.json();
            if (data.registrationId) {
                registrationId = data.registrationId;
                document.getElementById('hidden-registration-id').value = registrationId; // ✅ pass into step 3
                currentStep = 2;
                showStep(currentStep);
            } else {
                throw new Error('No registration ID received.');
            }
        } catch (err) {
            console.error('Error:', err);
            alert('Something went wrong during registration.');
        }
    });

    // ---- Step 2: Payment instruction ----
    document.querySelector('#form-step-2 .next-btn').addEventListener('click', () => {
        currentStep = 3;
        showStep(currentStep);
    });

    // ---- Step 3: Payment + Screenshot ----
    const paymentForm = document.getElementById('payment-form');
    paymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const utrNumber = document.getElementById('utr-number').value;
        const screenshotFile = document.getElementById('payment-screenshot').files[0];

        if (!screenshotFile) {
            alert("Please upload screenshot.");
            return;
        }

        const formData = new FormData();
        formData.append('registrationId', registrationId);
        formData.append('utrNumber', utrNumber);
        formData.append('screenshot', screenshotFile);

        try {
            const response = await fetch('https://event1-vk4i.onrender.com/payment', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            console.log(data.message);

            currentStep = 4;
            showStep(currentStep);
        } catch (err) {
            console.error('Error:', err);
            alert('Something went wrong submitting payment.');
        }
    });

    // ---- Step 4: Back to Home ----
    backToHomeBtn.addEventListener('click', () => {
        document.querySelectorAll('input').forEach(input => {
            input.value = '';
            input.style.border = '';
        });

        document.getElementById('event-name').value = '';
        document.getElementById('image-preview').style.display = 'none';

        registrationId = null;
        currentStep = 1;
        showStep(currentStep);
    });

    // ---- Screenshot Preview ----
    const fileInput = document.getElementById('payment-screenshot');
    const imagePreview = document.getElementById('image-preview');
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            imagePreview.src = '#';
            imagePreview.style.display = 'none';
        }
    });
});

