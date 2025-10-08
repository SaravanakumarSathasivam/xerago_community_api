const nodemailer = require('nodemailer');
const config = require('../config/config');
const logger = require('./logger');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: config.email.smtp.host,
    port: config.email.smtp.port,
    secure: config.email.smtp.secure,
    auth: config.email.smtp.auth,
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Email templates
const emailTemplates = {
  welcome: (user) => ({
    subject: 'Welcome to Xerago Community!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">Welcome to Xerago Community!</h2>
        <p>Hi ${user.name},</p>
        <p>Welcome to the Xerago Community platform! We're excited to have you join our community of professionals.</p>
        <p>You can now:</p>
        <ul>
          <li>Participate in discussion forums</li>
          <li>Share knowledge through articles</li>
          <li>Attend and create events</li>
          <li>Earn points and achievements</li>
        </ul>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <p>Best regards,<br>The Xerago Team</p>
      </div>
    `,
    text: `Welcome to Xerago Community! Hi ${user.name}, Welcome to the Xerago Community platform! We're excited to have you join our community of professionals.`
  }),

  emailVerification: (user, verificationUrl) => ({
    subject: 'Verify Your Email Address',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">Verify Your Email Address</h2>
        <p>Hi ${user.name},</p>
        <p>Thank you for registering with Xerago Community. Use the One-Time Passcode (OTP) below to verify your email address:</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="display:inline-block; padding: 12px 18px; font-size: 20px; font-weight: 700; letter-spacing: 4px; background:#111827; color:#ffffff; border-radius:8px;">
            ${user.emailVerificationCode || '------'}
          </div>
        </div>
        <p>Alternatively, you can also verify by clicking this button:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email</a>
        </div>
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #6B7280;">${verificationUrl}</p>
        <p>This OTP expires in 24 hours.</p>
        <p>Best regards,<br>The Xerago Team</p>
      </div>
    `,
    text: `Verify Your Email Address. Hi ${user.name}, Your OTP is ${user.emailVerificationCode}. Or verify here: ${verificationUrl}`
  }),

  passwordReset: (user, resetUrl) => ({
    subject: 'Reset Your Password',
    html: `
      <!doctype html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Reset Your Password</title>
        <style>
          body { background-color: #f6f6f6; font-family: Arial, sans-serif; -webkit-font-smoothing: antialiased; line-height: 1.6; margin: 0; padding: 0; }
          .container { max-width: 580px; margin: 0 auto; padding: 20px; }
          .card { background: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
          h1 { font-size: 22px; color: #111827; margin: 0 0 12px; }
          p { color: #374151; font-size: 14px; margin: 0 0 12px; }
          .btn { display: inline-block; background: #EF4444; color: #ffffff !important; text-decoration: none; padding: 12px 18px; border-radius: 6px; font-weight: 600; }
          .muted { color: #6B7280; font-size: 12px; }
          .footer { text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 16px; }
          .logo { font-weight: 800; color: #3B82F6; }
          .code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; background: #111827; color: #fff; padding: 10px 14px; border-radius: 6px; letter-spacing: 1px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="logo">Xerago Community</div>
            <h1>Reset Your Password</h1>
            <p>Hi ${user.name},</p>
            <p>We received a request to reset your password. Click the button below to set a new password.</p>
            <p style="text-align:center; margin: 24px 0;">
              <a href="${resetUrl}" class="btn">Reset Password</a>
            </p>
            <p class="muted">If the button doesn't work, copy and paste this link into your browser:</p>
            <p class="muted" style="word-break: break-all;">${resetUrl}</p>
            <p class="muted">This link will expire in 1 hour. If you didn't request this, you can ignore this message.</p>
          </div>
          <div class="footer">© ${new Date().getFullYear()} Xerago Community</div>
        </div>
      </body>
      </html>
    `,
    text: `Reset Your Password. Hi ${user.name}, We received a request to reset your password. Open this link: ${resetUrl}. This link expires in 1 hour.`
  }),

  passwordChanged: (user) => ({
    subject: 'Password Changed Successfully',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10B981;">Password Changed Successfully</h2>
        <p>Hi ${user.name},</p>
        <p>Your password has been successfully changed.</p>
        <p>If you didn't make this change, please contact our support team immediately.</p>
        <p>Best regards,<br>The Xerago Team</p>
      </div>
    `,
    text: `Password Changed Successfully. Hi ${user.name}, Your password has been successfully changed.`
  }),

  eventReminder: (user, event) => ({
    subject: `Reminder: ${event.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">Event Reminder</h2>
        <p>Hi ${user.name},</p>
        <p>This is a reminder that you have an upcoming event:</p>
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${event.title}</h3>
          <p><strong>Date:</strong> ${new Date(event.startDate).toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${new Date(event.startDate).toLocaleTimeString()}</p>
          ${event.location ? `<p><strong>Location:</strong> ${event.location.name || event.location.address}</p>` : ''}
          ${event.onlineDetails ? `<p><strong>Online:</strong> ${event.onlineDetails.platform}</p>` : ''}
        </div>
        <p>We look forward to seeing you there!</p>
        <p>Best regards,<br>The Xerago Team</p>
      </div>
    `,
    text: `Event Reminder. Hi ${user.name}, This is a reminder that you have an upcoming event: ${event.title} on ${new Date(event.startDate).toLocaleDateString()}.`
  }),

  newForumReply: (user, post, reply) => ({
    subject: `New Reply to: ${post.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">New Forum Reply</h2>
        <p>Hi ${user.name},</p>
        <p>Someone replied to a forum post you're following:</p>
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${post.title}</h3>
          <p><strong>Reply by:</strong> ${reply.author.name}</p>
          <p><strong>Reply:</strong> ${reply.content.substring(0, 200)}${reply.content.length > 200 ? '...' : ''}</p>
        </div>
        <p>Best regards,<br>The Xerago Team</p>
      </div>
    `,
    text: `New Forum Reply. Hi ${user.name}, Someone replied to a forum post you're following: ${post.title}.`
  }),

  achievementEarned: (user, achievement) => ({
    subject: `Achievement Unlocked: ${achievement.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #F59E0B;">🎉 Achievement Unlocked!</h2>
        <p>Hi ${user.name},</p>
        <p>Congratulations! You've earned a new achievement:</p>
        <div style="background-color: #FEF3C7; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <h3 style="margin-top: 0; color: #92400E;">${achievement.name}</h3>
          <p style="color: #92400E;">${achievement.description}</p>
          <p style="color: #92400E;"><strong>+${achievement.points} points</strong></p>
        </div>
        <p>Keep up the great work!</p>
        <p>Best regards,<br>The Xerago Team</p>
      </div>
    `,
    text: `Achievement Unlocked: ${achievement.name}. Hi ${user.name}, Congratulations! You've earned a new achievement: ${achievement.name}.`
  })
};

// Send email function
const sendEmail = async (to, subject, html, text) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: {
        name: config.email.from.name,
        address: config.email.from.email
      },
      to,
      subject,
      html,
      text
    };

    const result = await transporter.sendMail(mailOptions);
    logger.logEmailSent(to, subject, 'custom', { messageId: result.messageId });
    
    return {
      success: true,
      messageId: result.messageId
    };
  } catch (error) {
    logger.error('Email sending failed:', error);
    throw new Error('Failed to send email');
  }
};

// Send template email
const sendTemplateEmail = async (to, templateName, data) => {
  try {
    const template = emailTemplates[templateName];
    if (!template) {
      throw new Error(`Email template '${templateName}' not found`);
    }

    const emailContent = typeof template === 'function' ? template(data) : template;
    
    return await sendEmail(to, emailContent.subject, emailContent.html, emailContent.text);
  } catch (error) {
    logger.error('Template email sending failed:', error);
    throw error;
  }
};

// Send welcome email
const sendWelcomeEmail = async (user) => {
  return await sendTemplateEmail(user.email, 'welcome', user);
};

// Send email verification
const sendEmailVerification = async (user, verificationUrl) => {
  return await sendTemplateEmail(user.email, 'emailVerification', { user, verificationUrl });
};

// Send password reset email
const sendPasswordResetEmail = async (user, resetUrl) => {
  return await sendTemplateEmail(user.email, 'passwordReset', { user, resetUrl });
};

// Send password changed notification
const sendPasswordChangedEmail = async (user) => {
  return await sendTemplateEmail(user.email, 'passwordChanged', user);
};

// Send event reminder
const sendEventReminder = async (user, event) => {
  return await sendTemplateEmail(user.email, 'eventReminder', { user, event });
};

// Send forum reply notification
const sendForumReplyNotification = async (user, post, reply) => {
  return await sendTemplateEmail(user.email, 'newForumReply', { user, post, reply });
};

// Send achievement notification
const sendAchievementNotification = async (user, achievement) => {
  return await sendTemplateEmail(user.email, 'achievementEarned', { user, achievement });
};

// Send bulk emails
const sendBulkEmails = async (recipients, subject, html, text) => {
  const results = [];
  
  for (const recipient of recipients) {
    try {
      const result = await sendEmail(recipient, subject, html, text);
      results.push({ recipient, success: true, result });
    } catch (error) {
      results.push({ recipient, success: false, error: error.message });
    }
  }
  
  return results;
};

// Verify email configuration
const verifyEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info('Email configuration verified successfully');
    return true;
  } catch (error) {
    logger.error('Email configuration verification failed:', error);
    return false;
  }
};

module.exports = {
  sendEmail,
  sendTemplateEmail,
  sendWelcomeEmail,
  sendEmailVerification,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendEventReminder,
  sendForumReplyNotification,
  sendAchievementNotification,
  sendBulkEmails,
  verifyEmailConfig,
  emailTemplates
};
