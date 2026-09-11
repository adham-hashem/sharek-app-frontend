const fs = require('fs');
let proj = fs.readFileSync('app/(auth)/login.tsx', 'utf8');
let up = fs.readFileSync('../last_update/project/app/(auth)/login.tsx', 'utf8');

let newContent = up.replace(
  `const { signIn, t } = useAuth();`,
  `const { signIn, resetPassword, t } = useAuth();`
);

newContent = newContent.replace(
  `const submit = async () => {`,
  `const forgotPassword = async () => {
    setError(null);
    if (!email.trim()) { setError(t('emailRequired')); return; }
    setBusy(true);
    const { error: resetError } = await resetPassword(email);
    setBusy(false);
    setError(resetError ? t(resetError) : t('resetEmailSent'));
  };

  const submit = async () => {`
);

newContent = newContent.replace(
  `<TouchableOpacity style={styles.button} onPress={submit} disabled={busy} activeOpacity={0.8}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('signIn')}</Text>}
          </TouchableOpacity>`,
  `<TouchableOpacity style={styles.button} onPress={submit} disabled={busy} activeOpacity={0.8}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('signIn')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={forgotPassword} disabled={busy} accessibilityRole="button">
            <Text style={styles.forgotText}>{t('forgotPassword')}</Text>
          </TouchableOpacity>`
);

newContent = newContent.replace(
  `switchLink: { ...typography.bodyBold, color: colors.primary },\n});`,
  `switchLink: { ...typography.bodyBold, color: colors.primary },
  forgotText: { ...typography.caption, color: colors.primary, textAlign: 'center', marginTop: spacing.sm },\n});`
);

fs.writeFileSync('app/(auth)/login.tsx', newContent, 'utf8');
console.log('login.tsx merged');
