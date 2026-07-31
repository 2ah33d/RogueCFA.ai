# ytdlp_worker.py
# Production-ready Modal micro-worker script for RogueCFA.ai
# Run: modal deploy ytdlp_worker.py

import modal

app = modal.App("ytdlp-worker")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("fastapi", "uvicorn", "yt-dlp")
)

@app.function(image=image, timeout=120)
@modal.fastapi_endpoint(method="POST")
def extract(item: dict):
    video_id = item.get("videoId")
    if not video_id:
        return {"status": "error", "error": "Missing videoId parameter"}

    import yt_dlp
    youtube_url = f"https://www.youtube.com/watch?v={video_id}"

    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=False)
            stream_url = info.get('url')
            ext = info.get('ext', 'm4a')
            duration = info.get('duration', 0)
            title = info.get('title', '')

            if not stream_url:
                return {"status": "error", "error": "No stream URL extracted"}

            return {
                "status": "success",
                "videoId": video_id,
                "streamUrl": stream_url,
                "audioFormat": ext,
                "duration": duration,
                "title": title
            }
    except Exception as e:
        return {"status": "error", "error": str(e)}
