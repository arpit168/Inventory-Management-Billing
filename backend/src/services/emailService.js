import nodemailer from 'nodemailer';

// Email configuration constants
const EMAIL_RETRY_ATTEMPTS = 3;
const EMAIL_RETRY_DELAY = 1000; // 1 second between retries

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT === '465', // Use TLS for port 465, regular SMTP for others
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  pool: {
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 4000,
    rateLimit: 14,
  },
  connectionTimeout: 10000,
  socketTimeout: 10000,
});

/**
 * Send email with retry logic
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML body
 * @param {number} attempt - Current retry attempt
 * @returns {Promise<boolean>} True if email sent successfully
 * @throws {Error} If email fails after all retries
 */
export const sendEmail = async (to, subject, html, attempt = 1) => {
  try {
    // Validate email address
    if (!to || !to.includes('@')) {
      throw new Error(`Invalid email address: ${to}`);
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
      replyTo: process.env.EMAIL_FROM,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✓ Email sent to ${to}:`, info.messageId);
    return true;
  } catch (error) {
    console.error(`Email sending error (attempt ${attempt}/${EMAIL_RETRY_ATTEMPTS}):`, error.message);

    // Retry logic for transient errors
    if (attempt < EMAIL_RETRY_ATTEMPTS) {
      const isTransientError = 
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('EHOSTUNREACH') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('Network error');

      if (isTransientError) {
        await new Promise(resolve => setTimeout(resolve, EMAIL_RETRY_DELAY * attempt));
        return sendEmail(to, subject, html, attempt + 1);
      }
    }

    // Throw error for permanent failures (wrong email, auth failure, etc)
    throw new Error(`Failed to send email after ${EMAIL_RETRY_ATTEMPTS} attempts: ${error.message}`);
  }
};

/**
 * Verify email service connectivity
 */
export const verifyEmailService = async () => {
  try {
    await transporter.verify();
    console.log('✓ Email service verified successfully');
    return true;
  } catch (error) {
    console.error('✗ Email service verification failed:', error.message);
    return false;
  }
};

// Email templates
export const verificationEmailTemplate = (fullName, verificationLink) => {
  return `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Email Verification Required</h2>
      <p>Hi ${fullName},</p>
      <p>Thank you for registering with Inventory Management System. Please verify your email address by clicking the link below:</p>
      <p><a href="${verificationLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Verify Email</a></p>
      <p>This link will expire in 24 hours.</p>
      <p>If you did not create this account, please ignore this email.</p>
      <p>Best regards,<br>Inventory Management System Team</p>
    </div>
  `;
};

export const resetPasswordTemplate = (fullName, resetLink) => {
  return `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Password Reset Request</h2>
      <p>Hi ${fullName},</p>
      <p>We received a request to reset your password. Click the link below to reset it:</p>
      <p><a href="${resetLink}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Reset Password</a></p>
      <p>This link will expire in 30 minutes.</p>
      <p>If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
      <p>Best regards,<br>Inventory Management System Team</p>
    </div>
  `;
};

export const passwordChangedTemplate = (fullName) => {
  return `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Password Changed Successfully</h2>
      <p>Hi ${fullName},</p>
      <p>Your password has been changed successfully.</p>
      <p>If this was not you, please contact support immediately.</p>
      <p>Best regards,<br>Inventory Management System Team</p>
    </div>
  `;
};

export const lowStockAlertTemplate = (productName, currentStock, minimumStock) => {
  return `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Low Stock Alert</h2>
      <p>The product <strong>${productName}</strong> is running low on stock.</p>
      <p>Current Stock: ${currentStock} units</p>
      <p>Minimum Stock Level: ${minimumStock} units</p>
      <p>Please reorder this product to avoid stockouts.</p>
      <p>Best regards,<br>Inventory Management System</p>
    </div>
  `;
};

export const outOfStockTemplate = (productName) => {
  return `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Out of Stock Alert</h2>
      <p>The product <strong>${productName}</strong> is now out of stock.</p>
      <p>Please take immediate action to reorder this product.</p>
      <p>Best regards,<br>Inventory Management System</p>
    </div>
  `;
};

export const invoiceEmailTemplate = (customerName, invoiceNumber, totalAmount, invoiceLink) => {
  return `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Invoice ${invoiceNumber}</h2>
      <p>Hi ${customerName},</p>
      <p>Thank you for your purchase. Here is your invoice:</p>
      <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
      <p><strong>Total Amount:</strong> $${totalAmount.toFixed(2)}</p>
      <p><a href="${invoiceLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Invoice</a></p>
      <p>Best regards,<br>Inventory Management System Team</p>
    </div>
  `;
};
