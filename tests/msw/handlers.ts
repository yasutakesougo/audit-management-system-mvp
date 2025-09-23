import { http, HttpResponse } from 'msw';

let throttleHit = 0;
let batchHit = 0;

// Adjust base host to match code usage; placeholder contoso site
const BASE = 'https://contoso.sharepoint.com/sites/site/_api';

export const handlers = [
  // Example list items GET (simulate first 429 then success)
  http.get(`${BASE}/web/lists/getbytitle(*)/items`, () => {
    if (throttleHit++ === 0) {
      return HttpResponse.text('', { status: 429, headers: { 'Retry-After': '0' } });
    }
    return HttpResponse.json({ value: [] }, { status: 200 });
  }),

  // Batch endpoint: first 503 then success with simple 201 in body
  http.post(`${BASE}/$batch`, async () => {
    if (batchHit++ === 0) {
      return HttpResponse.text('', { status: 503 });
    }
    return HttpResponse.text('HTTP/1.1 201 Created', { status: 200 });
  }),
];
