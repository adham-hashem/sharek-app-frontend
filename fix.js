const fs = require('fs');
// Fix layout routes
let layout = fs.readFileSync('app/_layout.tsx', 'utf8');
if (!layout.includes('<Stack.Screen name="notifications" />')) {
  layout = layout.replace('<Stack.Screen name="history" />', `<Stack.Screen name="history" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="quran" />
      <Stack.Screen name="support" />
      <Stack.Screen name="verify-account" />
      <Stack.Screen name="admin-verification" />
      <Stack.Screen name="admin-ratings" />`);
  fs.writeFileSync('app/_layout.tsx', layout, 'utf8');
}

// Fix lib/auth.tsx
let auth = fs.readFileSync('lib/auth.tsx', 'utf8');
if (!auth.includes('updateMode,')) {
  auth = auth.replace('updateRole,', `updateRole,\n    updateMode,`);
  fs.writeFileSync('lib/auth.tsx', auth, 'utf8');
}
