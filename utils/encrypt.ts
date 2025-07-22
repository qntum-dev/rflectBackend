import crypto from 'crypto';

// Generate a random key (store it securely per session)
const key = crypto.randomBytes(32); 

function encryptMessage(message:string, key:string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(message, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return { iv: iv.toString('hex'), content: encrypted, tag };
}
