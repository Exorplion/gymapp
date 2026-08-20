import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { S, loadAll, useStore, bump } from './src/lib/state.js';
import Inicio from './src/screens/Inicio.js';
import Hoy from './src/screens/Hoy.js';
import Rutina from './src/screens/Rutina.js';
import Comida from './src/screens/Comida.js';
import Progreso from './src/screens/Progreso.js';

const Tab = createBottomTabNavigator();

function InicioTab() {
  useStore();
  return S.tab === 'hoy' ? <Hoy /> : <Inicio />;
}

export default function App() {
  // Puerto del efecto de arranque de web/src/App.jsx: idbOpenOnce().then(loadAll)
  // corría ahí; acá loadAll() ya no necesita idbOpenOnce por separado porque
  // AsyncStorage no tiene noción de "abrir conexión" (ver Task 2).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadAll()
      .then(() => setReady(true))
      .catch(e => { console.error('loadAll() falló:', e); setReady(true); });
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#05070d' }}>
        <ActivityIndicator color="#2e7dff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: '#2e7dff' }}>
        <Tab.Screen name="Inicio" component={InicioTab} />
        <Tab.Screen name="Rutina" component={Rutina} />
        <Tab.Screen name="Comida" component={Comida} />
        <Tab.Screen name="Progreso" component={Progreso} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
