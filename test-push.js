const webpush = require('web-push');

// 1. Generate VAPID keys if you don't have them:
// Run this in your terminal: npx web-push generate-vapid-keys
// Paste the keys below:
const vapidKeys = {
  publicKey: 'BCZuVPRs8LQgzEp0hX2DF77sLnMJvkbYAwlADS5aJ0BJo6duVgntIh1oVmZJni9jeqKDqWVpiyFdExTKzmns7fk',
  privateKey: 'RhrAp-ovTZzUDIdYBbHmWuM32apb54vhdTx6TxBTsFg'
};

if (vapidKeys.publicKey === 'REPLACE_WITH_YOUR_PUBLIC_KEY') {
  console.log('\x1b[31m%s\x1b[0m', 'Please generate VAPID keys and add them to test-push.js');
  console.log('Run: npx web-push generate-vapid-keys');
  process.exit(1);
}

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// 2. You need a push subscription object from the client.
// To get this, you would add logic to the frontend to subscribe to push manager:
// const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeys.publicKey });
// console.log(JSON.stringify(subscription));
// Then paste that JSON here:
const pushSubscription = {
  endpoint: '...',
  keys: {
    auth: '...',
    p256dh: '...'
  }
};

if (pushSubscription.endpoint === '...') {
  console.log('\x1b[31m%s\x1b[0m', 'Please add your push subscription object to test-push.js');
  process.exit(1);
}

const payload = JSON.stringify({
  title: 'Kiwi',
  body: 'oyi krishna missing you, your kiwi.',
  url: '/'
});

webpush.sendNotification(pushSubscription, payload)
  .then(res => console.log('Push sent successfully!', res.statusCode))
  .catch(err => console.error('Error sending push:', err));
