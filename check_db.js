
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uiffoznfjdltiqxwhiwi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpZmZvem5mamRsdGlxeHdoaXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDg3NjEsImV4cCI6MjA4NzQ4NDc2MX0.aBthoW9n9YiC0zYKgSMBToJkDu2uLb9BPPVb2RNHB0Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkAdmin() {
    console.log('🔍 Checking users table...');
    const { data: users, error } = await supabase.from('users').select('*');
    if (error) {
        console.error('❌ Error fetching users:', error);
        return;
    }

    console.log(`📊 Found ${users.length} users:`);
    users.forEach(u => {
        console.log(`- ID: ${u.id}, Name: ${u.name}, Role: ${u.role}, Pwd: ${u.password}`);
    });

    const admins = users.filter(u => u.id.toLowerCase() === 'admin');
    if (admins.length > 1) {
        console.warn('⚠️ Multiple admin accounts found!');
    } else if (admins.length === 0) {
        console.error('❌ No admin account found!');
    } else {
        console.log('✅ Admin account found:', admins[0]);
    }
}

checkAdmin();
