const fs = require('fs');
let content = fs.readFileSync('lib/auth.tsx', 'utf8');

// 1. Add UserMode and UserReligion to imports
content = content.replace(/Profile, UserSettings, AppLanguage, UserRole/, 'Profile, UserSettings, AppLanguage, UserRole, UserMode, UserReligion');

// 2. Add updateMode and modify signUp and updateProfile in AuthContextType
content = content.replace(/signUp: \(email: string, password: string, fullName: string\) => Promise<\{ error: string \| null \}>;/, `signUp: (email: string, password: string, fullName: string, religion: UserReligion | null) => Promise<{ error: string | null }>;`);

content = content.replace(/updateRole: \(role: UserRole\) => Promise<\{ error: string \| null \}>;/, `updateRole: (role: UserRole) => Promise<{ error: string | null }>;
  updateMode: (mode: UserMode) => Promise<{ error: string | null }>;`);

content = content.replace(/updateProfile: \(fields: Partial<Pick<Profile, 'full_name' \| 'phone' \| 'country' \| 'avatar_url'>>\) => Promise<\{ error: string \| null \}>;/, `updateProfile: (fields: Partial<Pick<Profile, 'full_name' | 'phone' | 'country' | 'currency' | 'avatar_url'>>) => Promise<{ error: string | null }>;`);

// 3. Update signUp logic
content = content.replace(/const signUp = useCallback\(async \(email: string, password: string, fullName: string\) => \{[\s\S]*?return \{ error: null \};\n  \}, \[\]\);/, `const signUp = useCallback(async (email: string, password: string, fullName: string, religion: UserReligion | null = null) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      const code = (error as any).code ?? '';
      const msg = error.message.toLowerCase();
      if (code === 'weak_password' || msg.includes('weak_password') || msg.includes('password is known'))
        return { error: 'passwordWeak' };
      if (code === 'over_request_rate_limit' || msg.includes('rate limit'))
        return { error: 'rateLimited' };
      if (msg.includes('already') || code === 'user_already_exists')
        return { error: 'emailInUse' };
      return { error: 'authError' };
    }
    if (data.user) {
      const lang = await AsyncStorage.getItem('sharek_language') as AppLanguage ?? 'en';
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        email,
        role: 'skipped',
        language: lang,
        religion: religion,
      });
      if (profileError) console.error('profile insert error', profileError);
      await supabase.from('user_settings').insert({ user_id: data.user.id });
    }
    return { error: null };
  }, []);`);

// 4. Update updateProfile logic
content = content.replace(/const updateProfile = useCallback\(async \(fields: Partial<Pick<Profile, 'full_name' \| 'phone' \| 'country' \| 'avatar_url'>>\) => \{/, `const updateMode = useCallback(async (mode: UserMode) => {
    if (!session?.user) return { error: 'authError' };
    const { error } = await supabase
      .from('profiles')
      .update({ mode })
      .eq('id', session.user.id);
    if (error) return { error: 'errorGeneric' };
    await loadProfile(session.user.id);
    return { error: null };
  }, [session, loadProfile]);

  const updateProfile = useCallback(async (fields: Partial<Pick<Profile, 'full_name' | 'phone' | 'country' | 'currency' | 'avatar_url'>>) => {`);

// 5. Add updateMode to return value
content = content.replace(/updateRole,\n\s*updateProfile,/, `updateRole,
    updateMode,
    updateProfile,`);

fs.writeFileSync('lib/auth.tsx', content, 'utf8');
console.log('lib/auth.tsx merged');
