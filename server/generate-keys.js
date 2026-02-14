import webpush from 'web-push';
import fs from 'fs';
import path from 'path';

const vapidKeys = webpush.generateVAPIDKeys();

const envContent = `
VAPID_PUBLIC_KEY=${vapidKeys.publicKey}
VAPID_PRIVATE_KEY=${vapidKeys.privateKey}
`;

fs.appendFileSync(path.join(process.cwd(), '.env'), envContent);

console.log('VAPID keys generated and saved to .env');
console.log('Public Key:', vapidKeys.publicKey);
