import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { iniciarSesion } from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    setError('');
    try {
      await iniciarSesion(email.trim(), password);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo iniciar sesión.');
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.title}>Acceso de administración</Text>
      <TextInput style={styles.input} autoCapitalize="none" autoComplete="email"
        keyboardType="email-address" accessibilityLabel="Correo electrónico" placeholder="Correo electrónico"
        value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} secureTextEntry autoComplete="current-password"
        accessibilityLabel="Contraseña" placeholder="Contraseña"
        value={password} onChangeText={setPassword} onSubmitEditing={submit} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Button title={busy ? 'Ingresando…' : 'Ingresar'} onPress={submit} disabled={busy || !email.trim() || !password} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { padding: 24, gap: 16 },
  title: { color: '#132A2E', fontSize: 20, fontWeight: '600' },
  input: { borderColor: '#829493', borderWidth: 1, padding: 12, borderRadius: 8 },
  error: { color: '#a41515' },
});
