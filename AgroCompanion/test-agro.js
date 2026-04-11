const fetch = require('node-fetch');

const API_BASE = 'https://api.agromonitoring.com/agro/1.0';
const apiKey = process.env.AGROMONITORING_API_KEY || process.env.EXPO_PUBLIC_AGROMONITORING_API_KEY || '';

const payload = {
  name: "Test Polygon",
  geo_json: {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-121.1958, 37.6683],
          [-121.1958, 37.6792],
          [-121.1773, 37.6792],
          [-121.1779, 37.6687],
          [-121.1958, 37.6683]
        ]
      ]
    }
  }
};

async function test() {
  if (!apiKey) {
    console.error('Missing AGROMONITORING_API_KEY (or EXPO_PUBLIC_AGROMONITORING_API_KEY).');
    process.exit(1);
  }
  console.log("Sending...");
  const URL = `${API_BASE}/polygons?appid=${apiKey}&duplicated=true`;
  const response = await fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    console.error('Failed!', response.status);
    console.error(await response.text());
  } else {
    console.log('Success!', await response.json());
  }
}

test();
