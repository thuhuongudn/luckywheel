/**
 * VERIFY: Tại sao cùng phone nhưng hash khác nhau?
 */

const crypto = require('crypto-js');

function hashPhone(phone, pepper) {
  return crypto.SHA256(phone + pepper).toString();
}

const phone = '0355418417';
const localPepper = 'dev-pepper-789';
const prodPepper = 'OzaOZm40Uj9zaIyTrXh2j4DtZhVNi8le';

console.log('🔍 VERIFY: Phone Hash Mismatch\n');
console.log('Phone:', phone);
console.log('─────────────────────────────────────────────────────────\n');

const localHash = hashPhone(phone, localPepper);
const prodHash = hashPhone(phone, prodPepper);

console.log('LOCAL hash (dev-pepper-789):');
console.log(localHash);
console.log('');

console.log('PRODUCTION hash (OzaOZm40Uj9zaIyTrXh2j4DtZhVNi8le):');
console.log(prodHash);
console.log('');

console.log('─────────────────────────────────────────────────────────\n');
console.log('Database records:');
console.log('Record 1 hash:', 'c412e3d58df11fdca4cc9f2f7889e48f61d0a04528d166c682332a482c5539d2');
console.log('Record 2 hash:', '12dbf97f8e3448a63a74e929d510d829f0f0fd083e3acc58f1774c0a41dd3448');
console.log('');

console.log('Match check:');
console.log('Record 1 === LOCAL hash?', localHash === 'c412e3d58df11fdca4cc9f2f7889e48f61d0a04528d166c682332a482c5539d2');
console.log('Record 2 === PROD hash?', prodHash === '12dbf97f8e3448a63a74e929d510d829f0f0fd083e3acc58f1774c0a41dd3448');
console.log('');

console.log('🚨 CONCLUSION:');
console.log('─────────────────────────────────────────────────────────');
console.log('Record 1 created from LOCAL laptop (dev-pepper-789)');
console.log('Record 2 created from PRODUCTION/mobile (OzaOZm40Uj9zaIyTrXh2j4DtZhVNi8le)');
console.log('');
console.log('Database constraint UNIQUE(campaign_id, phone_hash) FAILED because:');
console.log('• Different SECRET_PEPPER → Different hash');
console.log('• Different hash → Database thinks it\'s different phone');
console.log('• Result: User can spin MULTIPLE TIMES from different environments!');
console.log('');
console.log('✅ FIX: Sync SECRET_PEPPER across ALL environments');
