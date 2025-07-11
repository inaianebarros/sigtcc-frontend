'use client';

import AccountBoxIcon from '@mui/icons-material/AccountBox';
import Divider from '@mui/material/Divider';
import { Box, Container, Chip, Paper, Typography, TextField, Button, Alert, Snackbar } from '@mui/material';
import { CircularProgress } from '@mui/material';
import { Professor } from '@/utils/interfaces';
import { ProfessorUUID } from '@/utils/interfaces';
import { backendService } from '@/external/api';
import { getColorForUuid } from '@/utils/functions';
import { textFieldStyle } from '@/app/styles';
import { useState, useEffect } from 'react';
import { SendSharp } from '@mui/icons-material';

function LoadingState() {
    return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
            <CircularProgress />
        </Box>
    );
}

export default function ProfessorDetailPage({ params }: ProfessorUUID) {
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [professorData, setProfessorData] = useState<Professor | null>(null);
    const [sendingMessage, setSendingMessage] = useState(false);
    const [messageSent, setMessageSent] = useState(false);
    const [messageError, setMessageError] = useState('');

    useEffect(() => {
        async function loadProfessor() {
            try {
                const { uuid } = await params;
                const data = await backendService.getProfessor(uuid);
                setProfessorData(data);
                setError('');
            } catch (err) {
                setError('Erro ao carregar dados do professor');
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        loadProfessor();
    }, [params]);

    const handleSendMessage = async () => {
        if (!loading && message.trim() !== '') {
            setSendingMessage(true);
            setMessageError('');
            setMessageSent(false);

            try {
                const { uuid } = await params;
                await backendService.requestSupervision(message, uuid);
                setMessageSent(true);
            } catch (err) {
                console.error(err);
                setMessageError(err.response.data.detail);
            } finally {
                setSendingMessage(false);
            }
        }
    }

    if (loading) return <LoadingState />;
    if (error) return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Typography color="error">{error}</Typography>
        </Container>
    );
    if (!professorData) return null;

    return (
        <Box sx={{
            backgroundColor: 'primary.main',
            height: "100vh",
            p: 5.25,
            width: "100vw",
        }}>
            <Paper
                sx={{
                    p: 4,
                    width: "100%",
                    height: "100%",
                    backgroundColor: 'secondary.main',
                    borderRadius: 8,
                }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography
                        color='primary.main'
                        fontSize={46}
                        fontWeight='bold'
                        sx={{ mb: 4, paddingLeft: 3 }}
                        variant="h4"
                    >
                        Solicitar Orientador
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                        <AccountBoxIcon sx={{ width: 258, height: 258 }} />
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                                <Box>
                                    <Typography
                                        color='primary.main'
                                        fontSize={40}
                                        fontWeight='bold'
                                        variant="body1"
                                        padding={1}
                                    >
                                        {professorData.user.first_name}
                                    </Typography>
                                    <TextField
                                        disabled
                                        defaultValue={professorData.institute.name}
                                        sx={{
                                            width: '514px',
                                            minWidth: 200,
                                            backgroundColor: '#efefef',
                                            borderRadius: 8,
                                            mb: 2,
                                            ...textFieldStyle.textFieldOutlinedStyle
                                        }}
                                    />
                                </Box>
                                <Box px={2} paddingTop={2.5}>
                                    <Typography
                                        fontSize={24}
                                        fontWeight='bold'
                                        padding={1}
                                    >
                                        Currículo Lattes
                                    </Typography>
                                    <TextField
                                        disabled
                                        defaultValue={professorData.lattes_url}
                                        sx={{
                                            width: '514px',
                                            minWidth: 200,
                                            backgroundColor: '#efefef',
                                            borderRadius: 8,
                                            mb: 2,
                                            ...textFieldStyle.textFieldOutlinedStyle
                                        }}
                                    />
                                </Box>
                            </Box>
                            <Box>
                                <Typography
                                    fontSize={24}
                                    fontWeight='bold'
                                    padding={1}
                                >
                                    Áreas de Interesse
                                </Typography>
                                <Paper
                                    elevation={0}
                                    sx={{ borderRadius: 8, padding: 1, backgroundColor: '#efefef' }}
                                >
                                    {professorData.expertise_areas.map((area) => (
                                        <Chip
                                            key={area.uuid}
                                            label={area.name}
                                            sx={{
                                                bgcolor: getColorForUuid(area.uuid),
                                                color: 'black',
                                                fontWeight: 500,
                                                marginRight: 1
                                            }}
                                        />
                                    ))}
                                </Paper>
                            </Box>
                        </Box>
                    </Box>
                    <Box sx={{ paddingTop: 2 }}>
                        <Divider sx={{ marginBottom: 2 }} />
                        <Typography variant='body1'>
                            {professorData.biography}
                        </Typography>
                        <Box sx={{ marginTop: 6, marginBottom: 2 }}>
                            <Typography
                                fontSize={24}
                                fontWeight='bold'
                                padding={1}
                            >
                                Mensagem de Solicitação
                            </Typography>
                            <TextField
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Digite sua mensagem"
                                multiline
                                disabled={sendingMessage}
                                sx={{
                                    width: '100%',
                                    height: '100px',
                                    minWidth: 200,
                                    backgroundColor: '#efefef',
                                    borderRadius: 8,
                                    ...textFieldStyle.textFieldOutlinedStyle
                                }}
                            />
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            {messageError && (
                                <Alert severity="error" sx={{ width: '100%', maxWidth: 500 }}>
                                    {messageError}
                                </Alert>
                            )}
                            <Button
                                onClick={handleSendMessage}
                                variant="contained"
                                startIcon={<SendSharp />}
                                disabled={sendingMessage || message.trim() === ''}
                                sx={{
                                    backgroundColor: 'primary.main',
                                    '&:hover': { bgcolor: '#1F3A2D' },
                                    borderRadius: 2,
                                    fontSize: 15,
                                    fontWeight: 'bold',
                                    px: 4
                                }}
                            >
                                {sendingMessage ? 'Enviando...' : 'Enviar'}
                            </Button>
                        </Box>

                        <Snackbar
                            open={messageSent}
                            autoHideDuration={6000}
                            onClose={() => setMessageSent(false)}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                        >
                            <Alert
                                onClose={() => setMessageSent(false)}
                                severity="success"
                                variant="filled"
                                sx={{ width: '100%' }}
                            >
                                Mensagem enviada com sucesso!
                            </Alert>
                        </Snackbar>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
}