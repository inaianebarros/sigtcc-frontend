'use client';

import { useRouter } from 'next/navigation';
import { Button, Box, Container, Typography } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../theme';

export default function Dashboard() {
    const router = useRouter();

    const handleSearchProfessor = () => {
        router.push('/searchProfessor');
    }

    return (
        <ThemeProvider theme={theme}>
            <Container>
                <Box
                    component="div"
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        py: 4
                    }}
                >
                    <Typography variant="h4" sx={{ mb: 4 }}>
                        Dashboard do Aluno
                    </Typography>
                    <Button
                        onClick={handleSearchProfessor}
                        variant="outlined"
                        sx={{
                            mb: 2,
                            color: 'primary.main',
                            backgroundColor: 'secondary.main',
                            borderRadius: 8,
                            '&:hover': { bgcolor: 'white' },
                            textTransform: 'none',
                            fontSize: 20,
                            fontWeight: 'bold',
                        }}
                    >
                        Buscar Orientador
                    </Button>
                </Box>
            </Container>
        </ThemeProvider>
    );
}