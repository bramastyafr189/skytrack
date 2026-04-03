import urllib.request
req = urllib.request.Request('https://www.flightradar24.com/', headers={'User-Agent': 'Mozilla/5.0'})
html=urllib.request.urlopen(req).read().decode('utf-8')
print('DAL346' in html or 'most-tracked' in html or 'svg' in html)
