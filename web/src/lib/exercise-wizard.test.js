import { describe, it, expect } from 'vitest';
import {
  TOTAL_PASOS, emptyForm, initialWizardState, resolvedCat,
  nextStep, prevStep, setField, confirmAdded, startAnother,
} from './exercise-wizard.js';

describe('exercise-wizard — paso 1: nombre', () => {
  it('no deja avanzar sin nombre y explica qué falta', () => {
    const st = initialWizardState();
    const { state, error } = nextStep(st);
    expect(state.step).toBe(1);
    expect(error).toMatch(/nombre/i);
  });

  it('avanza al paso 2 con nombre cargado', () => {
    const st = setField(initialWizardState(), 'name', 'Press plano');
    const { state, error } = nextStep(st);
    expect(error).toBeNull();
    expect(state.step).toBe(2);
  });

  it('no bloquea el resto de los pasos (series/reps siempre tienen default)', () => {
    let st = setField(initialWizardState(), 'name', 'Press plano');
    st = nextStep(st).state; // 2
    st = nextStep(st).state; // 3
    const { state, error } = nextStep(st); // 4
    expect(error).toBeNull();
    expect(state.step).toBe(4);
  });

  it('no avanza más allá del último paso', () => {
    let st = setField(initialWizardState(), 'name', 'Press plano');
    for (let i = 0; i < 10; i++) st = nextStep(st).state;
    expect(st.step).toBe(TOTAL_PASOS);
  });
});

describe('exercise-wizard — volver atrás', () => {
  it('retrocede sin perder lo cargado', () => {
    let st = setField(initialWizardState(), 'name', 'Pec deck');
    st = nextStep(st).state; // 2
    st = setField(st, 'equip', 'machine');
    st = prevStep(st); // 1
    expect(st.step).toBe(1);
    expect(st.form.name).toBe('Pec deck');
    expect(st.form.equip).toBe('machine');
  });

  it('no retrocede antes del paso 1', () => {
    const st = prevStep(initialWizardState());
    expect(st.step).toBe(1);
  });
});

describe('exercise-wizard — grupo muscular detectado', () => {
  it('usa catOf() cuando no hay elección manual', () => {
    const form = { ...emptyForm(), name: 'Press banca' };
    expect(resolvedCat(form)).toBe('Pecho');
  });

  it('la elección manual gana sobre el automático', () => {
    const form = { ...emptyForm(), name: 'Press banca', cat: 'Hombro' };
    expect(resolvedCat(form)).toBe('Hombro');
  });

  it('sin nombre reconocible devuelve vacío, no un grupo inventado', () => {
    const form = { ...emptyForm(), name: 'Ejercicio raro xyz123' };
    expect(resolvedCat(form)).toBe('');
  });
});

describe('exercise-wizard — confirmar y agregar otro', () => {
  it('confirmAdded suma el nombre a la tanda y salta al paso 4', () => {
    let st = setField(initialWizardState(), 'name', 'Press plano');
    st = confirmAdded(st, 'Press plano');
    expect(st.step).toBe(4);
    expect(st.batch).toEqual(['Press plano']);
  });

  it('startAnother limpia el formulario, conserva la tanda y vuelve al paso 1', () => {
    let st = setField(initialWizardState(), 'name', 'Press plano');
    st = setField(st, 'sets', 5);
    st = confirmAdded(st, 'Press plano');
    st = startAnother(st);
    expect(st.step).toBe(1);
    expect(st.form).toEqual(emptyForm());
    expect(st.batch).toEqual(['Press plano']);
  });

  it('la tanda se acumula a través de varias vueltas', () => {
    let st = initialWizardState();
    st = setField(st, 'name', 'Press plano');
    st = confirmAdded(st, 'Press plano');
    st = startAnother(st);
    st = setField(st, 'name', 'Pec deck');
    st = confirmAdded(st, 'Pec deck');
    expect(st.batch).toEqual(['Press plano', 'Pec deck']);
  });
});
