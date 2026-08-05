import requests
import re
import datetime

def find_rss_item(target_date=None):
    rss_url = "https://www.omnycontent.com/d/playlist/4809bc8a-e41a-405c-93da-a8cf011df2f4/fcfd42e4-d5c6-4b4a-8c62-ae32016f1b9a/4ecaf48c-23a4-4f5e-84b3-ae3201711923/podcast.rss"
    rss_res = requests.get(rss_url, timeout=15)
    
    items = re.findall(r'<item>([\s\S]*?)</item>', rss_res.text)
    selected_audio_url = None
    selected_title = None
    
    for item in items:
        title_m = re.search(r'<title>([^<]+)</title>', item)
        enc_m = re.search(r'<enclosure[^>]+url=["\']([^"\']+)["\']', item)
        
        if enc_m:
            url = enc_m.group(1).replace("&amp;", "&")
            title = title_m.group(1) if title_m else ""
            
            if target_date:
                if target_date in item or target_date in title:
                    selected_audio_url = url
                    selected_title = title
                    break
                
                title_date_m = re.search(r'\(([A-Za-z]+\.?\s+\d{1,2},\s+\d{4})\)', title)
                if title_date_m:
                    raw_title_date = title_date_m.group(1).replace('.', '')
                    for fmt in ("%B %d, %Y", "%b %d, %Y"):
                        try:
                            parsed_dt = datetime.datetime.strptime(raw_title_date, fmt)
                            if parsed_dt.strftime("%Y-%m-%d") == target_date:
                                selected_audio_url = url
                                selected_title = title
                                break
                        except Exception:
                            pass
                    if selected_audio_url:
                        break
            else:
                selected_audio_url = url
                selected_title = title
                break
                
    return selected_title, selected_audio_url

print("Test July 30, 2026 match:")
title, url = find_rss_item("2026-07-30")
print("Found title:", title)
print("Found URL:", url[:90] if url else None)

print("\nTest July 29, 2026 match:")
title2, url2 = find_rss_item("2026-07-29")
print("Found title:", title2)
print("Found URL:", url2[:90] if url2 else None)
