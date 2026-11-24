// @ts-nocheck
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { obtenerConsultorio, crearConsultorio, actualizarConsultorio } from '../api';

const VACIO = { nombre: '', ubicacion: '', numero_sala: '' };

export default function Form() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const editando = id !== undefined;

  const [form, setForm] = useState(VACIO);
  const [cargando, setCargando] = useState(editando);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!editando) return;
    (async () => {
      try {
        const c = await obtenerConsultorio(id);
        setForm({
          nombre: c.nombre ?? '',
          ubicacion: c.ubicacion ?? '',
          numero_sala: c.numero_sala ?? '',
        });
      } catch (e) {
        setError(e.message);
      } finally {
        setCargando(false);
      }
    })();
  }, [id, editando]);

  const cambiar = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));

  async function guardar() {
    setError(null);

    if (!form.nombre.trim()) {
      setError('El nombre del consultorio es obligatorio.');
      return;
    }

    const payload = {
      nombre: form.nombre.trim(),
      ubicacion: form.ubicacion.trim() || null,
      numero_sala: form.numero_sala.trim() || null,
    };

    setGuardando(true);
    try {
      if (editando) await actualizarConsultorio(id, payload);
      else await crearConsultorio(payload);
      router.back();
    } catch (e) {
      Alert.alert('No se pudo guardar', e.message);
    } finally {
      setGuardando(false);
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
    <>
      <Stack.Screen options={{ title: editando ? 'Editar consultorio' : 'Nuevo consultorio' }} />
      <ScrollView
        style={{ backgroundColor: '#EDF2F1' }}
        contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
        keyboardShouldPersistTaps="handled"
      >
        {error ? <Text style={s.error}>{error}</Text> : null}

        <View style={{ marginBottom: 14 }}>
          <Text style={s.label}>Nombre</Text>
          <TextInput
            value={form.nombre}
            onChangeText={(v) => cambiar('nombre', v)}
            style={s.input}
            placeholder="Consultorio 1"
            placeholderTextColor="#9FB2B4"
          />
        </View>

        <View style={{ marginBottom: 14 }}>
          <Text style={s.label}>Ubicación</Text>
          <TextInput
            value={form.ubicacion}
            onChangeText={(v) => cambiar('ubicacion', v)}
            style={s.input}
            placeholder="Piso 2, ala norte"
            placeholderTextColor="#9FB2B4"
          />
        </View>

        <View style={{ marginBottom: 14 }}>
          <Text style={s.label}>Número de sala</Text>
          <TextInput
            value={form.numero_sala}
            onChangeText={(v) => cambiar('numero_sala', v)}
            style={s.input}
            placeholder="203"
            placeholderTextColor="#9FB2B4"
          />
        </View>

        <Pressable style={s.boton} onPress={guardar} disabled={guardando}>
          <Text style={s.botonTexto}>
            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar consultorio'}
          </Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF2F1' },
  error: { backgroundColor: '#F7E3E0', color: '#6E2318', padding: 14, borderRadius: 10, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#6C8489', marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#D9E3E2',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#132A2E',
  },
  boton: {
    backgroundColor: '#0C6B70', height: 50, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  botonTexto: { color: '#fff', fontSize: 15.5, fontWeight: '600' },
});