import { Box, Button, Stack } from '@mui/material';
import { PendingChangesNotice } from './PendingChangesNotice';

/**
 * A barra de salvar fixa no rodapé da tela (RNF28): aparece com o aviso e o botão só enquanto há
 * alteração pendente. A região do aviso fica sempre montada, para o leitor de tela anunciá-lo.
 */
export function SaveBar({
  visible,
  saving,
}: {
  visible: boolean;
  saving: boolean;
}) {
  return (
    <Box
      sx={[
        {
          position: 'sticky',
          bottom: 0,
          zIndex: (theme) => theme.zIndex.appBar - 1,
          mx: { xs: -2, sm: -4 },
          mb: { xs: -2, sm: -4 },
        },
        visible && {
          px: { xs: 2, sm: 4 },
          py: 1.5,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          borderBottomLeftRadius: 12,
          borderBottomRightRadius: 12,
        },
      ]}
    >
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
