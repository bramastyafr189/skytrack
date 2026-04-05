const fs = require('fs');
const html = fs.readFileSync('flight_dump2.html', 'utf8');
const start = html.indexOf('<script id="__NEXT_DATA__" type="application/json">');
if (start > -1) {
    const end = html.indexOf('</script>', start);
    const jsonStr = html.substring(start + 51, end);
    try {
        const data = JSON.parse(jsonStr);
        console.log("Keys in pageProps:", Object.keys(data.props.pageProps));
        if (data.props.pageProps.initialStore && data.props.pageProps.initialStore.flightTracker) {
            console.log("FlightTracker data:", Object.keys(data.props.pageProps.initialStore.flightTracker));
        }
    } catch(e) {
        console.error(e);
    }
} else {
    console.log('No NEXT_DATA');
}
