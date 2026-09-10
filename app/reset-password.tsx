import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { useAuth } from '@/lib/auth';

export default function ResetPasswordScreen() {
  const { t, language } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (password.length < 6) { Alert.alert(t('passwordRequired')); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { Alert.alert(t('errorGeneric')); return; }
    Alert.alert(language === 'ar' ? 'تم تحديث كلمة المرور بنجاح' : 'Password updated successfully');
    router.replace('/(auth)/login');
  };
  return <View style={styles.container}>
    <Text style={styles.title}>{language === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset password'}</Text>
    <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder={language === 'ar' ? 'كلمة المرور الجديدة' : 'New password'} placeholderTextColor={colors.brownMuted} style={styles.input} />
    <TouchableOpacity onPress={submit} disabled={busy} style={styles.button}><Text style={styles.buttonText}>{busy ? '…' : (language === 'ar' ? 'تحديث كلمة المرور' : 'Update password')}</Text></TouchableOpacity>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  title: { ...typography.title, color: colors.brown, textAlign: 'center', marginBottom: spacing.lg },
  input: { ...typography.body, color: colors.brown, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, alignItems: 'center' },
  buttonText: { ...typography.bodyBold, color: colors.white },
});
