#!/usr/bin/env node
// Simple IMAP search for the readiness report email
const { ImapFlow } = require('imapflow');

(async function(){
  try {
    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: process.env.READINESS_EMAIL_USER || process.env.GMAIL_USER || 'beantobin2025@gmail.com',
        pass: process.env.READINESS_EMAIL_PASS || process.env.GMAIL_APP_PASSWORD
      }
    });

    await client.connect();
    await client.mailboxOpen('INBOX');
    // search for recent messages with VermiLinks readiness subject
    const query = ['SINCE', new Date(Date.now() - 1000 * 60 * 60 * 24).toUTCString(), ['HEADER', 'subject', 'VermiLinks']];
    const lock = await client.getMailboxLock('INBOX');
    try {
      const messages = [];
      for await (let msg of client.search(query)) {
        const meta = await client.fetchOne(msg, { envelope: true });
        messages.push({ uid: msg, subject: meta.envelope.subject, from: meta.envelope.from });
      }
      console.log('readiness_email_search_result:', JSON.stringify(messages, null, 2));
    } finally {
      lock.release();
    }

    await client.logout();
    process.exit(0);
  } catch (err) {
    console.error('Email search failed:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
