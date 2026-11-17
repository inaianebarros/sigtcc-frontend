import { Box, Button, GlobalStyles, Stack, Typography } from '@mui/material';
import { PendingChangesNotice } from './PendingChangesNotice';

/**
 * A barra de salvar fixa no rodapé da tela (RNF28): aparece com o aviso e o botão só enquanto há
 * alteração pendente. A região do aviso fica sempre montada, para o leitor de tela anunciá-lo.
 */
export function SaveBar({
  visible,
  saving,
  note,
}: {
  visible: boolean;
  saving: boolean;
  /** Uma frase a mais sob o aviso, como a de que o tema grava à parte. */
  note?: string;
}) {
  return (
    <Box
      sx={[
        {
          position: 'sticky',
          bottom: 0,
          zIndex: (theme) => theme.zIndex.appBar - 1,
          mt: 4,
        },
        visible && {
          px: { xs: 2, sm: 3 },
          py: 1.5,
          bgcolor: 'background.paper',
          border: 1,
          borderBottom: 0,
          borderColor: 'divider',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
        },
      ]}
    >
      {/* O foco que o teclado leva a um campo não pode parar escondido atrás da barra fixa: a folga vale
          para a área principal, que é quem rola. */}
      {visible && (
        <GlobalStyles
          styles={{
            main: { '--save-bar-clearance': '144px' },
            '@media (min-width:600px)': {
              main: { '--save-bar-clearance': '96px' },
            },
          }}
        />
      )}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ alignItems: { sm: 'center' } }}
      >
        <Box sx={{ flexGrow: 1 }}>
          <PendingChangesNotice
            visible={visible}
            actionLabel="Salvar alterações"
          />
          {visible && note && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {note}
            </Typography>
          )}
        </Box>
        {visible && (
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
