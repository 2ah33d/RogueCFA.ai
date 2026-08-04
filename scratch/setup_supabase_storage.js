import fs from 'fs';
import path from 'path';

// Load env
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  for (const line of envText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    }
  }
}

async function setupBucket() {
  const { supabase } = await import('../api/_supabaseClient.js');

  console.log('Checking Supabase Storage buckets...');
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) {
    console.error('List buckets error:', listErr.message);
    return;
  }

  console.log('Buckets found:', buckets.map(b => b.name));

  const bucketName = 'marketcall-audio';
  const existing = buckets.find(b => b.name === bucketName);

  if (!existing) {
    console.log(`Creating public storage bucket "${bucketName}"...`);
    const { data: created, error: createErr } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 52428800, // 50 MB limit per file
      allowedMimeTypes: ['audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/m4a', 'application/octet-stream'],
    });
    if (createErr) {
      console.error(`Failed to create bucket ${bucketName}:`, createErr.message);
    } else {
      console.log(`Bucket "${bucketName}" created successfully!`);
    }
  } else {
    console.log(`Bucket "${bucketName}" already exists.`);
  }
}

setupBucket();
