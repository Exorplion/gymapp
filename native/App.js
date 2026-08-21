import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { S, loadAll, useStore, bump } from './src/lib/state.js';
import Inicio from './src/screens/Inicio.js';
import Hoy from './src/screens/Hoy.js';
import Rutina from './src/screens/Rutina.js';
import Library from './src/screens/Library.js';
import Comida from './src/screens/Comida.js';
import Progreso from './src/screens/Progreso.js';
import Toast from './src/components/Toast.js';

const Tab = createBottomTabNavigator();
const RutinaStack = createNativeStackNavigator();

// La pestaña "Rutina" necesita navegar a "Mis rutinas" (Library) sin romper
// las otras 3 pestañas del tab bar de más abajo — se envuelve en su propio
// Stack.Navigator anidado (patrón estándar de React Navigation: tab → stack),
// con Rutina como ruta inicial.
function RutinaTab() {
  return (
    <RutinaStack.Navigator screenOptions={{ headerShown: false }}>
      <RutinaStack.Screen name="RutinaHome" component={Rutina} />
      <RutinaStack.Screen name="Library" component={Library} />
    </RutinaStack.Navigator>
  );
}

function InicioTab({ navigation }) {
  useStore();
  return S.tab === 'hoy' ? <Hoy /> : <Inicio navigation={navigation} />;
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: '#2e7dff' }}>
          <Tab.Screen
            name="Inicio"
            component={InicioTab}
            listeners={{
              tabPress: () => { if (S.tab !== 'inicio') { S.tab = 'inicio'; bump(); } },
            }}
          />
          <Tab.Screen name="Rutina" component={RutinaTab} />
          <Tab.Screen name="Comida" component={Comida} />
          <Tab.Screen name="Progreso" component={Progreso} />
        </Tab.Navigator>
      </NavigationContainer>
      <Toast />
    </GestureHandlerRootView>
  );
}
