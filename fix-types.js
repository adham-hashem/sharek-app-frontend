const fs = require('fs');

let donate = fs.readFileSync('app/(tabs)/donate.tsx', 'utf8');
donate = donate.replace(/await apiFetch\(/g, `await apiFetch<any>(`);
donate = donate.replace(/await apiPost\(/g, `await apiPost<any>(`);
donate = donate.replace(/await apiPatch\(/g, `await apiPatch<any>(`);
donate = donate.replace(`import { Heart, `, `import { Heart, Building2, `);
fs.writeFileSync('app/(tabs)/donate.tsx', donate, 'utf8');

let index = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');
index = index.replace(/await apiFetch\(/g, `await apiFetch<any>(`);
index = index.replace(/await apiPost\(/g, `await apiPost<any>(`);
index = index.replace(/await apiPatch\(/g, `await apiPatch<any>(`);
fs.writeFileSync('app/(tabs)/index.tsx', index, 'utf8');

let request = fs.readFileSync('app/(tabs)/request.tsx', 'utf8');
request = request.replace(/await apiFetch\(/g, `await apiFetch<any>(`);
request = request.replace(/await apiPost\(/g, `await apiPost<any>(`);
request = request.replace(/await apiPatch\(/g, `await apiPatch<any>(`);
fs.writeFileSync('app/(tabs)/request.tsx', request, 'utf8');

let chat = fs.readFileSync('app/chat.tsx', 'utf8');
chat = chat.replace(/await apiFetch\(/g, `await apiFetch<any>(`);
chat = chat.replace(/await apiPost\(/g, `await apiPost<any>(`);
chat = chat.replace(/await apiPatch\(/g, `await apiPatch<any>(`);
fs.writeFileSync('app/chat.tsx', chat, 'utf8');
