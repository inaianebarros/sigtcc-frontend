'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Button,
    TablePagination,
    Box,
    Typography,
} from "@mui/material"
import { useState, useEffect } from "react"
import { backendService } from '@/external/api'
import { useRouter } from 'next/navigation';


export default function Dashboard() {
    const router = useRouter();
    const [studentsRequests, setStudentsRequests] = useState([])
    const [page, setPage] = useState(0)
    const rowsPerPage = 5
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        const loadExpertiseAreas = async () => {
            try {
                const data = await backendService.listRequestedSupervisions();
                setStudentsRequests(data)
            } catch (error) {
                console.error('Erro ao carregar estudantes', error);
            }
        };

        loadExpertiseAreas();
    }, [])

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage)
    }

    const handleResponderSolicitacao = (studentUUID: string, studentMessage: string, requestUuid: string) => {
        localStorage.setItem('studentMessage', studentMessage)
        router.push(`studentSupervisionRequest/${studentUUID}/${requestUuid}`)
    }

    const paginatedStudentsRequests = studentsRequests.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

    if (!mounted) return null;
    return (
        <Box sx={{ width: "100%", maxWidth: 1200, margin: "0 auto", padding: 2 }}>
            <Typography variant="h4" component="h1" gutterBottom>
                Lista de Solicitações
            </Typography>

            <TableContainer component={Paper} elevation={3}>
                <Table sx={{ minWidth: 650 }} aria-label="tabela de estudantes">
                    <TableHead>
                        <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                            <TableCell sx={{ fontWeight: "bold", fontSize: "1.1rem" }}>Aluno</TableCell>
                            <TableCell sx={{ fontWeight: "bold", fontSize: "1.1rem" }}>Curso</TableCell>
                            <TableCell sx={{ fontWeight: "bold", fontSize: "1.1rem" }} align="center">
                                Ação
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedStudentsRequests.map((supervisionRequest) => (
                            <TableRow
                                key={supervisionRequest.student.user.uuid}
                                sx={{
                                    "&:last-child td, &:last-child th": { border: 0 },
                                    "&:hover": { backgroundColor: "#f9f9f9" },
                                }}
                            >
                                <TableCell component="th" scope="row" sx={{ fontSize: "1rem" }}>
                                    {supervisionRequest.student.user.first_name}
                                </TableCell>
                                <TableCell sx={{ fontSize: "1rem" }}>{supervisionRequest.student.course.name}</TableCell>
                                <TableCell align="center">
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        size="small"
                                        onClick={() => handleResponderSolicitacao(
                                            supervisionRequest.student.uuid,
                                            supervisionRequest.student_message,
                                            supervisionRequest.uuid,
                                        )}
                                        sx={{
                                            textTransform: "none",
                                            borderRadius: 2,
                                            px: 2,
                                        }}
                                    >
                                        Responder solicitação
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <TablePagination
                    component="div"
                    count={paginatedStudentsRequests.length}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    rowsPerPageOptions={[]}
                    labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count !== -1 ? count : `mais de ${to}`}`}
                    labelRowsPerPage=""
                    sx={{
                        borderTop: "1px solid #e0e0e0",
                        "& .MuiTablePagination-toolbar": {
                            paddingLeft: 2,
                            paddingRight: 2,
                        },
                    }}
                />
            </TableContainer>
        </Box>
    )
}
