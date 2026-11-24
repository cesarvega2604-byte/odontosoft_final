// @ts-nocheck
import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { listarConsultorios, eliminarConsultorio } from '../api';

export default function Lista() {
  const router = useRouter();
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setDatos(await listarConsultorios());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  function borrar(c) {
  const ejecutar = async () => {
    try {
      await eliminarConsultorio(c.id_consultorio);
      setDatos((prev) => prev.filter((x) => x.id_consultorio !== c.id_consultorio));
    } catch (e) {
      if (Platform.OS === 'web') window.alert(e.message);
      else Alert.alert('Error', e.message);
    }
  };

  if (Platform.OS === 'web') {
    if (window.confirm(`¿Eliminar el consultorio "${c.nombre}"?`)) ejecutar();
  } else {
    Alert.alert('Eliminar', `¿Eliminar el consultorio "${c.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: ejecutar },
    ]);
  }
}

  if (cargando) {
    return (
      <View style={s.centro}>
        <ActivityIndicator size="large" color="#0C6B70" />
      </View>
    );
  }

  return (
    <View style={s.pantalla}>
      {error ? <Text style={s.error}>{error}</Text> : null}

      <FlatList
        data={datos}
        keyExtractor={(i) => String(i.id_consultorio)}
        contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={cargar} />}
        ListEmptyComponent={<Text style={s.vacio}>No hay consultorios registrados</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={s.tarjeta}
            onPress={() => router.push({ pathname: '/form', params: { id: item.id_consultorio } })}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.nombre}>{item.nombre}</Text>
              {item.ubicacion ? <Text style={s.sub}>{item.ubicacion}</Text> : null}
              {item.numero_sala ? <Text style={s.sub}>Sala {item.numero_sala}</Text> : null}
            </View>
            <Pressable onPress={() => borrar(item)} hitSlop={10}>
              <Text style={s.borrar}>Borrar</Text>
            </Pressable>
          </Pressable>
        )}
      />

      <Pressable style={s.fab} onPress={() => router.push('/form')}>
        <Text style={s.fabTexto}>+</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#EDF2F1' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF2F1' },
  error: { backgroundColor: '#F7E3E0', color: '#6E2318', padding: 14, margin: 16, borderRadius: 10 },
  vacio: { textAlign: 'center', marginTop: 60, color: '#6C8489' },
  tarjeta: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#D9E3E2',
  },
  nombre: { fontSize: 16, fontWeight: '600', color: '#132A2E', marginBottom: 2 },
  sub: { fontSize: 13, color: '#6C8489' },
  borrar: { color: '#A63A2B', fontWeight: '600', fontSize: 13.5, paddingHorizontal: 8 },
  fab: {
    position: 'absolute', right: 20, bottom: 28, width: 58, height: 58,
    borderRadius: 29, backgroundColor: '#0C6B70',
    alignItems: 'center', justifyContent: 'center', elevation: 4,
  },
  fabTexto: { color: '#fff', fontSize: 30, lineHeight: 34 },
});