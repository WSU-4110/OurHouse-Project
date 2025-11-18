const nodemailer = require('nodemailer');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: String(process.env.PGPASSWORD ?? ''),
  database: process.env.PGDATABASE || 'OurHouse',
  ssl: (/require/i).test(process.env.PGSSLMODE || '') ? { rejectUnauthorized: false } : false,
});

//email transporter
//production- use actual SMTP credentials
//developement- use a service like Ethereal or Mailtrap
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'your-email@example.com',
    pass: process.env.SMTP_PASS || 'your-password'
  }
});

/**
 * Fetches all low-stock items (qty < threshold)
 * @param {number} threshold - Stock level threshold (default: 10)
 * @returns {Promise<Array>} Array of low-stock items
 */
async function getLowStockItems(threshold = 10) {
  const query = `
    SELECT 
      p.sku,
      p.name AS product_name,
      p.description,
      l.name AS location_name,
      b.code AS bin_code,
      sl.qty,
      COALESCE(p.min_qty, 10) as min_qty,
      COALESCE(p.lead_time_days, 0) as lead_time_days
    FROM stock_levels sl
    JOIN products p ON p.id = sl.product_id
    JOIN bins b ON b.id = sl.bin_id
    JOIN locations l ON l.id = b.location_id
    WHERE sl.qty < COALESCE(p.min_qty, $1)
    ORDER BY sl.qty ASC, p.sku ASC
  `;
  
  const { rows } = await pool.query(query, [threshold]);
  return rows;
}

/**
 * Gets list of manager/admin emails who should receive notifications
 * @returns {Promise<Array<string>>} Array of email addresses
 */
async function getManagerEmails() {
  const query = `
    SELECT DISTINCT email 
    FROM users 
    WHERE role IN ('Manager', 'Admin')
    AND email IS NOT NULL
    ORDER BY email
  `;
  
  const { rows } = await pool.query(query);
  return rows.map(r => r.email);
}

/**
 * Generates HTML email body for low-stock digest
 * @param {Array} items - Low-stock items
 * @returns {string} HTML email body
 */
function generateEmailHTML(items) {
  if (items.length === 0) {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
          <div style="max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px;">
            <h2 style="color: #10b981; margin-top: 0;">✅ All Stock Levels Normal</h2>
            <p>No items are currently below minimum stock thresholds.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #8b95a8; font-size: 12px;">
              This is an automated daily digest from OurHouse Inventory Management System.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  const rows = items.map(item => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px 8px; font-weight: 600; color: #1f2937;">${item.sku}</td>
      <td style="padding: 12px 8px;">${item.product_name}</td>
      <td style="padding: 12px 8px; color: #8b95a8;">${item.location_name} / ${item.bin_code}</td>
      <td style="padding: 12px 8px; text-align: center;">
        <span style="background: ${item.qty < 5 ? '#fca5a5' : '#fcd34d'}; 
                     color: ${item.qty < 5 ? '#ef4444' : '#78350f'}; 
                     padding: 4px 12px; 
                     border-radius: 4px; 
                     font-weight: 600;">
          ${item.qty}
        </span>
      </td>
      <td style="padding: 12px 8px; text-align: center; color: #8b95a8;">${item.min_qty}</td>
      <td style="padding: 12px 8px; text-align: center; color: #8b95a8;">
        ${item.lead_time_days > 0 ? `${item.lead_time_days} days` : 'N/A'}
      </td>
    </tr>
  `).join('');

  return `
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
        <div style="max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="background: #dc2626; color: white; padding: 20px; border-radius: 6px; margin-bottom: 24px;">
            <h2 style="margin: 0 0 8px 0; font-size: 24px;">⚠️ Low Stock Alert</h2>
            <p style="margin: 0; font-size: 16px; opacity: 0.9;">
              ${items.length} item${items.length !== 1 ? 's' : ''} below minimum stock threshold
            </p>
          </div>
          
          <p style="color: #5a6578; margin-bottom: 20px;">
            The following items require attention and may need reordering:
          </p>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
              <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 12px 8px; text-align: left; color: #8b95a8; font-weight: 600; font-size: 12px; text-transform: uppercase;">SKU</th>
                <th style="padding: 12px 8px; text-align: left; color: #8b95a8; font-weight: 600; font-size: 12px; text-transform: uppercase;">Product</th>
                <th style="padding: 12px 8px; text-align: left; color: #8b95a8; font-weight: 600; font-size: 12px; text-transform: uppercase;">Location</th>
                <th style="padding: 12px 8px; text-align: center; color: #8b95a8; font-weight: 600; font-size: 12px; text-transform: uppercase;">Current Qty</th>
                <th style="padding: 12px 8px; text-align: center; color: #8b95a8; font-weight: 600; font-size: 12px; text-transform: uppercase;">Min Qty</th>
                <th style="padding: 12px 8px; text-align: center; color: #8b95a8; font-weight: 600; font-size: 12px; text-transform: uppercase;">Lead Time</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          
          <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
            <p style="margin: 0; color: #166534; font-size: 14px;">
              <strong>💡 Recommended Action:</strong> Review these items and create purchase orders for products with longer lead times.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          
          <p style="color: #8b95a8; font-size: 12px; margin: 0;">
            This is an automated daily digest from OurHouse Inventory Management System.<br>
            Generated on ${new Date().toLocaleString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generates plain text version of email
 * @param {Array} items - Low-stock items
 * @returns {string} Plain text email body
 */
function generateEmailText(items) {
  if (items.length === 0) {
    return `
OurHouse Inventory - Daily Stock Report
========================================

All Stock Levels Normal ✓

No items are currently below minimum stock thresholds.

--
This is an automated daily digest from OurHouse Inventory Management System.
    `.trim();
  }

  const itemsList = items.map(item => 
    `${item.sku} - ${item.product_name}\n` +
    `  Location: ${item.location_name} / ${item.bin_code}\n` +
    `  Current: ${item.qty} | Minimum: ${item.min_qty} | Lead Time: ${item.lead_time_days || 'N/A'} days`
  ).join('\n\n');

  return `
OurHouse Inventory - Low Stock Alert
=====================================

${items.length} item(s) below minimum stock threshold:

${itemsList}

--
Recommended Action: Review these items and create purchase orders for products with longer lead times.

Generated on ${new Date().toLocaleString()}
This is an automated daily digest from OurHouse Inventory Management System.
  `.trim();
}

/**
 * Sends daily low-stock email digest
 * @param {number} threshold - Stock level threshold
 * @returns {Promise<Object>} Result object with success status
 */
async function sendDailyDigest(threshold = 10) {
  try {
    console.log('📧 Starting daily low-stock email digest...');
    
    //gets low stocj item
    const lowStockItems = await getLowStockItems(threshold);
    console.log(`   Found ${lowStockItems.length} low-stock items`);
    
    //recipients email
    const recipients = await getManagerEmails();
    
    if (recipients.length === 0) {
      console.log('   ⚠️  No manager emails found in database');
      return { success: false, reason: 'No recipients' };
    }
    
    console.log(`   Recipients: ${recipients.join(', ')}`);
    
    //generates content
    const htmlBody = generateEmailHTML(lowStockItems);
    const textBody = generateEmailText(lowStockItems);
    
    //preps email
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"OurHouse Inventory" <inventory@ourhouse.com>',
      to: recipients.join(', '),
      subject: lowStockItems.length === 0 
        ? '✓ OurHouse Daily Inventory Report - All Normal'
        : `⚠️ OurHouse Low Stock Alert - ${lowStockItems.length} Item(s) Need Attention`,
      text: textBody,
      html: htmlBody
    };
    
    //send email
    const info = await transporter.sendMail(mailOptions);
    console.log('   ✅ Email sent successfully');
    console.log(`   Message ID: ${info.messageId}`);
    
    //log the preview URL for ethereal
    if (process.env.SMTP_HOST === 'smtp.ethereal.email') {
      console.log(`   Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
    
    return {
      success: true,
      messageId: info.messageId,
      itemCount: lowStockItems.length,
      recipientCount: recipients.length
    };
    
  } catch (error) {
    console.error('   ❌ Email sending failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

//Test function to send immediate digest (

async function sendTestDigest() {
  console.log('🧪 Sending test email digest...');
  return await sendDailyDigest();
}

module.exports = {
  sendDailyDigest,
  sendTestDigest,
  getLowStockItems,
  getManagerEmails
};