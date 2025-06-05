import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        primary: {
            main: '#2A382A',
        },
        secondary: {
            main: '#D9D9D9',
        },
    },
    typography: {
        fontFamily: 'inherit, Raleway',
        h1: {
            fontFamily: 'inherit',
        },
        h2: {
            fontFamily: 'inherit',
        },
        h3: {
            fontFamily: 'inherit',
        },
        h4: {
            fontFamily: 'var(--font-raleway)',
        },
        h5: {
            fontFamily: 'inherit',
        },
        h6: {
            fontFamily: 'inherit',
        },
        body1: {
            fontFamily: 'inherit',
        },
        body2: {
            fontFamily: 'inherit',
        },
    },
});

export default theme;