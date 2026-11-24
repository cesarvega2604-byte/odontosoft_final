import { useSyncExternalStore } from 'react';
import { Alert, Button } from 'react-native';
import { Stack } from 'expo-router';
import { cerrarSesion, hasSession, subscribeSession } from '../api';

export default function Layout() {
  const signedIn = useSyncExternalStore(subscribeSession, hasSession, () => false);

  function logout() {
    cerrarSesion().catch((error: Error) => Alert.alert('No se pudo cerrar la sesión', error.message));
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#EDF2F1' },
        headerTintColor: '#0C6B70',
        headerTitleStyle: { color: '#132A2E' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" options={{ title: 'Consultorios', headerRight: () => <Button title="Salir" onPress={logout} /> }} />
        <Stack.Screen name="form" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ title: 'Iniciar sesión' }} />
      </Stack.Protected>
    </Stack>
  );
}
