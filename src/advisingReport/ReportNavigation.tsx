import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Breadcrumbs,
  IconButton,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

interface ReportNavigationProps {
  /** O histórico de orientações, com a página e a busca de onde o relatório foi aberto (RNF30). */
  historyPath: string;
  /** O nome da outra parte; só chega com o relatório. */
  name?: string;
}

/** A seta de voltar e o caminho "Histórico de orientações / Nome". */
export function ReportNavigation({ historyPath, name }: ReportNavigationProps) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
      <IconButton
        component={RouterLink}
        to={historyPath}
        aria-label="Voltar para o histórico"
        edge="start"
      >
        <ArrowBackIcon />
      </IconButton>
      <Breadcrumbs aria-label="Caminho">
        <Link component={RouterLink} to={historyPath}>
          Histórico de orientações
        </Link>
        {name !== undefined && (
          <Typography
            color="text.primary"
            aria-current="page"
            sx={{ overflowWrap: 'anywhere' }}
          >
            {name}
          </Typography>
        )}
      </Breadcrumbs>
    </Stack>
  );
}
