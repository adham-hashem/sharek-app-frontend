const fs = require('fs');
let proj = fs.readFileSync('app/conversations.tsx', 'utf8');
let up = fs.readFileSync('../last_update/project/app/conversations.tsx', 'utf8');

// Copy up but replace .from('profiles') back to .from('public_profiles')
let newContent = up.replace(
  /\.from\('profiles'\)/g,
  `.from('public_profiles')`
);

fs.writeFileSync('app/conversations.tsx', newContent, 'utf8');
console.log('conversations.tsx merged');
