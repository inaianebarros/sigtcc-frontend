import { createTheme } from '@mui/material/styles';

// Tema do SIGTCC: a identidade teal do portal da UFOPA (ADR frontend 0005, RNF17). Os valores vêm
// de DESIGN.md e docs/design-system-ufopa.md no hub; cada par de texto e fundo foi calculado
// contra o WCAG 2.1 AA (4,5:1 para texto, 3:1 para componentes).
const FONT_FAMILY = '"Raleway", "Roboto", "Helvetica", "Arial", sans-serif';

// Anel de foco sobre fundo claro: 2 px em teal com halo branco (6,97:1 sobre branco).
const FOCUS_RING = {
  outline: '2px solid #0f6460',
  outlineOffset: 2,
  boxShadow: '0 0 0 2px #ffffff',
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0f6460',
      dark: '#0b4b3f',
      light: '#e0f7f6',
      contrastText: '#ffffff',
    },
    secondary: { main: '#123131', contrastText: '#ffffff' },
    error: { main: '#b3261e', light: '#fdecea', contrastText: '#ffffff' },
    warning: { main: '#8a5300', light: '#fff4e0', contrastText: '#ffffff' },
    info: { main: '#0b4778', light: '#e3f2fd', contrastText: '#ffffff' },
    success: { main: '#1b5e20', light: '#e6f4ea', contrastText: '#ffffff' },
    text: { primary: '#2e2e2a', secondary: '#5d5d52' },
    background: { default: '#f9f9f7', paper: '#ffffff' },
    divider: '#e6e6e2',
  },
  typography: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    h1: { fontSize: '2rem', fontWeight: 700, lineHeight: 1.25 },
    h2: { fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.3 },
    h3: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.35 },
    h4: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4 },
    h5: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4 },
    h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4 },
    subtitle1: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.5 },
    subtitle2: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.45 },
    body1: { fontSize: '1rem', lineHeight: 1.5 },
    body2: { fontSize: '0.875rem', lineHeight: 1.45 },
    button: { fontSize: '0.9375rem', fontWeight: 600, textTransform: 'none' },
    caption: { fontSize: '0.8125rem', lineHeight: 1.4 },
    overline: {
      fontSize: '0.75rem',
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'none',
    },
  },
  spacing: 8,
  shape: { borderRadius: 8 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Numerais alinhados e de largura fixa: o Raleway traz numerais antigos por padrão.
        body: { fontVariantNumeric: 'lining-nums tabular-nums' },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'secondary' },
      styleOverrides: { root: { borderBottom: '3px solid #1dc2ae' } },
    },
    MuiButtonBase: {
      styleOverrides: { root: { '&.Mui-focusVisible': FOCUS_RING } },
    },
    MuiButton: {
      // 40 px com o mouse; 44 px no toque (DESIGN.md).
      styleOverrides: {
        root: { minHeight: 40, '@media (pointer: coarse)': { minHeight: 44 } },
      },
    },
    MuiOutlinedInput: {
      // Campo de fundo branco (DESIGN.md), também quando fica direto sobre o papel de fundo.
      styleOverrides: {
        root: { backgroundColor: '#ffffff' },
        notchedOutline: { borderColor: '#76766a' },
      },
    },
    MuiLink: { defaultProps: { underline: 'always' } },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: '1px solid #e6e6e2', borderRadius: 12 },
      },
    },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } },
  },
});
