'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
    Autocomplete,
    Box,
    Button,
    Checkbox,
    Chip,
    FormControl,
    MenuItem,
    Paper,
    Select,
    SelectChangeEvent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { Assignment as AssignmentIcon } from "@mui/icons-material"
import { textFieldStyle } from '../styles';
import { getColorForUuid } from '@/utils/functions'

import { backendService } from '@/external/api';
import { ExpertiseAreas, Institute, Professor } from '@/utils/interfaces';

export default function SearchProfessor() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    const [expertiseAreas, setExpertiseAreas] = useState<ExpertiseAreas[]>([]);
    const [institutes, setInstitutes] = useState<Institute[]>([]);
    const [professors, setProfessors] = useState<Professor[]>([]);
    const [searchProfessorName, setSearchProfessorName] = useState<string>('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [selectedExpertiseAreasUUID, setSelectedExpertiseAreasUUID] = useState<string[]>([]);
    const [selectedInstituteUUID, setSelectedInstituteUUID] = useState<string>('');

    useEffect(() => {
        const loadExpertiseAreas = async () => {
            try {
                const data = await backendService.getExpertiseAreas();
                setExpertiseAreas(data);
            } catch (error) {
                console.error('Erro ao carregar Áreas de Interesse', error);
            }
        };

        const loadInstitutes = async () => {
            try {
                const data = await backendService.getInstitutes();
                setInstitutes(data);
            } catch (error) {
                console.error('Erro ao carregar Institutos', error);
            }
        };

        loadExpertiseAreas();
        loadInstitutes();
    }, [])

    const handleInstituteSelect = (event: SelectChangeEvent) => {
        const selectedUUID = event.target.value;
        setSelectedInstituteUUID(selectedUUID);
        console.log('Selected Institute UUID:', selectedInstituteUUID);
    };

    const handleSearchProfessor = async () => {
        try {
            const data = await backendService.getFilteredProfessors(selectedExpertiseAreasUUID, selectedInstituteUUID, searchProfessorName);
            setProfessors(data);
        } catch (error) {
            console.error('Erro ao buscar professores', error);
        }
    };

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 5));
        setPage(0);
    };

    const handleRequestGuidance = (professor: Professor) => {
        router.push(`/professor/${professor.uuid}`);
    };

    if (!mounted) return null;
    return (
        <Box sx={{
            display: 'flex',
            width: "100vw",
            height: "100vh",
            bgcolor: 'primary.main',
            justifyContent: 'center',
            alignItems: 'center',
            p: 5.25
        }}>
            <Box sx={{ p: 4, width: "100%", height: "100%", backgroundColor: 'secondary.main', borderRadius: 8, }}>

                <Typography variant="h4" sx={{ mb: 4, paddingLeft: 3 }} fontWeight='bold' fontSize={46}>Buscar Orientador</Typography>
                <Box sx={{ display: 'flex', mb: 4, px: 3, gap: 4, '& > *': { minWidth: '45%' } }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', width: 700 }}>
                        <Box>
                            <Typography sx={{ mb: 1 }} fontWeight='bold' fontSize={20} color='primary.main'>Nome</Typography>
                            <TextField
                                onChange={(e) => setSearchProfessorName(e.target.value)}
                                placeholder="Digite o nome do professor"
                                sx={{
                                    width: '100%',
                                    flexGrow: 1,
                                    minWidth: 200,
                                    backgroundColor: '#efefef',
                                    borderRadius: 8,
                                    mb: 2,
                                    ...textFieldStyle.textFieldOutlinedStyle
                                }}
                            />
                        </Box>
                        <Box sx={{ pb: 2 }}>
                            <Typography
                                sx={{ mb: 1 }}
                                fontWeight='bold'
                                fontSize={20}
                                color='primary.main'
                            >
                                Instituto
                            </Typography>
                            <FormControl sx={{
                                width: '100%',
                                minWidth: 200,
                                backgroundColor: '#efefef',
                                borderRadius: 8,
                                ...textFieldStyle.textFieldOutlinedStyle
                            }}>
                                <Select defaultValue="" onChange={handleInstituteSelect} displayEmpty>
                                    <MenuItem value="">
                                        <a>- Selecione -</a>
                                    </MenuItem>
                                    {institutes.map(institute => (
                                        <MenuItem key={institute.uuid} value={institute.uuid}>
                                            {institute.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                            <Button
                                onClick={handleSearchProfessor}
                                variant="contained"
                                startIcon={<SearchIcon />}
                                sx={{
                                    backgroundColor: 'primary.main',
                                    '&:hover': { bgcolor: '#1F3A2D' },
                                    borderRadius: 8,
                                    fontSize: 15,
                                    fontWeight: 'bold',
                                    height: 40,
                                }}
                            >
                                Buscar
                            </Button>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: 700 }}>
                        <Box sx={{ pb: 8 }}>
                            <Typography
                                sx={{ mb: 1 }}
                                fontWeight='bold'
                                fontSize={20}
                                color='primary.main'
                                align='center'
                            >Selecione suas áreas de interesse</Typography>
                            <Autocomplete
                                multiple
                                options={expertiseAreas}
                                getOptionLabel={(option) => option.name}
                                value={expertiseAreas.filter(area => selectedExpertiseAreasUUID.includes(area.uuid))}
                                onChange={(_, newValue) => setSelectedExpertiseAreasUUID(newValue.map(area => area.uuid))}
                                disableCloseOnSelect
                                isOptionEqualToValue={(option, value) => option.uuid === value.uuid}
                                slotProps={{ listbox: { sx: { maxHeight: 150 } } }}
                                renderValue={(value, getTagProps) => (
                                    <Box sx={{ overflowY: 'auto' }}>
                                        {value.map((option, index) => (
                                            <Chip
                                                {...getTagProps({ index })}
                                                key={option.uuid}
                                                label={option.name}
                                                sx={{ bgcolor: getColorForUuid(option.uuid), color: 'black' }}
                                            />
                                        ))}
                                    </Box>
                                )}
                                renderOption={({ key, ...props }, option, { selected }) => (
                                    <li key={key} {...props}>
                                        <Checkbox
                                            checked={selected}
                                            tabIndex={-1}
                                            color="primary"
                                        />
                                        {option.name}
                                    </li>
                                )}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        variant="standard"
                                        label='Áreas'
                                        slotProps={{ inputLabel: textFieldStyle.fontSize }}
                                        sx={{ borderRadius: 8, ...textFieldStyle.textFieldOutlinedStyle }}
                                    />
                                )}
                            />
                        </Box>
                    </Box>
                </Box>

                <Box sx={{ px: 3 }}>
                    <TableContainer
                        component={Paper}
                        sx={{
                            mb: 2,
                            borderRadius: 2,
                            overflow: "hidden",
                            "& .MuiTable-root": { "auto": 650 },
                        }}>
                        <Table stickyHeader={true}>
                            <TableHead>
                                <TableRow>
                                    <TableCell
                                        sx={{ backgroundColor: 'background.default' }}
                                        align='center'
                                    >
                                        Nome
                                    </TableCell>
                                    <TableCell
                                        sx={{ backgroundColor: 'background.default' }}
                                        align='center'
                                    >
                                        Instituto
                                    </TableCell>
                                    <TableCell
                                        sx={{ backgroundColor: 'background.default' }}
                                        align='center'
                                    >
                                        Áreas de Interesse
                                    </TableCell>
                                    <TableCell
                                        sx={{ backgroundColor: 'background.default' }}
                                        align='center'
                                    >
                                        Ação
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {professors
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((professor, index) => (
                                        <TableRow key={index}>
                                            <TableCell align="center">{professor.user.first_name}</TableCell>
                                            <TableCell align="center">{professor.institute.name}</TableCell>
                                            <TableCell align="center">
                                                {
                                                    professor.expertise_areas.map(
                                                        (expertiseArea) => <Chip
                                                            key={expertiseArea.uuid}
                                                            label={expertiseArea.name}
                                                            sx={{
                                                                bgcolor: getColorForUuid(
                                                                    expertiseArea.uuid
                                                                ),
                                                                color: 'black',
                                                                mr: 1,
                                                            }}
                                                        />
                                                    )
                                                }
                                            </TableCell>
                                            <TableCell align="center">
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    startIcon={<AssignmentIcon />}
                                                    onClick={() => handleRequestGuidance(professor)}
                                                    sx={{
                                                        textTransform: "none",
                                                        borderRadius: 2,
                                                        fontWeight: 500,
                                                        px: 2,
                                                        "&:hover": { transform: "translateY(-1px)" },
                                                    }}
                                                >
                                                    Solicitar Orientação
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <TablePagination
                        component="div"
                        count={professors.length}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={[rowsPerPage]}
                        labelRowsPerPage="Linhas por página:"
                        labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                    />
                </Box>
            </Box>
        </Box >
    );
}