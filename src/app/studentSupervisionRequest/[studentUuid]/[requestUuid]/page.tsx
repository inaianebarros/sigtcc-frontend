'use client';

import AccountBoxIcon from '@mui/icons-material/AccountBox';
import Divider from '@mui/material/Divider';
import { Box, Container, Chip, Paper, Typography, TextField, Button, Alert, Snackbar } from '@mui/material';
import { CircularProgress } from '@mui/material';
import { Student } from '@/utils/interfaces';
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

export interface StudentUUID {
    params: { studentUuid: string; requestUuid: string }
}

export default function SupervisionRequestPage({ params }: StudentUUID) {
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [student, setStudent] = useState<Student | null>(null);
    const [sendingMessage, setSendingMessage] = useState(false);
    const [messageSent, setMessageSent] = useState(false);
    const [messageError, setMessageError] = useState('');

    useEffect(() => {
        async function loadStudent({ params }: {
            params: { studentUuid: string; requestUuid: string }
        }) {
            try {
                const { studentUuid } = await params;
                const data = await backendService.getStudent(studentUuid);
                setStudent(data);
                setError('');
            } catch (err) {
                setError('Erro ao carregar dados do aluno');
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        loadStudent({ params });
    }, [params]);

    const handleSendMessage = async (answer: string) => {
        if (!loading && message.trim() !== '') {
            setSendingMessage(true);
            setMessageError('');
            setMessageSent(false);

            try {
                const { requestUuid } = await params;
                await backendService.answerSupervision(answer, message, requestUuid);
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
    if (!student) return null;

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
                        Responder Aluno
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
                                        {student.user.first_name}
                                    </Typography>
                                    <TextField
                                        disabled
                                        defaultValue={student.course.name}
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
                                        Matrícula
                                    </Typography>
                                    <TextField
                                        disabled
                                        defaultValue={student.enrollment}
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
                        </Box>
                    </Box>
                    <Box sx={{ paddingTop: 2 }}>
                        <Divider sx={{ marginBottom: 2 }} />
                        <Box sx={{ marginTop: 6, marginBottom: 2 }}>
                            <Typography variant='body1'>
                                {localStorage.getItem('studentMessage')}
                            </Typography>
                            <Typography
                                fontSize={24}
                                fontWeight='bold'
                                padding={1}
                            >
                                Mensagem de Resposta
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
                            <Box>
                                <Button
                                    onClick={() => handleSendMessage('YES')}
                                    variant="contained"
                                    startIcon={<SendSharp />}
                                    disabled={sendingMessage || message.trim() === ''}
                                    sx={{
                                        backgroundColor: 'primary.main',
                                        '&:hover': { bgcolor: '#1F3A2D' },
                                        borderRadius: 2,
                                        fontSize: 15,
                                        fontWeight: 'bold',
                                        px: 4,
                                        marginRight: 2,
                                    }}
                                >
                                    {sendingMessage ? 'Enviando...' : 'Aceitar'}
                                </Button>
                                <Button
                                    onClick={() => handleSendMessage('NO')}
                                    variant="contained"
                                    startIcon={<SendSharp />}
                                    disabled={sendingMessage || message.trim() === ''}
                                    sx={{
                                        backgroundColor: '#E53935',
                                        '&:hover': { bgcolor: '#C62828' },
                                        borderRadius: 2,
                                        fontSize: 15,
                                        fontWeight: 'bold',
                                        px: 4
                                    }}
                                >
                                    {sendingMessage ? 'Enviando...' : 'Recusar'}
                                </Button>
                            </Box>
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
                                Resposta enviada!
                            </Alert>
                        </Snackbar>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
}