// Utilidades de formato/fecha/número — puerto verbatim de index.html.
export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c as string] as string));
export const uid = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const KG2LB = 2.20462262;
export const pad = (n: number | string): string => String(n).padStart(2, '0');
export const dstr = (d: Date = new Date()): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const WD = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const WDS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const WD1 = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
export const MO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const fmtD = (s: string): string => `${+s.slice(8)} ${MO[+s.slice(5, 7) - 1]}`;
export const fmtDFull = (s: string): string => { const dt = new Date(s + 'T12:00:00'); return `${WDS[dt.getDay()]} ${+s.slice(8)} ${MO[+s.slice(5, 7) - 1]}`; };
export const round1 = (n: number): number => Math.round(n * 10) / 10;
export const fmtNum = (n: number): string => Number.isInteger(n) ? String(n) : n.toFixed(1);
// Kilos para leer (auditoría total, I4): había cuatro formatos para lo mismo
// ("127042 kg", "7653 KG VOL.", "6.85k kg", toLocaleString('es') que agrupa
// "151.059" pero deja "7122"). Uno solo: separador de miles y a lo sumo un
// decimal, en es-PE (coma de miles, punto decimal), que es el punto decimal
// que la app ya usa en todos lados ("74.2 kg") y la región del sello del build.
const MILES = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 });
export const fmtMiles = (n: number): string => MILES.format(n);
// Con la unidad pegada por un espacio duro: "7,122 kg" no se parte entre
// renglones (H8).
export const NBSP = '\u00a0';
export const fmtKg = (n: number): string => `${fmtMiles(n)}${NBSP}kg`;
export const fmtMMSS = (s: number): string => `${Math.floor(s / 60)}:${pad(s % 60)}`;
export const kg2lb = (kg: number): number => round1(kg * KG2LB);
export const lb2kg = (lb: number): number => lb / KG2LB;
export const vibrate = (p: number | number[]): void => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
export const norm = (s: unknown): string => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
