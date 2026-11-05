import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { areas } from './navigation/areas';
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
        {areas.map(({ userType, path, title }) => (
          <Route key={userType} element={<RequireAuth userType={userType} />}>
            <Route path={path} element={<AreaPage title={title} />} />
          </Route>
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
