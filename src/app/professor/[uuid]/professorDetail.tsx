import { Box, Chip, Container, Paper, Typography } from '@mui/material';
import { backendService } from '@/external/api';
import { getColorForUuid } from '@/utils/functions';
import { ProfessorUUID } from '@/utils/interfaces';


export async function ProfessorDetail({ params }: ProfessorUUID) {
    const { uuid } = await params;
    const professorData = await backendService.getProfessor(uuid);

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    {professorData.user.first_name} {professorData.user.first_name}
                </Typography>

                <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" gutterBottom color="primary.main" fontWeight="bold">
                        Informações do Professor
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                        <strong>Instituto:</strong> {professorData.institute.name}
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                        <strong>Email:</strong> {professorData.user.email}
                    </Typography>
                </Box>

                <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" gutterBottom color="primary.main" fontWeight="bold">
                        Áreas de Interesse
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {professorData.expertise_areas.map((area) => (
                            <Chip
                                key={area.uuid}
                                label={area.name}
                                sx={{
                                    bgcolor: getColorForUuid(area.uuid),
                                    color: 'black',
                                    fontWeight: 500
                                }}
                            />
                        ))}
                    </Box>
                </Box>
            </Paper>
        </Container>
    );
}