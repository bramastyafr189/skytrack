import urllib.request, re
req = urllib.request.Request('https://www.flightradar24.com/airport-disruptions', headers={'User-Agent': 'Mozilla/5.0'})
html=urllib.request.urlopen(req).read().decode('utf-8')
matches = re.findall(r'<script.*?>(\{.*?\})</script>', html, re.DOTALL)
print(len(matches))
for m in matches:
    print(m[:100])
