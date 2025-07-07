import { Suspense } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { ProfessorUUID } from '@/utils/interfaces';

import { ProfessorDetail } from '@/app/professor/[uuid]/professorDetail';

function LoadingState() {
    return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
            <CircularProgress />
        </Box>
    );
}

export default function ProfessorDetailPage({ params }: ProfessorUUID) {
    return (
        <Suspense fallback={<LoadingState />}>
            <ProfessorDetail params={params} />
        </Suspense>
    );
}