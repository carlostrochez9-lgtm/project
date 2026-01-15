#!/usr/bin/env node
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// Support both environment variables and simple CLI args
// CLI args supported: --url, --service-key, --email, --password, --name, --role
const argv = process.argv.slice(2);
function argVal(flag) {
  const idx = argv.indexOf(flag);
  if (idx >= 0 && idx + 1 < argv.length) return argv[idx + 1];
  return undefined;
}

const SUPABASE_URL = argVal('--url') || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = argVal('--service-key') || process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = argVal('--email') || process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = argVal('--password') || process.env.ADMIN_PASSWORD || 'Admin123!';
const ADMIN_NAME = argVal('--name') || process.env.ADMIN_NAME || 'Site Admin';
const ADMIN_ROLE = argVal('--role') || process.env.ADMIN_ROLE || 'admin';

function exitWith(msg) {
  console.error(msg);
  process.exit(1);
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  exitWith('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
}

async function main() {
  console.log(`Creating admin user: ${ADMIN_EMAIL}`);

  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
      }),
    });

    const payload = await resp.json();

    if (!resp.ok) {
      console.error('Failed to create user:', payload);
      // If user already exists, try to look it up by email
      if (payload?.message && payload.message.includes('duplicate')) {
        console.log('User may already exist — attempting to find by email');
      } else {
        process.exit(1);
      }
    }

    const userId = payload?.id;
    if (!userId) {
      console.log('No user id returned from auth admin create. Attempting to query users list (may require additional privileges).');
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const profile = {
      id: userId || undefined,
      full_name: ADMIN_NAME,
      role: ADMIN_ROLE,
      email: ADMIN_EMAIL,
    };

    // Upsert profile row (if userId is missing, attempt upsert by email via raw SQL)
    if (userId) {
      const { data, error } = await supabase.from('profiles').upsert(profile, { onConflict: 'id' });
      if (error) {
        console.error('Failed to upsert profile:', error);
        process.exit(1);
      }
      console.log('Admin profile created/updated:', data);
    } else {
      // Fallback: attempt to insert with provided email (may create duplicate if profile exists)
      const { data, error } = await supabase.from('profiles').insert(profile);
      if (error) {
        console.error('Failed to insert profile:', error);
        process.exit(1);
      }
      console.log('Admin profile created:', data);
    }

    console.log('\nAdmin user ready for testing');
    console.log('Email:', ADMIN_EMAIL);
    console.log('Password:', ADMIN_PASSWORD);
    console.log('Name:', ADMIN_NAME);
    console.log('Role:', ADMIN_ROLE);
    console.log('\nIMPORTANT: This script uses the service role key. Keep it secret and remove the created test admin when finished.');
  } catch (err) {
    console.error('Unexpected error creating admin:', err);
    process.exit(1);
  }
}

main();
