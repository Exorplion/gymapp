import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { subscribeToast } from '../lib/toast.js';
import { C } from '../theme';

export default function Toast() {
  const [state, setState] = useState(null);

  useEffect(() => subscribeToast(payload => {
    setState(payload.hide ? null : payload);
  }), []);

  if (!state) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.pill}>
        <Text style={styles.msg}>{state.msg}</Text>
        {state.actionLabel ? (
          <Pressable style={styles.action} onPress={state.onAction}>
            <Text style={styles.actionText}>{state.actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 32, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '90%',
    backgroundColor: C.card,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: C.line2,
  },
  msg: { color: C.txt, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  action: { paddingVertical: 4, paddingHorizontal: 8 },
  actionText: { color: C.blue2, fontSize: 13, fontWeight: '700' },
});
