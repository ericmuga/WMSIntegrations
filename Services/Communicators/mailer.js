import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve .env file location
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

class MailerService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.office365.com',
            port: parseInt(process.env.SMTP_PORT, 10) || 587,
            secure: false, // Must be false for STARTTLS
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
            tls: {
                rejectUnauthorized: false, // Optional
            },
        });
    }

    /**
     * Sends an email with optional CC recipients.
     * @param {Object} options - Email options.
     * @param {string} options.to - Recipient email address.
     * @param {string} [options.cc] - CC email address(es).
     * @param {string} options.subject - Email subject.
     * @param {string} options.text - Plain text content.
     * @param {string} options.html - HTML content.
     */
    async sendEmail({ to, cc, subject, text, html }) {
        const mailOptions = {
            from: `"Service Name" <${process.env.SMTP_USER}>`,
            to,
            cc, // Optional CC field
            subject,
            text,
            html,
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Email sent: %s', info.messageId);
            return info;
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    }

    async sendErrorEmail(to, errorDetails, cc = null) {
        const subject = 'Error Notification: Process Failure';
        const text = `An error occurred during processing:\n\n${errorDetails}`;
        const html = `<p>An error occurred during processing:</p><pre>${errorDetails}</pre>`;

        return this.sendEmail({ to, cc, subject, text, html });
    }

    async sendInfoEmail(to, infoDetails, cc = null) {
        const subject = 'Information Notification: Process Update';
        const text = `Here is an update on the processing:\n\n${infoDetails}`;
        const html = `<p>Here is an update on the processing:</p><pre>${infoDetails}</pre>`;

        return this.sendEmail({ to, cc, subject, text, html });
    }
}

export default new MailerService();
