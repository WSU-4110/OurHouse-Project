//cd to server and npm install nodemailer node-cron

const cron = require('node-cron');
const { sendDailyDigest } = require('./emailService');

function initializeScheduler() {
  console.log('📅 Initializing task scheduler...');
  
  //schedules daily low-stock email digest
  //runs every day at 7:00 AM
  const dailyDigestJob = cron.schedule('0 7 * * *', async () => {
    console.log('\n⏰ Running scheduled task: Daily Low-Stock Digest');
    await sendDailyDigest(10); //10 unit treshold
  }, {
    scheduled: true,
    timezone: process.env.TZ || 'America/New_York'
  });
  
  console.log('   ✅ Daily digest scheduled for 7:00 AM');
  
  return {
    dailyDigestJob
  };
}

/**
 * stops all scheduled tasks
 * @param {Object} jobs - Object containing cron jobs
 */
function stopScheduler(jobs) {
  console.log('🛑 Stopping scheduler...');
  Object.values(jobs).forEach(job => {
    if (job && job.stop) {
      job.stop();
    }
  });
  console.log('   ✅ All scheduled tasks stopped');
}

module.exports = {
  initializeScheduler,
  stopScheduler
};