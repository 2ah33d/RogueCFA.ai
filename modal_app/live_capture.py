import os
import subprocess
import requests
import modal

# Define Debian image with FFmpeg, Whisper, requests, and streamlink installed
app_image = (
    modal.Image.debian_slim()
    .apt_install("ffmpeg")
    .pip_install("openai-whisper", "requests", "streamlink")
)

app = modal.App("roguecfa-live-capture")

@app.function(
    image=app_image,
    # Runs Mon-Fri at 11:59 AM EST (1 minute before 12:00 PM broadcast)
    schedule=modal.Cron("59 11 * * 1-5", timezone="America/New_York"),
    timeout=3900,  # 65 minutes max execution time
    gpu="T4",
    secrets=[modal.Secret.from_name("roguecfa-secrets")]
)
def run_live_capture(duration_secs: int = 3600):
    stream_url = os.environ["BNN_LIVE_STREAM_URL"]
    webhook_url = os.environ["VERCEL_WEBHOOK_URL"]
    api_secret = os.environ["API_SECRET"]
    output_filename = "market_call_live.m4a"

    print("Attempting primary capture from BNN Market Call official RSS audio feed...")

    capture_success = False

    # Attempt 1 (PRIMARY): Download official BNN Market Call broadcast audio feed from RSS
    try:
        rss_url = "https://www.omnycontent.com/d/playlist/4809bc8a-e41a-405c-93da-a8cf011df2f4/fcfd42e4-d5c6-4b4a-8c62-ae32016f1b9a/4ecaf48c-23a4-4f5e-84b3-ae3201711923/podcast.rss"
        rss_res = requests.get(rss_url, timeout=10)
        import re
        mp3_matches = re.findall(r'<enclosure[^>]+url=["\']([^"\']+)["\']', rss_res.text)
        if mp3_matches:
            audio_url = mp3_matches[0].replace("&amp;", "&")
            print(f"Downloading latest BNN Market Call episode audio from RSS feed: {audio_url}")
            dl_res = requests.get(audio_url, timeout=60)
            with open(output_filename, "wb") as f:
                f.write(dl_res.content)
            capture_success = True
        else:
            raise Exception("No audio enclosure found in RSS feed")
    except Exception as rss_err:
        print(f"Primary RSS audio download failed: {rss_err}. Trying secondary Streamlink live stream capture fallback...")

    # Attempt 2 (FALLBACK): Direct stream capture via Streamlink
    if not capture_success:
        try:
            streamlink_cmd = [
                "streamlink",
                "--http-header", "Referer=https://www.bnnbloomberg.ca/",
                "--http-header", "User-Agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                stream_url,
                "best",
                "-o", output_filename
            ]
            subprocess.run(streamlink_cmd, timeout=duration_secs + 15, check=True)
            capture_success = True
        except Exception as fallback_err:
            raise RuntimeError(f"Both primary RSS audio download and Streamlink fallback failed: {fallback_err}")

    print("Capture complete. Running Whisper large-v3 transcription on GPU...")

    # 2. Transcribe via Whisper large-v3
    import whisper
    model = whisper.load_model("large-v3")
    result = model.transcribe(output_filename, verbose=False)

    print("Transcription complete. POSTing payload to Vercel API...")

    # 3. Deliver payload to Vercel endpoint
    response = requests.post(
        webhook_url,
        json={
            "show": "Market Call",
            "raw_text": result["text"],
            "segments": result["segments"]  # Preserves caller timestamps
        },
        headers={"Authorization": f"Bearer {api_secret}"},
        timeout=30
    )
    response.raise_for_status()
    print(f"Vercel webhook responded with status {response.status_code}")
