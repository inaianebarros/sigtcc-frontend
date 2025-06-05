'use client';

import React, { useState } from 'react';
import { Button, TextField, Box, Typography } from '@mui/material';
import { textFieldStyle } from './styles';
import { useRouter } from 'next/navigation';
import { backendService } from '../external/api';

export default function Home() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await backendService.login(username, password);
      router.push('/dashboard');
    } catch (err) {
      console.log('Usuário ou senha inválido.');
    }
  }


  return (
    <Box sx={{
      display: 'flex',
      width: "100vw",
      height: "100vh",
      bgcolor: 'primary.main',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingRight: '38px',
      paddingLeft: '73px',
      py: 5.8
    }}>
      {/* Left side */}
      <Box sx={{
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        height: '100%'
      }}
        paddingRight={'51px'}
        width='472px'
      >
        <Typography variant="h4" sx={{ mb: 13, fontFamily: 'Raleway' }} fontWeight="bold" fontSize={46} >Olá, <br />bem vindo!</Typography>
        {/* <Typography variant="h4" sx={{ mb: 12 }} fontWeight="bold" fontSize={46}>Bem vindo!</Typography> */}
        <Typography variant="body1" sx={{ mb: 11, fontFamily: 'Raleway' }} fontSize={24} align="center">
          Encontre o apoio certo e transforme suas ideias em um TCC de excelência.
        </Typography>
        <Button
          variant="outlined"
          sx={{
            mb: 2,
            color: 'primary.main',
            backgroundColor: 'secondary.main',
            borderRadius: 8,
            '&:hover': { bgcolor: 'white' },
            textTransform: 'none',
            fontSize: 20,
            fontWeight: 'bold',
          }}
        >
          Criar Conta
        </Button>
      </Box>

      {/* Right side - Login form */}
      <Box
        component="form"
        onSubmit={handleLogin}
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          bgcolor: 'secondary.main',
          borderRadius: 4,
          height: '100%',
          width: '65%',
          justifyContent: 'center',
          px: 13,
          py: 12,

        }}
      >
        <Typography variant="h5" sx={{ mb: 6, letterSpacing: '0.4rem' }} fontWeight='bold' fontSize={46} color='primary.main'>FAÇA LOGIN</Typography>

        <TextField
          fullWidth
          color='primary'
          label="Email"
          variant="filled"
          placeholder="Digite seu email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          slotProps={{ inputLabel: textFieldStyle.fontSize }}
          sx={{ mb: 7, ...textFieldStyle.style }}
        />

        <TextField
          fullWidth
          color='primary'
          label="Senha"
          type="password"
          variant="filled"
          placeholder="Digite sua senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          slotProps={{ inputLabel: textFieldStyle.fontSize }}
          sx={{ mb: 8, ...textFieldStyle.style }}
        />

        <Typography
          variant="body2"
          align="right"
          sx={{ mb: 6, cursor: 'pointer' }}
        >
          Esqueceu a senha?
        </Typography>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{
            textTransform: 'none',
            fontWeight: 'bold',
            fontSize: 20,
            borderRadius: 8,
            bgcolor: 'primary.main',
            '&:hover': {
              bgcolor: '#1F3A2D'
            },
            mb: 2
          }}
        >
          Entrar
        </Button>
      </Box>
    </Box >
  );
}
