import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
} from '@expo-google-fonts/barlow';
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_700Bold_Italic,
} from '@expo-google-fonts/barlow-condensed';
import { S, loadAll, useStore, bump } from './src/lib/state.js';
import { scheduleTomorrowReminder } from './src/lib/reminder.js';
import { C } from './src/theme.js';
import Inicio from './src/screens/Inicio.js';
import Hoy from './src/screens/Hoy.js';
import Rutina from './src/screens/Rutina.js';
import Library from './src/screens/Library.js';
import Nutricion from './src/screens/Nutricion.js';
import Progreso from './src/screens/Progreso.js';
import Toast from './src/components/Toast.js';
import SheetHost from './src/components/SheetHost.js';
import RestTimer from './src/components/RestTimer.js';

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
  const [fontsLoaded] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_700Bold_Italic,
  });
  useEffect(() => {
    loadAll()
      .then(() => {
        setReady(true);
        // Reprograma el recordatorio de mañana con el estado recién cargado
        // (no con los defaults en memoria). No crítico: un fallo acá no debe
        // bloquear el arranque de la app.
        scheduleTomorrowReminder().catch(() => {});
      })
      .catch(e => { console.error('loadAll() falló:', e); setReady(true); });
  }, []);

  if (!ready || !fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.blue} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: C.blue,
            tabBarInactiveTintColor: C.mut,
            tabBarStyle: {
              backgroundColor: C.card,
              borderTopWidth: 1,
              borderTopColor: C.line,
              elevation: 0,
              shadowOpacity: 0,
            },
          }}
        >
          <Tab.Screen
            name="Inicio"
            component={InicioTab}
            listeners={{
              tabPress: () => { if (S.tab !== 'inicio') { S.tab = 'inicio'; bump(); } },
            }}
          />
          <Tab.Screen name="Rutina" component={RutinaTab} />
          <Tab.Screen name="Comida" component={Nutricion} />
          <Tab.Screen name="Progreso" component={Progreso} />
        </Tab.Navigator>
      </NavigationContainer>
      <Toast />
      <SheetHost />
      <RestTimer />
    </GestureHandlerRootView>
  );
}
