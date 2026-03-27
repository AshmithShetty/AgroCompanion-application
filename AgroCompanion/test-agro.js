const fetch = require('node-fetch');

const API_BASE = 'https://api.agromonitoring.com/agro/1.0';
const apiKey = 'afe36dfacd68971d26ecda6aa36f6a8c';

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
