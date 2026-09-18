import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { ScreenHeader } from '@/components/ScreenHeader';

export default function ChangePasswordScreen() {
  const { language } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const ar = language === 'ar';
  const submit = async () => {
    if (password.length < 6 || password !== confirm) {
      Alert.alert(ar ? 'تحقق من كلمة المرور' : 'Check your password', ar ? 'يجب أن تكون 6 أحرف على الأقل ومتطابقة.' : 'Use at least 6 characters and make both fields match.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { Alert.alert(ar ? 'تعذر تغيير كلمة المرور' : 'Could not change password'); return; }
    Alert.alert(ar ? 'تم تغيير كلمة المرور' : 'Password changed', undefined, [{ text: 'OK', onPress: () => router.back() }]);
  };
  return <View style={styles.container}>
    <ScreenHeader title={ar ? 'تغيير كلمة المرور' : 'Change password'} onBack={() => router.back()} />
    <View style={styles.card}>
      <Text style={styles.title}>{ar ? 'أنشئ كلمة مرور جديدة' : 'Create a new password'}</Text>
      <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder={ar ? 'كلمة المرور الجديدة' : 'New password'} placeholderTextColor={colors.brownMuted} />
      <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} secureTextEntry placeholder={ar ? 'تأكيد كلمة المرور' : 'Confirm password'} placeholderTextColor={colors.brownMuted} />
      <TouchableOpacity style={styles.button} onPress={submit} disabled={busy}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{ar ? 'حفظ كلمة المرور' : 'Save password'}</Text>}</TouchableOpacity>
    </View>
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.background }, card: { margin: spacing.lg, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, gap: spacing.md }, title: { ...typography.heading, color: colors.brown, textAlign: 'center' }, input: { ...typography.body, color: colors.brown, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md }, button: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' }, buttonText: { ...typography.bodyBold, color: colors.white } });
