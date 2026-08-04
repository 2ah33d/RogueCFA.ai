import os
import re
import datetime
import subprocess
import requests
import modal

# Define lightweight Debian image with FFmpeg, requests, and streamlink installed (CPU-only, $0.086/hr)
app_image = (
    modal.Image.debian_slim()
    .apt_install("ffmpeg")
    .pip_install("requests", "streamlink")
)

app = modal.App("roguecfa-live-capture")

@app.function(
    image=app_image,
    # Runs Mon-Fri at 11:59 AM EST (1 minute before 12:00 PM broadcast)
    schedule=modal.Cron("59 11 * * 1-5", timezone="America/New_York"),
    timeout=3900,  # 65 minutes max execution time
    secrets=[modal.Secret.from_name("roguecfa-secrets")]
)
def run_live_capture(duration_secs: int = 3600):
    stream_url = os.environ.get("BNN_LIVE_STREAM_URL", "")
    webhook_url = os.environ.get("VERCEL_WEBHOOK_URL", "https://roguecfa.vercel.app/api/ingest")
    supabase_url = os.environ.get("SUPABASE_URL", "")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY", "")
    api_secret = os.environ.get("API_SECRET") or os.environ.get("CRON_SECRET")
    
    if not api_secret:
        raise RuntimeError("Neither API_SECRET nor CRON_SECRET is set in modal.Secret('roguecfa-secrets')")
    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in modal.Secret('roguecfa-secrets')")

    today_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    raw_filename = "raw_marketcall.m4a"
    compressed_filename = f"marketcall-{today_str}.m4a"

    print(f"=== Beginning Modal CPU Live Capture for date: {today_str} ===")

    capture_success = False

    # Attempt 1 (PRIMARY): Download official BNN Market Call broadcast audio feed from RSS
    try:
        rss_url = "https://www.omnycontent.com/d/playlist/4809bc8a-e41a-405c-93da-a8cf011df2f4/fcfd42e4-d5c6-4b4a-8c62-ae32016f1b9a/4ecaf48c-23a4-4f5e-84b3-ae3201711923/podcast.rss"
        rss_res = requests.get(rss_url, timeout=10)
        mp3_matches = re.findall(r'<enclosure[^>]+url=["\']([^"\']+)["\']', rss_res.text)
        if mp3_matches:
            audio_url = mp3_matches[0].replace("&amp;", "&")
            print(f"Downloading latest BNN Market Call episode audio from RSS feed: {audio_url}")
            dl_res = requests.get(audio_url, timeout=60)
            with open(raw_filename, "wb") as f:
                f.write(dl_res.content)
            capture_success = True
        else:
            raise Exception("No audio enclosure found in RSS feed")
    except Exception as rss_err:
        print(f"Primary RSS audio download failed: {rss_err}. Trying secondary Streamlink live stream capture fallback...")

    # Attempt 2 (FALLBACK): Direct stream capture via Streamlink / FFmpeg
    if not capture_success:
        try:
            target_stream_url = stream_url
            if stream_url.startswith("http") and not stream_url.startswith("hls://"):
                target_stream_url = f"hls://{stream_url}"

            print(f"Attempting live stream capture via Streamlink ({target_stream_url})...")
            streamlink_cmd = [
                "streamlink",
                "--http-header", "Referer=https://www.bnnbloomberg.ca/",
                "--http-header", "User-Agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                target_stream_url,
                "best",
                "-o", raw_filename
            ]
            subprocess.run(streamlink_cmd, timeout=duration_secs + 15, check=True)
            capture_success = True
        except Exception as streamlink_err:
            print(f"Streamlink capture failed ({streamlink_err}). Attempting direct FFmpeg capture fallback...")
            try:
                ffmpeg_cmd = [
                    "ffmpeg", "-y",
                    "-headers", "Referer: https://www.bnnbloomberg.ca/\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36\r\n",
                    "-i", stream_url,
                    "-t", str(duration_secs),
                    "-vn", "-c:a", "aac", raw_filename
                ]
                subprocess.run(ffmpeg_cmd, timeout=duration_secs + 15, check=True)
                capture_success = True
            except Exception as ffmpeg_err:
                raise RuntimeError(f"Both Streamlink and direct FFmpeg live capture failed: {ffmpeg_err}")

    # Step 2: Compress audio with FFmpeg to 48kbps mono AAC (~21.6 MB for 1 hour)
    print("Compressing captured audio to 48kbps mono AAC (~21 MB target size)...")
    compress_cmd = [
        "ffmpeg", "-y",
        "-i", raw_filename,
        "-vn",
        "-c:a", "aac",
        "-b:a", "48k",
        "-ac", "1",
        compressed_filename
    ]
    subprocess.run(compress_cmd, check=True)

    file_size_mb = os.path.getsize(compressed_filename) / (1024 * 1024)
    print(f"Audio compressed successfully. Final size: {file_size_mb:.2f} MB (Groq API compatible < 25MB)")

    # Step 3: Upload compressed audio file to Supabase Storage bucket 'marketcall-audio'
    bucket_name = "marketcall-audio"
    storage_upload_url = f"{supabase_url.rstrip('/')}/storage/v1/object/{bucket_name}/{compressed_filename}"
    
    print(f"Uploading {compressed_filename} to Supabase Storage bucket '{bucket_name}'...")
    with open(compressed_filename, "rb") as f:
        upload_res = requests.post(
            storage_upload_url,
            headers={
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": "audio/mp4",
                "x-upsert": "true",
            },
            data=f,
            timeout=120
        )
    
    if upload_res.status_code not in (200, 201):
        raise RuntimeError(f"Failed to upload audio to Supabase Storage: {upload_res.status_code} - {upload_res.text}")

    public_audio_url = f"{supabase_url.rstrip('/')}/storage/v1/object/public/{bucket_name}/{compressed_filename}"
    print(f"Supabase Storage Upload complete! Public URL: {public_audio_url}")

    # Step 4: Prune Supabase Storage audio files older than 7 days
    try:
        print(f"Checking '{bucket_name}' bucket for files older than 7 days...")
        list_url = f"{supabase_url.rstrip('/')}/storage/v1/object/list/{bucket_name}"
        list_res = requests.post(
            list_url,
            headers={
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": "application/json",
            },
            json={"prefix": "", "limit": 100},
            timeout=15
        )
        if list_res.ok:
            objects = list_res.json()
            cutoff_date = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=7)).strftime("%Y-%m-%d")
            to_delete = []
            for obj in objects:
                name = obj.get("name", "")
                m = re.search(r"marketcall-(\d{4}-\d{2}-\d{2})\.m4a", name)
                if m:
                    file_date = m.group(1)
                    if file_date < cutoff_date:
                        to_delete.append(name)
            
            if to_delete:
                print(f"Pruning {len(to_delete)} old audio files older than {cutoff_date}: {to_delete}")
                delete_url = f"{supabase_url.rstrip('/')}/storage/v1/object/{bucket_name}"
                requests.delete(
                    delete_url,
                    headers={
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json",
                    },
                    json={"prefixes": to_delete},
                    timeout=15
                )
                print("Pruning complete.")
    except Exception as prune_err:
        print(f"Warning: Audio pruning failed (non-critical): {prune_err}")

    # Step 5: Webhook notification to Vercel endpoint
    print("POSTing audio capture notification to Vercel API...")
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            response = requests.post(
                webhook_url,
                json={
                    "show": "Market Call",
                    "episodeDate": today_str,
                    "audioUrl": public_audio_url,
                    "audioSizeMb": round(file_size_mb, 2),
                    "source": "modal_live_audio"
                },
                headers={"Authorization": f"Bearer {api_secret}"},
                timeout=60
            )
            response.raise_for_status()
            print(f"Vercel webhook responded with status {response.status_code}")
            break
        except Exception as err:
            print(f"Webhook attempt {attempt} failed: {err}")
            if attempt == max_retries:
                print("Warning: Webhook failed after 3 attempts, but audio is saved safely in Supabase Storage.")
            import time
            time.sleep(3)
