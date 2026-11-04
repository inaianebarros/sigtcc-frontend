import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { paths } from './navigation/paths';
import { AreaPage } from './pages/AreaPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path={paths.login} element={<LoginPage />} />
        <Route element={<RequireAuth userType="student" />}>
          <Route
            path={paths.student}
            element={<AreaPage title="Área do Aluno" />}
          />
        </Route>
        <Route element={<RequireAuth userType="teacher" />}>
          <Route
            path={paths.teacher}
            element={<AreaPage title="Área do Professor" />}
          />
        </Route>
        <Route element={<RequireAuth userType="admin" />}>
          <Route
            path={paths.admin}
            element={<AreaPage title="Área do Administrador" />}
          />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
