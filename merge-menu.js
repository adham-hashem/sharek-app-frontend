const fs = require('fs');
let up = fs.readFileSync('../last_update/project/app/(tabs)/menu.tsx', 'utf8');

// The `up` version has onPress={() => {}} for the "Personal Account" menu item
let newContent = up.replace(
  `label={t('personalAccount')}\n          onPress={() => {}}`,
  `label={t('personalAccount')}\n          onPress={openEditProfile}`
);

// We should also add History back in menuSection
newContent = newContent.replace(
  `<MenuItem
          icon={<MessageCircle size={20} color={colors.coral} />}
          label={t('chatTitle')}`,
  `<MenuItem
          icon={<History size={20} color={colors.green} />}
          label={t('history')}
          onPress={() => router.push('/history' as never)}
          color={colors.green}
          bg={colors.greenBg}
          showChevron
        />
        <MenuItem
          icon={<MessageCircle size={20} color={colors.coral} />}
          label={t('chatTitle')}`
);

// And we should restore `isAdmin` check or `is_admin` instead of the old check, but `last_update` has `profile?.is_admin`.
// Add History back to imports
newContent = newContent.replace(
  `MessageCircle,`,
  `MessageCircle, History,`
);

fs.writeFileSync('app/(tabs)/menu.tsx', newContent, 'utf8');
console.log('menu.tsx merged');
