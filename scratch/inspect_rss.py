import requests
from xml.etree import ElementTree as ET

rss_url = "https://www.omnycontent.com/d/playlist/4809bc8a-e41a-405c-93da-a8cf011df2f4/fcfd42e4-d5c6-4b4a-8c62-ae3201711923/4ecaf48c-23a4-4f5e-84b3-ae3201711923/podcast.rss"
res = requests.get(rss_url)
root = ET.fromstring(res.content)

channel = root.find('channel')
items = channel.findall('item')

print(f"Total RSS items found: {len(items)}\n")
for i, item in enumerate(items[:25]):
    title = item.find('title').text if item.find('title') is not None else ''
    pub_date = item.find('pubDate').text if item.find('pubDate') is not None else ''
    enclosure = item.find('enclosure')
    url = enclosure.attrib.get('url') if enclosure is not None else ''
    print(f"{i+1}. Title: {title}")
    print(f"   Date: {pub_date}")
    print(f"   URL: {url[:90]}...\n")
