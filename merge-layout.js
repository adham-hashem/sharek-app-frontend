const fs = require('fs');
let up = fs.readFileSync('../last_update/project/app/_layout.tsx', 'utf8');

let newContent = up.replace(
  `<Stack.Screen name="(auth)/login" />`,
  `<Stack.Screen name="(auth)/login" />
      <Stack.Screen name="reset-password" />`
);

newContent = newContent.replace(
  `<Stack.Screen name="donate-sharek" />`,
  `<Stack.Screen name="donate-sharek" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="history" />
      <Stack.Screen name="privacy" />`
);

fs.writeFileSync('app/_layout.tsx', newContent, 'utf8');
console.log('_layout.tsx merged');
