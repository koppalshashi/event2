// server.js

// Load environment variables
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// --- CORS ---
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected...'))
.catch(err => console.error('MongoDB connection error:', err));

// --- Mongoose Schemas & Models ---
const registrationSchema = new mongoose.Schema({
    studentName: { type: String, required: true },
    college: { type: String, required: true },
    email: { type: String, required: true },
    event: { type: String, required: true },
    amount: { type: Number, default: 500 },
    registrationDate: { type: Date, default: Date.now },
    isApproved: { type: Boolean, default: false },
    isRejected: { type: Boolean, default: false }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

registrationSchema.virtual('payment', {
    ref: 'Payment',
    localField: '_id',
    foreignField: 'registrationId',
    justOne: true
});

const paymentSchema = new mongoose.Schema({
    registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', required: true },
    utrNumber: { type: String, required: true },
    screenshotPath: { type: String, required: true },
    paymentDate: { type: Date, default: Date.now }
});

const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const Registration = mongoose.model('Registration', registrationSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Admin = mongoose.model('Admin', adminSchema);

// --- Multer Config for Screenshots ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

// --- Admin Authentication Middleware ---
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token format is invalid' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

// --- Nodemailer Setup ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    }
});

// --- Serve HTML Pages ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// --- STUDENT ROUTES ---
app.post('/register', async (req, res) => {
    try {
        const { studentName, college, email, event } = req.body;
        const newRegistration = new Registration({ studentName, college, email, event });
        const savedRegistration = await newRegistration.save();
        res.status(201).json({ message: 'Student details saved.', registrationId: savedRegistration._id });
    } catch (error) {
        console.error('Registration failed:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.post('/payment', upload.single('screenshot'), async (req, res) => {
    try {
        const { registrationId, utrNumber } = req.body;
        if (!req.file) return res.status(400).json({ message: 'No screenshot uploaded.' });

        const screenshotPath = req.file.path;
        const newPayment = new Payment({ registrationId, utrNumber, screenshotPath });
        await newPayment.save();
        res.status(200).json({ message: 'Payment saved successfully.' });
    } catch (error) {
        console.error('Payment failed:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Endpoint to view screenshot by payment ID
app.get('/payment/:id/screenshot', async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) return res.status(404).send('Screenshot not found');

        res.sendFile(path.resolve(payment.screenshotPath));
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// --- ADMIN ROUTES ---
app.post('/api/admin/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newAdmin = new Admin({ username, password: hashedPassword });
        await newAdmin.save();
        res.status(201).json({ message: 'Admin registered successfully.' });
    } catch (error) {
        console.error('Admin registration failed:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ username });
        if (!admin) return res.status(400).json({ message: 'Invalid credentials.' });

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });

        const token = jwt.sign({ id: admin._id, username: admin.username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Login successful', token });
    } catch (error) {
        console.error('Admin login failed:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.get('/api/admin/registrations', authenticateAdmin, async (req, res) => {
    try {
        const allRegistrations = await Registration.find()
            .populate('payment')
            .sort({ registrationDate: 'desc' });
        res.status(200).json(allRegistrations);
    } catch (error) {
        console.error('Admin data fetch failed:', error);
        res.status(500).json({ message: 'Failed to fetch registrations.' });
    }
});

app.post('/api/admin/approve/:id', authenticateAdmin, async (req, res) => {
    try {
        const registration = await Registration.findById(req.params.id);
        if (!registration) return res.status(404).json({ message: 'Registration not found.' });

        if (registration.isApproved) return res.status(400).json({ message: 'Already approved.' });

        const payment = await Payment.findOne({ registrationId: registration._id });
        if (!payment) return res.status(404).json({ message: 'Payment details not found.' });

        registration.isApproved = true;
        registration.isRejected = false;
        await registration.save();

        const registrationData = {
            name: registration.studentName,
            college: registration.college,
            event: registration.event,
            amount: registration.amount,
            utrNumber: payment.utrNumber,
            registrationDate: registration.registrationDate,
            regId: registration._id
        };

        const qrCodeBuffer = await QRCode.toBuffer(JSON.stringify(registrationData));
        const pdfPath = path.join(__dirname, 'uploads', `confirmation_${registration._id}.pdf`);

        const doc = new PDFDocument();
        const stream = fs.createWriteStream(pdfPath);
        doc.pipe(stream);

        doc.fontSize(25).text('Registration Confirmation', { align: 'center' });
        doc.moveDown();
        doc.fontSize(16).text(`Student Name: ${registrationData.name}`);
        doc.text(`College: ${registrationData.college}`);
        doc.text(`Event: ${registrationData.event}`);
        doc.text(`Amount Paid: ₹${registrationData.amount}`);
        doc.text(`UTR Number: ${registrationData.utrNumber}`);
        doc.moveDown();
        doc.image(qrCodeBuffer, { fit: [150, 150], align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Registration ID: ${registrationData.regId}`, { align: 'center' });
        doc.end();

        stream.on('finish', async () => {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: registration.email,
                subject: `Your Registration for ${registration.event} is Confirmed!`,
                html: `<h2>Hello ${registration.studentName},</h2>
                       <p>Your registration has been approved. Please find your confirmation attached.</p>`,
                attachments: [{
                    filename: `confirmation_${registration._id}.pdf`,
                    path: pdfPath,
                    contentType: 'application/pdf'
                }]
            };
            await transporter.sendMail(mailOptions);
            res.status(200).json({ message: 'Registration approved and email sent.' });
        });

    } catch (err) {
        console.error('Approval error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.post('/api/admin/reject/:id', authenticateAdmin, async (req, res) => {
    try {
        const registration = await Registration.findById(req.params.id);
        if (!registration) return res.status(404).json({ message: 'Registration not found.' });

        if (registration.isApproved) return res.status(400).json({ message: 'Cannot reject approved registration.' });
        if (registration.isRejected) return res.status(400).json({ message: 'Already rejected.' });

        registration.isApproved = false;
        registration.isRejected = true;
        await registration.save();

        res.status(200).json({ message: 'Registration rejected successfully.' });
    } catch (err) {
        console.error('Rejection failed:', err);
        res.status(500).json({ message: 'Server error during rejection.' });
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
