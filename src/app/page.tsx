import { Button, TextField, Box, Typography } from '@mui/material';

export default function Home() {
  return (
    <Box sx={{
      display: 'flex',
      width: "100vw",
      height: "100vh",
      bgcolor: '#2D4B3E',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4
    }}>
      {/* Left side */}
      <Box sx={{ color: 'white', maxWidth: '300px' }}>
        <Typography variant="h4" sx={{ mb: 1 }}>Olá,</Typography>
        <Typography variant="h4" sx={{ mb: 2 }}>Bem vindo!</Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>
          Encontre o apoio certo e transforme suas ideias em um TCC de excelência.
        </Typography>
        <Button
          variant="outlined"
          sx={{
            color: 'white',
            borderColor: 'white',
            '&:hover': {
              borderColor: 'white',
              bgcolor: 'rgba(255,255,255,0.1)'
            }
          }}
        >
          Criar Conta
        </Button>
      </Box>

      {/* Right side - Login form */}
      <Box sx={{
        // display: 'flex',
        bgcolor: 'white',
        padding: 4,
        borderRadius: 2,
        width: '400px',
        // justifyContent: 'center',
        // alignItems: 'center',
      }}>
        <Typography variant="h5" sx={{ mb: 3 }}>FAÇA LOGIN</Typography>

        <TextField
          fullWidth
          color='success'
          label="Email"
          placeholder="Digite seu email"
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          color='success'
          label="Senha"
          type="password"
          placeholder="Digite sua senha"
          sx={{ mb: 1 }}
        />

        <Typography
          variant="body2"
          align="right"
          sx={{ mb: 2, cursor: 'pointer' }}
        >
          Esqueceu a senha?
        </Typography>

        <Button
          fullWidth
          variant="contained"
          sx={{
            bgcolor: '#2D4B3E',
            '&:hover': {
              bgcolor: '#1F3A2D'
            },
            mb: 2
          }}
        >
          Entrar
        </Button>
      </Box>
    </Box>
  );
}
