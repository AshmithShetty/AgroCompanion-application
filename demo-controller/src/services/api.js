const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const triggerEvent = (event) => {
  return fetch(`${BASE_URL}/event/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event })
  }).then(res => res.json());
};

export const updateSensor = (sensor, value) => {
  return fetch(`${BASE_URL}/sensor/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sensor, value })
  }).then(res => res.json());
};

export const triggerReplay = () => {
  return fetch(`${BASE_URL}/event/replay`, { method: 'POST' }).then(res => res.json());
};

export const updateSpeed = (speed) => {
  return fetch(`${BASE_URL}/config/speed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ speed })
  }).then(res => res.json());
};